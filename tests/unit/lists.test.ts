import { ListParser } from '../../src/parsers/lists.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

describe('ListParser', () => {
  test('does not treat generic experience lines as top skills', () => {
    const skills = ListParser.parseSkills(`
      Test User
      test@example.com

      Top Skills
      TypeScript
      Amazon Web Services (AWS)
      Northstar Solutions
      Principal Engineer
      2020 - 2024

      Languages
      English
    `);

    expect(skills).toEqual(['TypeScript', 'Amazon Web Services (AWS)']);
  });

  test('keeps content lines that begin with section-header words', () => {
    const skills = ListParser.parseSkills(`
      Top Skills
      TypeScript
      Experience with Kubernetes
      Education technology

      Languages
      English
    `);

    expect(skills).toEqual([
      'TypeScript',
      'Experience with Kubernetes',
      'Education technology',
    ]);
  });

  test('caps top skills at ten entries', () => {
    const skills = ListParser.parseSkills(`
      Top Skills
      Skill 1
      Skill 2
      Skill 3
      Skill 4
      Skill 5
      Skill 6
      Skill 7
      Skill 8
      Skill 9
      Skill 10
      Skill 11

      Languages
      English
    `);

    expect(skills).toHaveLength(10);
    expect(skills.at(-1)).toBe('Skill 10');
  });

  test('returns warnings for malformed language rows', () => {
    const result = ListParser.parseLanguagesWithWarnings(`
      Languages
      12345
      English (Native or Bilingual)
    `);

    expect(result.value).toEqual([
      {
        language: 'English',
        proficiency: 'Native or Bilingual',
      },
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'item',
        rawText: '12345',
        section: 'languages',
      }),
    ]);
  });

  test('does not turn repeated language headers into language entries', () => {
    const result = ListParser.parseLanguagesWithWarnings(`
      Languages
      Language
    `);

    expect(result.value).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'section',
        section: 'languages',
      }),
    ]);
  });

  test('extracts structural languages from their visual column only', () => {
    const result = ListParser.parseStructuralLanguagesWithWarnings([
      structuralLine({ column: 'right', text: 'Summary', y: 700 }),
      structuralLine({
        column: 'right',
        text: 'Builds product systems for operators.',
        y: 690,
      }),
      structuralLine({ column: 'left', text: 'Languages', y: 680 }),
      structuralLine({
        column: 'left',
        text: 'Português (Native or Bilingual)',
        y: 670,
      }),
      structuralLine({
        column: 'right',
        text: 'This summary line should not be parsed as a language.',
        y: 670,
      }),
      structuralLine({
        column: 'left',
        text: 'Inglês (Professional Working)',
        y: 660,
      }),
      structuralLine({ column: 'right', text: 'Experience', y: 650 }),
    ]);

    expect(result).toEqual({
      value: [
        {
          language: 'Português',
          proficiency: 'Native or Bilingual',
        },
        {
          language: 'Inglês',
          proficiency: 'Professional Working',
        },
      ],
      warnings: [],
    });
  });

  test('ignores blank skill rows and rejects proficiency-only languages', () => {
    const skills = ListParser.parseSkillsWithWarnings(`
      Top Skills

      TypeScript

      Languages
      English
    `);

    expect(skills).toEqual({
      value: ['TypeScript'],
      warnings: [],
    });
    expect(
      ListParser['extractLanguageInfo']('Native VeryVeryVeryLongLanguageName')
    ).toBeNull();
  });
});

function structuralLine({
  column,
  text,
  y,
}: {
  column: StructuralLine['column'];
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
