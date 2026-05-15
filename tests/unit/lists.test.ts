import { ListParser } from '../../src/parsers/lists.js';

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
});
