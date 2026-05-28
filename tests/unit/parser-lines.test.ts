import {
  createTextParserLines,
  getParserLineSectionHeader,
} from '../../src/utils/parser-lines.js';

describe('parser line utilities', () => {
  test('detects normalized target and boundary section headers', () => {
    expect(getParserLineSectionHeader('Honors & Awards')).toEqual({
      kind: 'target',
      section: 'honors_awards',
    });
    expect(getParserLineSectionHeader('Experiência')).toEqual({
      kind: 'target',
      section: 'experience',
    });
    expect(getParserLineSectionHeader('Recommendations')).toEqual({
      kind: 'boundary',
    });
  });

  test('tracks active sections without treating long prose as a header', () => {
    const lines = createTextParserLines(
      [
        'Summary',
        'Built parser performance improvements across repeated profile text.',
        'Experience',
        'Principal Engineer',
      ].join('\n')
    );

    expect(lines.map(line => line.section)).toEqual([
      'other',
      'summary',
      'other',
      'experience',
    ]);
    expect(
      getParserLineSectionHeader(
        'Built parser performance improvements across repeated profile text.'
      )
    ).toBeUndefined();
  });
});
