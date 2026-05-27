import type { LayoutInfo, TextItem } from '../types/structural.js';
import {
  getTextItemStructuralColumn,
  type StructuralColumn,
} from './structural-layout.js';
import { normalizeWhitespace } from './text-utils.js';

export interface StructuralLine {
  text: string;
  x: number;
  y: number;
  pageIndex?: number;
  fontSize: number;
  width: number;
  height: number;
  column: StructuralColumn;
}

export interface CreateStructuralLinesParams {
  textItems: TextItem[];
  layout: LayoutInfo;
  maxYDistance?: number;
}

export function createStructuralLines({
  textItems,
  layout,
  maxYDistance = 3,
}: CreateStructuralLinesParams): StructuralLine[] {
  const columns = new Map<StructuralColumn, TextItem[]>();

  for (const item of textItems) {
    const column = getStructuralColumn(item, layout);
    const existingItems = columns.get(column);

    if (existingItems) {
      existingItems.push(item);
    } else {
      columns.set(column, [item]);
    }
  }

  const lines: StructuralLine[] = [];

  for (const [column, columnItems] of columns) {
    for (const group of groupItemsByY(columnItems, maxYDistance)) {
      lines.push(createStructuralLine(group, column));
    }
  }

  return lines.sort(
    (first, second) => second.y - first.y || first.x - second.x
  );
}

function getStructuralColumn(
  item: TextItem,
  layout: LayoutInfo
): StructuralColumn {
  return getTextItemStructuralColumn({
    fallbackColumn: 'single',
    item,
    layout,
  });
}

function groupItemsByY(
  textItems: TextItem[],
  maxYDistance: number
): TextItem[][] {
  const sortedItems = [...textItems].sort((first, second) => {
    const yComparison = second.y - first.y;

    return yComparison === 0 ? first.x - second.x : yComparison;
  });
  const groups: TextItem[][] = [];
  let currentGroup: TextItem[] = [];
  let currentGroupYTotal = 0;

  for (const item of sortedItems) {
    const referenceY =
      currentGroup.length === 0
        ? item.y
        : currentGroupYTotal / currentGroup.length;

    if (
      currentGroup.length > 0 &&
      Math.abs(referenceY - item.y) > maxYDistance
    ) {
      groups.push(currentGroup);
      currentGroup = [];
      currentGroupYTotal = 0;
    }

    currentGroup.push(item);
    currentGroupYTotal += item.y;
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function createStructuralLine(
  group: TextItem[],
  column: StructuralColumn
): StructuralLine {
  const sortedGroup = [...group].sort((first, second) => first.x - second.x);
  const text = normalizeWhitespace(
    sortedGroup
      .map(item => item.text)
      .join(' ')
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/\b([\p{Lu}])\s+([\p{Lu}])\b/gu, '$1$2')
  );
  let minX = Number.POSITIVE_INFINITY;
  let yTotal = 0;
  let minPageIndex: number | undefined;
  let fontSizeTotal = 0;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;

  for (const item of sortedGroup) {
    minX = Math.min(minX, item.x);
    yTotal += item.y;

    if (item.pageIndex !== undefined) {
      minPageIndex =
        minPageIndex === undefined
          ? item.pageIndex
          : Math.min(minPageIndex, item.pageIndex);
    }

    fontSizeTotal += item.fontSize;
    maxRight = Math.max(maxRight, item.x + item.width);
    maxHeight = Math.max(maxHeight, item.height);
  }

  return {
    text,
    x: minX,
    y: yTotal / sortedGroup.length,
    ...(minPageIndex !== undefined ? { pageIndex: minPageIndex } : {}),
    fontSize: fontSizeTotal / sortedGroup.length,
    width: maxRight - minX,
    height: maxHeight,
    column,
  };
}
