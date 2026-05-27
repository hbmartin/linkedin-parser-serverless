import { ListParser } from '../../src/parsers/lists.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

describe('ListParser', () => {
  test('returns empty skills and no warnings when top skills section is absent', () => {
    expect(
      ListParser.parseSkillsWithWarnings(`
        Summary
        Builds product systems for operators.
      `)
    ).toEqual({
      value: [],
      warnings: [],
    });
  });

  test('warns when a detected top skills section has no valid skills', () => {
    const result = ListParser.parseSkillsWithWarnings(`
      Top Skills
      12345
      Page 2

      Languages
      English
    `);

    expect(result.value).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'item',
          rawText: '12345',
          section: 'top_skills',
        }),
        expect.objectContaining({
          field: 'item',
          rawText: 'Page 2',
          section: 'top_skills',
        }),
        expect.objectContaining({
          field: 'section',
          section: 'top_skills',
        }),
      ])
    );
  });

  test('does not treat generic experience lines as top skills', () => {
    const skills = ListParser.parseSkills(`
      Apollo Helios
      apollo@example.com

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

  test('returns no structural languages when language section is absent', () => {
    expect(
      ListParser.parseStructuralLanguagesWithWarnings([
        structuralLine({ column: 'left', text: 'Summary', y: 700 }),
        structuralLine({
          column: 'left',
          text: 'Builds product systems for operators.',
          y: 680,
        }),
      ])
    ).toEqual({
      value: [],
      warnings: [],
    });
  });

  test('merges wrapped structural languages and stops at honors boundary', () => {
    const result = ListParser.parseStructuralLanguagesWithWarnings([
      structuralLine({ column: 'left', text: 'Languages', y: 700 }),
      structuralLine({
        column: 'left',
        text: 'English (Native or Bilingual)',
        y: 680,
      }),
      structuralLine({
        column: 'left',
        text: 'Chinese (Traditional) (Limited',
        y: 660,
      }),
      structuralLine({ column: 'left', text: 'Working)', y: 640 }),
      structuralLine({ column: 'left', text: 'Honors-Awards', y: 620 }),
      structuralLine({ column: 'left', text: 'Dean Student Advisory', y: 600 }),
    ]);

    expect(result).toEqual({
      value: [
        {
          language: 'English',
          proficiency: 'Native or Bilingual',
        },
        {
          language: 'Chinese (Traditional)',
          proficiency: 'Limited Working',
        },
      ],
      warnings: [],
    });
  });

  test('merges parenthesized structural language continuations across three lines', () => {
    const result = ListParser.parseStructuralLanguagesWithWarnings([
      structuralLine({ column: 'left', text: 'Languages', y: 700 }),
      structuralLine({
        column: 'left',
        text: 'Chinese (Traditional)',
        y: 680,
      }),
      structuralLine({ column: 'left', text: '(Limited', y: 660 }),
      structuralLine({ column: 'left', text: 'Working)', y: 640 }),
      structuralLine({ column: 'left', text: 'Experience', y: 620 }),
    ]);

    expect(result).toEqual({
      value: [
        {
          language: 'Chinese (Traditional)',
          proficiency: 'Limited Working',
        },
      ],
      warnings: [],
    });
  });

  test('salvages unclosed structural language proficiency at section end', () => {
    const result = ListParser.parseStructuralLanguagesWithWarnings([
      structuralLine({ column: 'left', text: 'Languages', y: 700 }),
      structuralLine({ column: 'left', text: 'Portuguese (Limited', y: 680 }),
    ]);

    expect(result).toEqual({
      value: [
        {
          language: 'Portuguese',
          proficiency: 'Limited',
        },
      ],
      warnings: [],
    });
  });

  test('merges balanced parenthesized structural language continuations', () => {
    const result = ListParser.parseStructuralLanguagesWithWarnings([
      structuralLine({ column: 'left', text: 'Languages', y: 700 }),
      structuralLine({
        column: 'left',
        text: 'Chinese (Traditional)',
        y: 680,
      }),
      structuralLine({ column: 'left', text: '(Limited Working)', y: 660 }),
      structuralLine({ column: 'left', text: 'Experience', y: 640 }),
    ]);

    expect(result).toEqual({
      value: [
        {
          language: 'Chinese (Traditional)',
          proficiency: 'Limited Working',
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
    expect(ListParser.parseLanguages('Languages\nItalian')).toEqual([
      {
        language: 'Italian',
        proficiency: 'Unknown',
      },
    ]);
    expect(ListParser.parseLanguages('Languages\nNative Portuguese')).toEqual([
      {
        language: 'Portuguese',
        proficiency: 'Native',
      },
    ]);
    expect(
      ListParser.parseLanguages(
        'Languages\nNative VeryVeryVeryLongLanguageName'
      )
    ).toEqual([]);
  });

  test('ignores blank structural language rows', () => {
    const result = ListParser.parseStructuralLanguagesWithWarnings([
      structuralLine({ column: 'left', text: 'Languages', y: 700 }),
      structuralLine({ column: 'left', text: 'English', y: 680 }),
      structuralLine({ column: 'left', text: '  ', y: 660 }),
      structuralLine({ column: 'left', text: 'Experience', y: 640 }),
    ]);

    expect(result).toEqual({
      value: [
        {
          language: 'English',
          proficiency: 'Unknown',
        },
      ],
      warnings: [],
    });
  });

  test('accepts short hyphenated language variants without proficiencies', () => {
    const enDashLanguage = 'Chinese \u2013 Cantonese';
    const emDashLanguage = 'Chinese \u2014 Mandarin';
    const result = ListParser.parseStructuralLanguagesWithWarnings([
      structuralLine({ column: 'left', text: 'Languages', y: 700 }),
      structuralLine({ column: 'left', text: 'Chinese - Cantonese', y: 680 }),
      structuralLine({ column: 'left', text: enDashLanguage, y: 660 }),
      structuralLine({ column: 'left', text: emDashLanguage, y: 640 }),
      structuralLine({ column: 'left', text: 'Experience', y: 620 }),
    ]);

    expect(result).toEqual({
      value: [
        {
          language: 'Chinese - Cantonese',
          proficiency: 'Unknown',
        },
        {
          language: enDashLanguage,
          proficiency: 'Unknown',
        },
        {
          language: emDashLanguage,
          proficiency: 'Unknown',
        },
      ],
      warnings: [],
    });
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
