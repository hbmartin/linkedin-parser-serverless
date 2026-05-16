import { getDocumentProxy, extractTextItems } from 'unpdf';
import { TextItem, LayoutInfo } from '../types/structural.js';

export class StructuralParser {
  private static readonly COLUMN_SPLIT_BOUNDARY = 150;
  private static readonly MIN_LEFT_ITEMS_FOR_TWO_COLUMN = 7;
  private static readonly MIN_RIGHT_ITEMS_FOR_TWO_COLUMN = 20;
  private static readonly MIN_COLUMN_GAP = 20;

  static async extractStructuredText(
    pdfInput: ArrayBuffer | Uint8Array
  ): Promise<{
    textItems: TextItem[];
    layout: LayoutInfo;
  }> {
    const data = new Uint8Array(pdfInput);
    const pdf = await getDocumentProxy(data);
    const { items } = await extractTextItems(pdf);

    const allTextItems: TextItem[] = items.flatMap((pageItems, pageIndex) =>
      pageItems
        .map(item => ({
          text: item.str.trim(),
          x: item.x,
          // PDF pages reuse the same coordinate space; offset pages before flattening.
          y: item.y - pageIndex * 10000,
          fontSize: item.fontSize,
          fontFamily: item.fontFamily || 'unknown',
          width: item.width,
          height: item.height,
        }))
        .filter(item => item.text.length > 0)
    );

    // Detect layout
    const layout = this.detectLayout(allTextItems);

    return {
      textItems: allTextItems,
      layout,
    };
  }

  private static detectLayout(textItems: TextItem[]): LayoutInfo {
    // Analyze X positions to detect columns
    const xPositions = textItems.map(item => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);

    // Look for two distinct clusters of X positions
    // Based on analysis, left column is around x=20, right column around x=220
    const leftItems = textItems.filter(
      item => item.x < this.COLUMN_SPLIT_BOUNDARY
    );
    const rightItems = textItems.filter(
      item => item.x >= this.COLUMN_SPLIT_BOUNDARY
    );

    // Check if there's a significant gap indicating columns. Some exports only
    // have contact details and top skills in the sidebar, so item count alone is
    // not enough to reject a two-column layout.
    if (
      leftItems.length >= this.MIN_LEFT_ITEMS_FOR_TWO_COLUMN &&
      rightItems.length > this.MIN_RIGHT_ITEMS_FOR_TWO_COLUMN
    ) {
      const sidebarRight = Math.max(
        ...leftItems.map(item => item.x + (item.width || 100))
      );
      const mainLeft = Math.min(...rightItems.map(item => item.x));

      if (mainLeft - sidebarRight < this.MIN_COLUMN_GAP) {
        return {
          type: 'single-column',
        };
      }

      return {
        type: 'two-column',
        sidebarBounds: {
          left: minX,
          right: sidebarRight,
          top: Math.min(...leftItems.map(item => item.y)),
          bottom: Math.max(...leftItems.map(item => item.y)),
        },
        mainBounds: {
          left: mainLeft,
          right: maxX,
          top: Math.min(...rightItems.map(item => item.y)),
          bottom: Math.max(...rightItems.map(item => item.y)),
        },
      };
    }

    return {
      type: 'single-column',
    };
  }

  static groupTextByProximity(
    textItems: TextItem[],
    maxYDistance = 5
  ): TextItem[][] {
    // Detect layout first to handle columns separately
    const layout = this.detectLayout(textItems);

    if (layout.type === 'two-column') {
      // Process each column separately using the fixed boundary
      const leftItems = textItems.filter(
        item => item.x < this.COLUMN_SPLIT_BOUNDARY
      );
      const rightItems = textItems.filter(
        item => item.x >= this.COLUMN_SPLIT_BOUNDARY
      );

      const leftGroups = this.groupItemsByY(leftItems, maxYDistance);
      const rightGroups = this.groupItemsByY(rightItems, maxYDistance);

      // Combine and sort all groups by their average Y position
      const allGroups = [...leftGroups, ...rightGroups];
      allGroups.sort((a, b) => {
        const avgYA = a.reduce((sum, item) => sum + item.y, 0) / a.length;
        const avgYB = b.reduce((sum, item) => sum + item.y, 0) / b.length;
        return avgYB - avgYA; // Top to bottom
      });

      return allGroups;
    } else {
      // Single column processing
      return this.groupItemsByY(textItems, maxYDistance);
    }
  }

  private static groupItemsByY(
    textItems: TextItem[],
    maxYDistance = 5
  ): TextItem[][] {
    // Sort by Y position (top to bottom)
    const sorted = [...textItems].sort((a, b) => b.y - a.y);
    const groups: TextItem[][] = [];
    let currentGroup: TextItem[] = [];

    for (const item of sorted) {
      if (currentGroup.length === 0) {
        currentGroup.push(item);
      } else {
        const lastItem = currentGroup[currentGroup.length - 1];
        const yDistance = Math.abs(lastItem.y - item.y);

        if (yDistance <= maxYDistance) {
          currentGroup.push(item);
        } else {
          if (currentGroup.length > 0) {
            groups.push([...currentGroup]);
          }
          currentGroup = [item];
        }
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  static combineGroupedText(groups: TextItem[][]): string[] {
    return groups.map(group => {
      // Sort by X position within group (left to right)
      const sortedGroup = group.sort((a, b) => a.x - b.x);
      return sortedGroup
        .map(item => item.text)
        .join(' ')
        .trim();
    });
  }
}
