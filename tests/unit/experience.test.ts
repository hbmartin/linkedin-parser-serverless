import { ExperienceParser } from '../../src/parsers/experience.js';

describe('ExperienceParser', () => {
  test('parses separate generic company, title, and duration lines', () => {
    const [experience] = ExperienceParser.parse(`
      Experience
      Northstar Solutions
      Principal Software Engineer
      2021 - 2024
      Austin, TX
      Built platform services for customer-facing products.

      Education
      Example University
    `);

    expect(experience).toEqual({
      title: 'Principal Software Engineer',
      company: 'Northstar Solutions',
      duration: '2021 - 2024',
      location: 'Austin, TX',
      description: 'Built platform services for customer-facing products.',
    });
  });
});
