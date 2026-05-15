import { ExperienceStructuralParser } from '../../src/parsers/experience-structural.js';
import type {
  StructuralSection,
  TextItem,
} from '../../src/types/structural.js';

function textItem({
  text,
  y,
  fontSize = 12,
  x = 220,
}: {
  text: string;
  y: number;
  fontSize?: number;
  x?: number;
}): TextItem {
  return {
    text,
    x,
    y,
    fontSize,
    fontFamily: 'Helvetica',
    width: text.length * 5,
    height: fontSize,
  };
}

describe('ExperienceStructuralParser', () => {
  test('parses bounded right-column experience entries and ignores education', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Research Systems Group', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - March 2024 (4 years)', y: 630 }),
      textItem({ text: 'Austin, TX', y: 610 }),
      textItem({ text: 'Built data products for enterprise teams.', y: 590 }),
      textItem({ text: 'Education', y: 500, fontSize: 16 }),
      textItem({ text: 'State University', y: 480 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.organization).toBe('Research Systems Group');
    expect(experience.positions).toEqual([
      {
        title: 'Principal Engineer',
        duration: 'January 2020 - March 2024',
        location: 'Austin, TX',
        description: 'Built data products for enterprise teams.',
      },
    ]);
  });

  test('does not promote likely person-name lines to organizations', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Morgan Taylor', y: 670 }),
      textItem({ text: 'Software Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2022', y: 630 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([]);
  });

  test('detects generic organizations without a source allowlist', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Staff Platform Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2021 - 2024', y: 630 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.organization).toBe('Northstar Solutions');
    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        title: 'Staff Platform Engineer',
        duration: '2021 - 2024',
      })
    );
  });

  test('ignores page footers between role details', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Staff Platform Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2021 - 2024', y: 630 }),
      textItem({ text: 'Page 1 of 2', y: 620 }),
      textItem({ text: 'Austin, TX', y: 610 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.organization).toBe('Northstar Solutions');
    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        duration: '2021 - 2024',
        location: 'Austin, TX',
        title: 'Staff Platform Engineer',
      })
    );
  });

  test('keeps organization suffix terms when cleaning names', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Research Systems Group', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - March 2024', y: 630 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.organization).toBe('Research Systems Group');
  });

  test('extracts fallback duration text from noisy date lines', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Research Systems Group', y: 670 }),
      textItem({ text: 'Researcher', y: 650, fontSize: 11.5 }),
      textItem({ text: 'Provided support from 2019 - 2021', y: 630 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions[0].duration).toBe('2019 - 2021');
  });

  test('uses localized section headers and accented organization names', () => {
    const items = [
      textItem({ text: 'Experiência', y: 700, fontSize: 16 }),
      textItem({ text: 'Ação Labs', y: 670 }),
      textItem({ text: 'Engenheiro de Software', y: 650, fontSize: 11.5 }),
      textItem({ text: 'janeiro de 2020 - março de 2024', y: 630 }),
      textItem({ text: 'Formação', y: 500, fontSize: 16 }),
      textItem({ text: 'Universidade Exemplo', y: 480 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.organization).toBe('Ação Labs');
    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        title: 'Engenheiro de Software',
        duration: 'janeiro de 2020 - março de 2024',
      })
    );
  });

  test('preserves current experience when an organization section cannot be cleaned', () => {
    const sections: StructuralSection[] = [
      structuralSection({
        text: 'Research Systems Group',
        type: 'organization',
      }),
      structuralSection({
        text: 'Principal Engineer',
        type: 'position',
      }),
      structuralSection({
        text: '2020 - 2024',
        type: 'duration',
      }),
      structuralSection({
        text: 'Austin, TX',
        type: 'organization',
      }),
      structuralSection({
        text: 'Kept platform work moving.',
        type: 'description',
      }),
    ];

    const [experience] =
      ExperienceStructuralParser['buildWorkExperiences'](sections);

    expect(experience).toEqual({
      organization: 'Research Systems Group',
      positions: [
        {
          description: 'Austin, TX Kept platform work moving.',
          duration: '2020 - 2024',
          title: 'Principal Engineer',
        },
      ],
      totalDuration: undefined,
    });
  });

  test('compacts spaced state abbreviations in locations', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Research Systems Group', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2024', y: 630 }),
      textItem({ text: 'New Y ork, N Y', y: 610 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        location: 'New York, NY',
      })
    );
  });
});

function structuralSection({
  text,
  type,
}: {
  text: string;
  type: StructuralSection['type'];
}): StructuralSection {
  return {
    confidence: 1,
    fontSize: 12,
    text,
    type,
    y: 0,
  };
}
