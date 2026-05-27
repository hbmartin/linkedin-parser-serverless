import { getDocumentProxy, extractTextItems } from 'unpdf';
import { TextItem, LayoutInfo } from '../types/structural.js';
import { getTextItemStructuralColumn } from '../utils/structural-layout.js';

export interface GroupTextByProximityParams {
  textItems: TextItem[];
  layout?: LayoutInfo;
  maxYDistance?: number;
}

interface MainColumnCluster {
  count: number;
  minX: number;
}

type LayoutBounds = NonNullable<LayoutInfo['sidebarBounds']>;
type LayoutBoundsKey = 'mainBounds' | 'sidebarBounds';

interface TextItemGroupWithAverageY {
  averageY: number;
  group: TextItem[];
}

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
    const twoColumnPageLayouts: LayoutInfo[] = [];

    for (const pageLayout of pageLayouts) {
      if (pageLayout?.type === 'two-column') {
        twoColumnPageLayouts.push(pageLayout);
      }
    }

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
      sidebarBounds: this.mergeLayoutBounds(twoColumnLayouts, 'sidebarBounds'),
      mainBounds: this.mergeLayoutBounds(twoColumnLayouts, 'mainBounds'),
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
    const mainLeft = this.findMainColumnLeft(textItems);

    if (mainLeft === undefined) {
      return {
        type: 'single-column',
      };
    }

    const mainBoundary = mainLeft - this.MAIN_COLUMN_LEFT_TOLERANCE;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let leftItemCount = 0;
    let rightItemCount = 0;
    let sidebarRight = Number.NEGATIVE_INFINITY;
    let sidebarTop = Number.POSITIVE_INFINITY;
    let sidebarBottom = Number.NEGATIVE_INFINITY;
    let mainTop = Number.POSITIVE_INFINITY;
    let mainBottom = Number.NEGATIVE_INFINITY;

    for (const item of textItems) {
      minX = Math.min(minX, item.x);
      maxX = Math.max(maxX, item.x);

      if (item.x < mainBoundary) {
        if (this.isPageNumberItem(item)) {
          continue;
        }

        leftItemCount += 1;
        sidebarRight = Math.max(sidebarRight, item.x + (item.width || 100));
        sidebarTop = Math.min(sidebarTop, item.y);
        sidebarBottom = Math.max(sidebarBottom, item.y);
      } else {
        rightItemCount += 1;
        mainTop = Math.min(mainTop, item.y);
        mainBottom = Math.max(mainBottom, item.y);
      }
    }

    if (
      leftItemCount >= this.MIN_LEFT_ITEMS_FOR_TWO_COLUMN &&
      rightItemCount >= this.MIN_RIGHT_ITEMS_FOR_TWO_COLUMN
    ) {
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
          top: sidebarTop,
          bottom: sidebarBottom,
        },
        mainBounds: {
          left: mainLeft,
          right: maxX,
          top: mainTop,
          bottom: mainBottom,
        },
      };
    }

    return {
      type: 'single-column',
    };
  }

  private static findMainColumnLeft(textItems: TextItem[]): number | undefined {
    const clusters = new Map<number, MainColumnCluster>();

    for (const item of textItems) {
      if (item.x < this.MIN_MAIN_COLUMN_X || this.isPageNumberItem(item)) {
        continue;
      }

      const clusterKey = Math.round(item.x / 5) * 5;
      const existingCluster = clusters.get(clusterKey);

      if (existingCluster) {
        existingCluster.count += 1;
        existingCluster.minX = Math.min(existingCluster.minX, item.x);
      } else {
        clusters.set(clusterKey, {
          count: 1,
          minX: item.x,
        });
      }
    }

    let bestCluster: MainColumnCluster | undefined;

    for (const cluster of clusters.values()) {
      if (!bestCluster || cluster.count > bestCluster.count) {
        bestCluster = cluster;
      }
    }

    if (!bestCluster || bestCluster.count < this.MIN_MAIN_CLUSTER_ITEMS) {
      return undefined;
    }

    return bestCluster.minX;
  }

  private static mergeBounds(
    bounds: Array<LayoutInfo['sidebarBounds']>
  ): LayoutInfo['sidebarBounds'] {
    let mergedBounds: LayoutBounds | undefined;

    for (const bound of bounds) {
      mergedBounds = this.mergeBound(mergedBounds, bound);
    }

    return mergedBounds;
  }

  private static mergeLayoutBounds(
    layouts: LayoutInfo[],
    boundsKey: LayoutBoundsKey
  ): LayoutInfo['sidebarBounds'] {
    let mergedBounds: LayoutBounds | undefined;

    for (const layout of layouts) {
      mergedBounds = this.mergeBound(mergedBounds, layout[boundsKey]);
    }

    return mergedBounds;
  }

  private static mergeBound(
    mergedBounds: LayoutBounds | undefined,
    bound: LayoutInfo['sidebarBounds']
  ): LayoutBounds | undefined {
    if (!bound) {
      return mergedBounds;
    }

    if (!mergedBounds) {
      return {
        left: bound.left,
        right: bound.right,
        top: bound.top,
        bottom: bound.bottom,
      };
    }

    mergedBounds.left = Math.min(mergedBounds.left, bound.left);
    mergedBounds.right = Math.max(mergedBounds.right, bound.right);
    mergedBounds.top = Math.min(mergedBounds.top, bound.top);
    mergedBounds.bottom = Math.max(mergedBounds.bottom, bound.bottom);

    return mergedBounds;
  }

  static groupTextByProximity(
    textItems: TextItem[],
    maxYDistance?: number
  ): TextItem[][];
  static groupTextByProximity(params: GroupTextByProximityParams): TextItem[][];
  static groupTextByProximity(
    paramsOrTextItems: GroupTextByProximityParams | TextItem[],
    maxYDistance = 5
  ): TextItem[][] {
    const params = Array.isArray(paramsOrTextItems)
      ? {
          maxYDistance,
          textItems: paramsOrTextItems,
        }
      : paramsOrTextItems;
    const textItems = params.textItems;
    const effectiveMaxYDistance = params.maxYDistance ?? maxYDistance;
    // Detect layout first to handle columns separately
    const layout = params.layout ?? this.detectLayout(textItems);

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

      const leftGroups = this.groupItemsByY(leftItems, effectiveMaxYDistance);
      const rightGroups = this.groupItemsByY(rightItems, effectiveMaxYDistance);

      // Combine and sort all groups by their average Y position
      const allGroups: TextItemGroupWithAverageY[] = [];

      for (const group of leftGroups) {
        allGroups.push({
          averageY: this.calculateAverageY(group),
          group,
        });
      }

      for (const group of rightGroups) {
        allGroups.push({
          averageY: this.calculateAverageY(group),
          group,
        });
      }

      allGroups.sort(
        (first, second) => second.averageY - first.averageY // Top to bottom
      );

      const sortedGroups: TextItem[][] = [];

      for (const { group } of allGroups) {
        sortedGroups.push(group);
      }

      return sortedGroups;
    } else {
      // Single column processing
      return this.groupItemsByY(textItems, effectiveMaxYDistance);
    }
  }

  private static isPageNumberItem(item: TextItem): boolean {
    return /^(?:page|\d+|of)$/i.test(item.text.trim());
  }

  private static calculateAverageY(group: TextItem[]): number {
    let yTotal = 0;

    for (const item of group) {
      yTotal += item.y;
    }

    return yTotal / group.length;
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
