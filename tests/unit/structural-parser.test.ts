import { StructuralParser } from '../../src/parsers/structural-parser.js';
import { createStructuralLines } from '../../src/utils/structural-lines.js';
import type { TextItem } from '../../src/types/structural.js';

function item({
  pageIndex,
  text,
  width,
  x,
  y,
}: {
  pageIndex?: number;
  text: string;
  width?: number;
  x: number;
  y: number;
}): TextItem {
  return {
    text,
    x,
    y,
    ...(pageIndex === undefined ? {} : { pageIndex }),
    fontSize: 10,
    fontFamily: 'Helvetica',
    width: width ?? text.length * 5,
    height: 10,
  };
}

function twoColumnPageItems(pageIndex: number): TextItem[] {
  const pageYOffset = pageIndex * -10000;
  const leftItems = Array.from({ length: 2 }, (_, index) =>
    item({
      pageIndex,
      text: `left ${pageIndex}-${index}`,
      x: 30,
      y: pageYOffset + 700 - index * 20,
    })
  );
  const rightItems = Array.from({ length: 15 }, (_, index) =>
    item({
      pageIndex,
      text: `right ${pageIndex}-${index}`,
      x: 220,
      y: pageYOffset + 700 - index * 20,
    })
  );

  return [...leftItems, ...rightItems];
}

