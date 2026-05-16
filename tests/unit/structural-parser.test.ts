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

    const layout = StructuralParser['detectLayout']([
      ...leftItems,
      ...rightItems,
    ]);
    const groups = StructuralParser.groupTextByProximity(
      [...leftItems, ...rightItems],
      5
    );

    expect(layout.type).toBe('two-column');
    expect(groups).toHaveLength(47);
    expect(
      groups.every(
        group =>
          group.every(groupItem => groupItem.x < 150) ||
          group.every(groupItem => groupItem.x >= 150)
      )
    ).toBe(true);
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
});
