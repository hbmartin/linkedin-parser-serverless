import { ExperienceParser } from '../../src/parsers/experience.js';

describe('ExperienceParser', () => {
  test('parses separate generic company, title, and duration lines', () => {
    const [experience] = ExperienceParser.parse(`
      Experience
      Northstar AI
      Principal Software Engineer
      2021 - 2024
      Austin, TX
      Built platform services for customer-facing products.

      Education
      Example University
    `);

    expect(experience).toEqual({
      title: 'Principal Software Engineer',
      company: 'Northstar AI',
      duration: '2021 - 2024',
      location: 'Austin, TX',
      description: 'Built platform services for customer-facing products.',
    });
  });

  test('stops parsing when the next section starts', () => {
    const experiences = ExperienceParser.parse(`
      Experience
      Example Systems
      Staff Engineer
      2020 - 2022

      Education
      Principal Engineer
      2023 - 2024
    `);

    expect(experiences).toHaveLength(1);
    expect(experiences[0]).toEqual(
      expect.objectContaining({
        title: 'Staff Engineer',
        company: 'Example Systems',
      })
    );
  });

  test('parses inline title and company entries', () => {
    const [experience] = ExperienceParser.parse(`
      Experience
      Product Manager at Blue Oak Labs
      2020 - 2022
      Led delivery for customer-facing products.
    `);

    expect(experience).toEqual({
      title: 'Product Manager',
      company: 'Blue Oak Labs',
      duration: '2020 - 2022',
      location: '',
      description: 'Led delivery for customer-facing products.',
    });
  });
});
