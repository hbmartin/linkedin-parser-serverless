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
        dates: {
          originalText: 'January 2020 - March 2024',
          start: {
            iso: '2020-01',
            precision: 'month',
            text: 'january 2020',
          },
          end: {
            iso: '2024-03',
            precision: 'month',
            text: 'march 2024',
          },
          kind: 'completed',
        },
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

  test('starts a new visual organization for person-shaped brand names after descriptions', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Staff Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2021 - 2024', y: 630 }),
      textItem({ text: 'Built internal systems.', y: 610 }),
      textItem({ text: 'Boba Joy', y: 580 }),
      textItem({ text: 'Investor & Advisor', y: 560, fontSize: 11.5 }),
      textItem({ text: 'November 2024 - Present', y: 540 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Northstar Solutions',
      }),
      expect.objectContaining({
        organization: 'Boba Joy',
        positions: [
          expect.objectContaining({
            duration: 'November 2024 - Present',
            title: 'Investor & Advisor',
          }),
        ],
      }),
    ]);
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
          dates: {
            originalText: '2020 - 2024',
            start: {
              iso: '2020',
              precision: 'year',
              text: '2020',
            },
            end: {
              iso: '2024',
              precision: 'year',
              text: '2024',
            },
            kind: 'completed',
          },
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

  test('keeps split address locations before contractor descriptions', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'CEPEL', y: 670 }),
      textItem({
        text: 'Technical Researcher – Automation and Robotics (Contractor)',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: 'December 2006 - April 2010', y: 630 }),
      textItem({
        text: 'Av. Horácio Macedo, 354 - Cidade Universitária - Rio de Janeiro - RJ,',
        y: 610,
      }),
      textItem({ text: '21941-911', y: 595 }),
      textItem({
        text: 'Worked as a Researcher in renewable energy projects.',
        y: 570,
      }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience).toEqual(
      expect.objectContaining({
        organization: 'CEPEL',
        positions: [
          expect.objectContaining({
            description:
              'Worked as a Researcher in renewable energy projects.',
            duration: 'December 2006 - April 2010',
            location:
              'Av. Horácio Macedo, 354 - Cidade Universitária - Rio de Janeiro - RJ, 21941-911',
            title: 'Technical Researcher – Automation and Robotics (Contractor)',
          }),
        ],
      })
    );
  });

  test('exposes warnings through the structural parser result API', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Research Systems Group', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
    ]);

    expect(result.value[0]).toEqual(
      expect.objectContaining({
        organization: 'Research Systems Group',
      })
    );
    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'dates',
        section: 'experience',
      }),
    ]);
  });

  test('starts a new organization while seeking missing dates', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'Blue Oak Labs', y: 620 }),
      textItem({ text: 'Staff Engineer', y: 600, fontSize: 11.5 }),
      textItem({ text: '2021 - 2024', y: 580 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Northstar Solutions',
        positions: [
          expect.objectContaining({
            title: 'Principal Engineer',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Blue Oak Labs',
        positions: [
          expect.objectContaining({
            duration: '2021 - 2024',
            title: 'Staff Engineer',
          }),
        ],
      }),
    ]);
  });

  test('uses unique warning entries for nested positions', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'Staff Engineer', y: 620, fontSize: 11.5 }),
      textItem({ text: 'Blue Oak Labs', y: 590 }),
      textItem({ text: 'Advisor', y: 570, fontSize: 11.5 }),
    ]);

    expect(result.warnings).toEqual([
      expect.objectContaining({ entry: 0, rawText: 'Principal Engineer' }),
      expect.objectContaining({ entry: 1, rawText: 'Staff Engineer' }),
      expect.objectContaining({ entry: 2, rawText: 'Advisor' }),
    ]);
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
