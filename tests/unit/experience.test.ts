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
      dates: {
        originalText: '2021 - 2024',
        start: {
          iso: '2021',
          precision: 'year',
          text: '2021',
        },
        end: {
          iso: '2024',
          precision: 'year',
          text: '2024',
        },
        kind: 'completed',
      },
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
      dates: {
        originalText: '2020 - 2022',
        start: {
          iso: '2020',
          precision: 'year',
          text: '2020',
        },
        end: {
          iso: '2022',
          precision: 'year',
          text: '2022',
        },
        kind: 'completed',
      },
      location: '',
      description: 'Led delivery for customer-facing products.',
    });
  });

  test('returns section warnings when an experience section has no complete entries', () => {
    const result = ExperienceParser.parseWithWarnings(`
      Experience
      Principal Engineer
      2020 - 2024
    `);

    expect(result.value).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'section_parse_warning',
        field: 'entry',
        section: 'experience',
      }),
    ]);
  });

  test('does not treat prose lines with years as durations', () => {
    const [experience] = ExperienceParser.parse(`
      Experience
      Northstar AI
      Principal Software Engineer
      2021 - 2024
      Built customer-facing systems in 2020 before leading platform work.
    `);

    expect(experience.duration).toBe('2021 - 2024');
    expect(experience.dates).toEqual({
      originalText: '2021 - 2024',
      start: {
        iso: '2021',
        precision: 'year',
        text: '2021',
      },
      end: {
        iso: '2024',
        precision: 'year',
        text: '2024',
      },
      kind: 'completed',
    });
    expect(experience.description).toBe(
      'Built customer-facing systems in 2020 before leading platform work.'
    );
  });

  test('normalizes irregular spaces around duration separators', () => {
    const [experience] = ExperienceParser.parse(`
      Experience
      Northstar AI
      Principal Software Engineer
      2021   -   2024
      Built customer-facing systems in 2020 before leading platform work.
    `);

    expect(experience.duration).toBe('2021 - 2024');
    expect(experience.description).toBe(
      'Built customer-facing systems in 2020 before leading platform work.'
    );
  });
});
