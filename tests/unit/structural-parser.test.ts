import { StructuralParser } from '../../src/parsers/structural-parser.js';
import { createStructuralLines } from '../../src/utils/structural-lines.js';
import type { TextItem } from '../../src/types/structural.js';

function item({
  text,
  x,
  y,
}: {
  text: string;
  x: number;
  y: number;
}): TextItem {
  return {
    text,
    x,
    y,
    fontSize: 10,
    fontFamily: 'Helvetica',
    width: text.length * 5,
    height: 10,
  };
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

    expect(layout).toEqual(
      expect.objectContaining({ type: 'single-column' })
    );
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
});
