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
    expect(getParserLineSectionHeader('Coordonnées')).toEqual({
      kind: 'target',
      section: 'contact',
    });
    expect(getParserLineSectionHeader('Contatta')).toEqual({
      kind: 'target',
      section: 'contact',
    });
    expect(getParserLineSectionHeader('Forbindelse')).toEqual({
      kind: 'target',
      section: 'contact',
    });
    expect(getParserLineSectionHeader('Principales compétences')).toEqual({
      kind: 'target',
      section: 'top_skills',
    });
    expect(getParserLineSectionHeader('Competenze principali')).toEqual({
      kind: 'target',
      section: 'top_skills',
    });
    expect(getParserLineSectionHeader('Experiência')).toEqual({
      kind: 'target',
      section: 'experience',
    });
    expect(getParserLineSectionHeader('Expérience')).toEqual({
      kind: 'target',
      section: 'experience',
    });
    expect(getParserLineSectionHeader('Esperienza')).toEqual({
      kind: 'target',
      section: 'experience',
    });
    expect(getParserLineSectionHeader('Erfaring')).toEqual({
      kind: 'target',
      section: 'experience',
    });
    expect(getParserLineSectionHeader('Riepilogo')).toEqual({
      kind: 'target',
      section: 'summary',
    });
    expect(getParserLineSectionHeader('Utdanning')).toEqual({
      kind: 'target',
      section: 'education',
    });
    expect(getParserLineSectionHeader('Langues')).toEqual({
      kind: 'target',
      section: 'languages',
    });
    expect(getParserLineSectionHeader('Lingue')).toEqual({
      kind: 'target',
      section: 'languages',
    });
    expect(getParserLineSectionHeader('Språk')).toEqual({
      kind: 'target',
      section: 'languages',
    });
    expect(
      getParserLineSectionHeader('Licenze e certificazioni')
    ).toEqual({
      kind: 'target',
      section: 'certifications',
    });
    expect(getParserLineSectionHeader('Prix et distinctions')).toEqual({
      kind: 'target',
      section: 'honors_awards',
    });
    expect(getParserLineSectionHeader('Recommendations')).toEqual({
      kind: 'boundary',
    });
    expect(getParserLineSectionHeader('projects.')).toBeUndefined();
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
