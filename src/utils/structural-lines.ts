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
    const existingItems = columns.get(column) ?? [];

    existingItems.push(item);
    columns.set(column, existingItems);
  }

  return Array.from(columns.entries())
    .flatMap(([column, columnItems]) =>
      groupItemsByY(columnItems, maxYDistance).map(group =>
        createStructuralLine(group, column)
      )
    )
    .sort((first, second) => second.y - first.y || first.x - second.x);
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

  for (const item of sortedItems) {
    const referenceY =
      currentGroup.length === 0
        ? item.y
        : currentGroup.reduce((sum, groupedItem) => sum + groupedItem.y, 0) /
          currentGroup.length;

    if (
      currentGroup.length > 0 &&
      Math.abs(referenceY - item.y) > maxYDistance
    ) {
      groups.push(currentGroup);
      currentGroup = [];
    }

    currentGroup.push(item);
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
      // Join split glyph artifacts like "A rticle" while preserving valid "I " phrases.
      .replace(
        /(?<![&\p{L}])\b(?!I\s)([\p{Lu}])\s+([\p{Ll}][\p{Ll}\p{M}]+)\b/gu,
        '$1$2'
      )
      .replace(/\b([\p{Lu}])\s+([\p{Lu}])\b/gu, '$1$2')
  );
  const xValues = sortedGroup.map(item => item.x);
  const yValues = sortedGroup.map(item => item.y);
  const fontSizes = sortedGroup.map(item => item.fontSize);
  const heights = sortedGroup.map(item => item.height);
  const pageIndexes = sortedGroup
    .map(item => item.pageIndex)
    .filter((pageIndex): pageIndex is number => pageIndex !== undefined);

  return {
    text,
    x: Math.min(...xValues),
    y: yValues.reduce((sum, y) => sum + y, 0) / yValues.length,
    ...(pageIndexes.length > 0 ? { pageIndex: Math.min(...pageIndexes) } : {}),
    fontSize:
      fontSizes.reduce((sum, fontSize) => sum + fontSize, 0) / fontSizes.length,
    width: Math.max(
      ...sortedGroup.map(item => item.x + item.width - Math.min(...xValues))
    ),
    height: Math.max(...heights),
    column,
  };
}