describe('StructuralParser', () => {
  test('treats exactly ten left-column items as a two-column layout', () => {
    const leftItems = Array.from({ length: 10 }, (_, index) =>
      item({ text: `left ${index}`, x: 40, y: 700 - index * 20 })
    );
    const rightItems = Array.from({ length: 21 }, (_, index) =>
      item({ text: `right ${index}`, x: 220, y: 700 - index * 20 })
    );

    const groups = StructuralParser.groupTextByProximity(
      [...leftItems, ...rightItems],
      5
    );

    expect(
      groups.every(
        group =>
          group.every(groupItem => groupItem.x < 150) ||
          group.every(groupItem => groupItem.x >= 150)
      )
    ).toBe(true);
  });

  test('treats compact seven-item sidebars as a two-column layout', () => {
    const leftItems = Array.from({ length: 7 }, (_, index) =>
      item({ text: `left ${index}`, x: 22, y: 700 - index * 20 })
    );
    const rightItems = Array.from({ length: 40 }, (_, index) =>
      item({ text: `right ${index}`, x: 224, y: 700 - index * 20 })
    );

    const groups = StructuralParser.groupTextByProximity(
      [...leftItems, ...rightItems],
      5
    );

    expect(groups).toHaveLength(47);
    expect(
      groups.every(
        group =>
          group.every(groupItem => groupItem.x < 150) ||
          group.every(groupItem => groupItem.x >= 150)
      )
    ).toBe(true);
  });

  test('keeps narrow column gaps as a single-column layout', () => {
    const leftItems = Array.from({ length: 7 }, (_, index) => ({
      ...item({ text: `left ${index}`, x: 40, y: 700 - index * 20 }),
      width: 0,
    }));
    const rightItems = Array.from({ length: 21 }, (_, index) =>
      item({ text: `right ${index}`, x: 155, y: 700 - index * 20 })
    );

    const layout = StructuralParser['detectLayout']([
      ...leftItems,
      ...rightItems,
    ]);

    expect(layout).toEqual(expect.objectContaining({ type: 'single-column' }));
  });

  test('keeps extended sidebar labels out of the main column', () => {
    const leftItems = [
      item({ text: 'Contact', x: 22, y: 740 }),
      item({ text: 'medium.com/@example', x: 22, y: 700 }),
      item({ text: '(Blog)', x: 159, y: 700 }),
      item({ text: 'Top Skills', x: 22, y: 660 }),
      item({ text: 'Early Stage Investment', x: 22, y: 640 }),
    ];
    const rightItems = Array.from({ length: 20 }, (_, index) =>
      item({
        text: index === 0 ? 'Summary' : `Main summary line ${index}`,
        x: 224,
        y: 720 - index * 18,
      })
    );
    const layout = StructuralParser.detectLayout([...leftItems, ...rightItems]);
    const lines = createStructuralLines({
      layout,
      textItems: [...leftItems, ...rightItems],
    });

    expect(layout.type).toBe('two-column');
    expect(
      lines.find(line => line.text === 'medium.com/@example (Blog)')
    ).toEqual(expect.objectContaining({ column: 'left' }));
    expect(lines.find(line => line.text === 'Summary')).toEqual(
      expect.objectContaining({ column: 'right' })
    );
  });

  test('keeps page layouts aligned with sparse page indexes', () => {
    const singleColumnPageItem = item({
      pageIndex: 2,
      text: 'Single page content',
      x: 30,
      y: -19300,
    });
    const textItems = [...twoColumnPageItems(0), singleColumnPageItem];
    const layout = StructuralParser.detectLayout(textItems);
    const lines = createStructuralLines({
      layout,
      textItems: [singleColumnPageItem],
    });

    expect(layout.type).toBe('two-column');
    expect(layout.pageLayouts?.[0]?.type).toBe('two-column');
    expect(layout.pageLayouts?.[1]).toBeUndefined();
    expect(layout.pageLayouts?.[2]?.type).toBe('single-column');
    expect(lines).toEqual([
      expect.objectContaining({
        column: 'single',
        text: 'Single page content',
      }),
    ]);
  });

  test('infers one-based flattened page offsets from negative y values', () => {
    const pageOneItems = twoColumnPageItems(1).map(
      ({ pageIndex: _pageIndex, ...pageItem }) => pageItem
    );
    const layout = StructuralParser.detectLayout(pageOneItems);

    expect(layout.type).toBe('two-column');
    expect(layout.pageLayouts?.[0]).toBeUndefined();
    expect(layout.pageLayouts?.[1]?.type).toBe('two-column');
  });

  test('returns no groups or structural lines for empty inputs', () => {
    expect(StructuralParser.groupTextByProximity([])).toEqual([]);
    expect(
      createStructuralLines({
        layout: {
          type: 'single-column',
        },
        textItems: [],
      })
    ).toEqual([]);
  });

  test('sorts structural lines with the same y position by x position', () => {
    const lines = createStructuralLines({
      layout: {
        type: 'two-column',
        sidebarBounds: {
          left: 20,
          right: 100,
          top: 700,
          bottom: 700,
        },
        mainBounds: {
          left: 220,
          right: 300,
          top: 700,
          bottom: 700,
        },
      },
      textItems: [
        item({ text: 'Right', x: 220, y: 700 }),
        item({ text: 'Left', x: 20, y: 700 }),
      ],
    });

    expect(lines.map(line => line.text)).toEqual(['Left', 'Right']);
  });

  test('does not join the pronoun I into the following word', () => {
    const lines = createStructuralLines({
      layout: {
        type: 'single-column',
      },
      textItems: [
        item({ text: 'I', x: 220, y: 700 }),
        item({ text: 'lead', x: 230, y: 700 }),
      ],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('I lead');
  });

  test('does not join single-letter domain acronyms into the following word', () => {
    const lines = createStructuralLines({
      layout: {
        type: 'single-column',
      },
      textItems: [
        item({ text: 'Series', x: 220, y: 700 }),
        item({ text: 'A', x: 260, y: 700 }),
        item({ text: 'interest', x: 270, y: 700 }),
        item({ text: 'Model', x: 220, y: 680 }),
        item({ text: 'Y', x: 260, y: 680 }),
        item({ text: 'production', x: 270, y: 680 }),
        item({ text: 'Gen', x: 220, y: 660 }),
        item({ text: 'Z', x: 250, y: 660 }),
        item({ text: 'brand', x: 260, y: 660 }),
        item({ text: 'S/S', x: 220, y: 640 }),
        item({ text: 'collection', x: 250, y: 640 }),
      ],
    });

    expect(lines.map(line => line.text)).toEqual([
      'Series A interest',
      'Model Y production',
      'Gen Z brand',
      'S/S collection',
    ]);
  });

  test('does not join words after ampersand abbreviations', () => {
    const lines = createStructuralLines({
      layout: {
        type: 'single-column',
      },
      textItems: [
        item({ text: 'P&L', x: 220, y: 700 }),
        item({ text: 'management', x: 245, y: 700 }),
      ],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('P&L management');
  });

  test('uses global two-column detection when individual pages are too sparse', () => {
    const sparsePageItems = [0, 1].flatMap(pageIndex => {
      const pageYOffset = pageIndex * -10000;

      return [
        item({
          pageIndex,
          text: `left ${pageIndex}`,
          x: 30,
          y: pageYOffset + 700,
        }),
        ...Array.from({ length: 8 }, (_, index) =>
          item({
            pageIndex,
            text: `right ${pageIndex}-${index}`,
            x: 220,
            y: pageYOffset + 700 - index * 20,
          })
        ),
      ];
    });

    const layout = StructuralParser.detectLayout(sparsePageItems);

    expect(layout.type).toBe('two-column');
    expect(layout.pageLayouts?.every(page => page.type === 'single-column')).toBe(
      true
    );
  });

  test('rejects two-column layouts with insufficient visual gap', () => {
    const leftItems = Array.from({ length: 2 }, (_, index) =>
      item({
        text: `left ${index}`,
        width: 160,
        x: 30,
        y: 700 - index * 20,
      })
    );
    const rightItems = Array.from({ length: 15 }, (_, index) =>
      item({ text: `right ${index}`, x: 190, y: 700 - index * 20 })
    );

    expect(StructuralParser.detectLayout([...leftItems, ...rightItems])).toEqual(
      expect.objectContaining({ type: 'single-column' })
    );
  });

  test('covers empty bounds merging and default proximity grouping', () => {
    expect(StructuralParser['mergeBounds']([undefined])).toBeUndefined();
    expect(
      StructuralParser['groupItemsByY']([
        item({ text: 'A', x: 10, y: 700 }),
        item({ text: 'B', x: 20, y: 696 }),
        item({ text: 'C', x: 20, y: 680 }),
      ])
    ).toHaveLength(2);
  });

  test('falls back when a left-column item has no measured width', () => {
    const leftItems = [
      item({ text: 'left 0', width: 0, x: 30, y: 700 }),
      item({ text: 'left 1', x: 30, y: 680 }),
    ];
    const rightItems = Array.from({ length: 15 }, (_, index) =>
      item({ text: `right ${index}`, x: 220, y: 700 - index * 20 })
    );

    expect(StructuralParser.detectLayout([...leftItems, ...rightItems])).toEqual(
      expect.objectContaining({
        sidebarBounds: expect.objectContaining({
          right: 130,
        }),
        type: 'two-column',
      })
    );
  });
});
