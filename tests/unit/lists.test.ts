import { ListParser } from '../../src/parsers/lists.js';

describe('ListParser', () => {
  test('does not treat generic experience lines as top skills', () => {
    const skills = ListParser.parseSkills(`
      Test User
      test@example.com

      Top Skills
      TypeScript
      Northstar Solutions
      Principal Engineer
      2020 - 2024

      Languages
      English
    `);

    expect(skills).toEqual(['TypeScript']);
  });
});
