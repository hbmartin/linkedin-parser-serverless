import type { LayoutInfo, TextItem } from '../types/structural.js';

export type StructuralColumn = 'left' | 'right' | 'single';

export interface GetTextItemStructuralColumnParams {
  item: TextItem;
  layout: LayoutInfo;
  fallbackColumn: StructuralColumn;
}

export function getTextItemStructuralColumn({
  fallbackColumn,
  item,
  layout,
}: GetTextItemStructuralColumnParams): StructuralColumn {
  const pageLayout =
    item.pageIndex === undefined
      ? undefined
      : layout.pageLayouts?.[item.pageIndex];
  const activeLayout = pageLayout ?? layout;

  if (
    activeLayout.type !== 'two-column' ||
    !activeLayout.sidebarBounds ||
    !activeLayout.mainBounds
  ) {
    return fallbackColumn;
  }

  const centerX = item.x + item.width / 2;

  return centerX <= activeLayout.sidebarBounds.right ||
    item.x < activeLayout.mainBounds.left
    ? 'left'
    : 'right';
}
