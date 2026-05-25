import { getDocumentProxy, extractTextItems } from 'unpdf';
import { TextItem, LayoutInfo } from '../types/structural.js';
import { getTextItemStructuralColumn } from '../utils/structural-layout.js';

export class StructuralParser {
  private static readonly MIN_LEFT_ITEMS_FOR_TWO_COLUMN = 2;
  private static readonly MIN_RIGHT_ITEMS_FOR_TWO_COLUMN = 15;
  private static readonly MIN_MAIN_CLUSTER_ITEMS = 5;
  private static readonly MIN_MAIN_COLUMN_X = 180;
  private static readonly MAIN_COLUMN_LEFT_TOLERANCE = 8;
  private static readonly MIN_COLUMN_GAP = 18;

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
          pageIndex,
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

  static detectLayout(textItems: TextItem[]): LayoutInfo {
    if (textItems.length === 0) {
      return {
        type: 'single-column',
      };
    }

    const pageLayouts = this.detectPageLayouts(textItems);
    const twoColumnPageLayouts = pageLayouts.filter(
      layout => layout.type === 'two-column'
    );
    const globalLayout = this.detectPageLayout(textItems);
    const twoColumnLayouts =
      twoColumnPageLayouts.length > 0
        ? twoColumnPageLayouts
        : globalLayout.type === 'two-column'
          ? [globalLayout]
          : [];

    if (twoColumnLayouts.length === 0) {
      return {
        type: 'single-column',
        pageLayouts,
      };
    }

    return {
      type: 'two-column',
      pageLayouts,
      sidebarBounds: this.mergeBounds(
        twoColumnLayouts.map(layout => layout.sidebarBounds)
      ),
      mainBounds: this.mergeBounds(
        twoColumnLayouts.map(layout => layout.mainBounds)
      ),
    };
  }

  private static detectPageLayouts(textItems: TextItem[]): LayoutInfo[] {
    const itemsByPage = new Map<number, TextItem[]>();

    for (const item of textItems) {
      const pageIndex = item.pageIndex ?? inferPageIndex(item);
      const pageItems = itemsByPage.get(pageIndex) ?? [];

      pageItems.push(item);
      itemsByPage.set(pageIndex, pageItems);
    }

    const pageLayouts: LayoutInfo[] = [];

    for (const [pageIndex, pageItems] of Array.from(itemsByPage.entries()).sort(
      ([firstPage], [secondPage]) => firstPage - secondPage
    )) {
      pageLayouts[pageIndex] = this.detectPageLayout(pageItems);
    }

    return pageLayouts;
  }

  private static detectPageLayout(textItems: TextItem[]): LayoutInfo {
    const xPositions = textItems.map(item => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const mainLeft = this.findMainColumnLeft(textItems);

    if (mainLeft === undefined) {
      return {
        type: 'single-column',
      };
    }

    const mainBoundary = mainLeft - this.MAIN_COLUMN_LEFT_TOLERANCE;
    const leftItems = textItems.filter(
      item => item.x < mainBoundary && !this.isPageNumberItem(item)
    );
    const rightItems = textItems.filter(item => item.x >= mainBoundary);

    if (
      leftItems.length >= this.MIN_LEFT_ITEMS_FOR_TWO_COLUMN &&
      rightItems.length >= this.MIN_RIGHT_ITEMS_FOR_TWO_COLUMN
    ) {
      const sidebarRight = Math.max(
        ...leftItems.map(item => item.x + (item.width || 100))
      );

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

  private static findMainColumnLeft(textItems: TextItem[]): number | undefined {
    const clusters = new Map<number, number[]>();

    for (const item of textItems) {
      if (item.x < this.MIN_MAIN_COLUMN_X || this.isPageNumberItem(item)) {
        continue;
      }

      const clusterKey = Math.round(item.x / 5) * 5;
      const clusterItems = clusters.get(clusterKey) ?? [];

      clusterItems.push(item.x);
      clusters.set(clusterKey, clusterItems);
    }

    const [bestCluster] = Array.from(clusters.values()).sort(
      (first, second) => second.length - first.length
    );

    if (!bestCluster || bestCluster.length < this.MIN_MAIN_CLUSTER_ITEMS) {
      return undefined;
    }

    return Math.min(...bestCluster);
  }

  private static mergeBounds(
    bounds: Array<LayoutInfo['sidebarBounds']>
  ): LayoutInfo['sidebarBounds'] {
    const presentBounds = bounds.filter(
      (bound): bound is NonNullable<typeof bound> => bound !== undefined
    );

    if (presentBounds.length === 0) {
      return undefined;
    }

    return {
      left: Math.min(...presentBounds.map(bound => bound.left)),
      right: Math.max(...presentBounds.map(bound => bound.right)),
      top: Math.min(...presentBounds.map(bound => bound.top)),
      bottom: Math.max(...presentBounds.map(bound => bound.bottom)),
    };
  }

  static groupTextByProximity(
    textItems: TextItem[],
    maxYDistance = 5
  ): TextItem[][] {
    // Detect layout first to handle columns separately
    const layout = this.detectLayout(textItems);

    if (layout.type === 'two-column') {
      const leftItems: TextItem[] = [];
      const rightItems: TextItem[] = [];

      for (const item of textItems) {
        const column = getTextItemStructuralColumn({
          fallbackColumn: 'right',
          item,
          layout,
        });

        if (column === 'left') {
          leftItems.push(item);
        } else {
          rightItems.push(item);
        }
      }

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

  private static isPageNumberItem(item: TextItem): boolean {
    return /^(?:page|\d+|of)$/i.test(item.text.trim());
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

function inferPageIndex(item: TextItem): number {
  if (item.y >= 0) {
    return 0;
  }

  return Math.ceil(Math.abs(item.y) / 10000);
}
