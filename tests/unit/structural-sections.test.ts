import { extractStructuralSectionLines } from '../../src/utils/structural-sections.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

describe('extractStructuralSectionLines', () => {
  test('stops collecting a section after a boundary header in the same column', () => {
    const result = extractStructuralSectionLines({
      section: 'education',
      structuralLines: [
        structuralLine({ text: 'Education', y: 700 }),
        structuralLine({ text: 'Example University', y: 680 }),
        structuralLine({ text: 'Courses', y: 660 }),
        structuralLine({ text: 'Course Detail', y: 640 }),
      ],
    });

    expect(result).toEqual({
      hasSection: true,
      lines: [expect.objectContaining({ text: 'Example University' })],
    });
  });
});

function structuralLine({
  column = 'right',
  text,
  y,
}: {
  column?: StructuralLine['column'];
  text: string;
  y: number;
}): StructuralLine {
  return {
    column,
    fontSize: 10,
    height: 10,
    text,
    width: text.length * 5,
    x: column === 'left' ? 20 : 220,
    y,
  };
}
