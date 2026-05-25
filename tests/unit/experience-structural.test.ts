import { ExperienceStructuralParser } from '../../src/parsers/experience-structural.js';
import type {
  StructuralSection,
  TextItem,
} from '../../src/types/structural.js';
import type { NormalizedParserLine } from '../../src/utils/parser-lines.js';

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
          durationText: '4 years',
          originalText: 'January 2020 - March 2024 (4 years)',
          start: {
            iso: '2020-01',
            precision: 'month',
            text: 'January 2020',
          },
          end: {
            iso: '2024-03',
            precision: 'month',
            text: 'March 2024',
          },
          kind: 'completed',
        },
        location: 'Austin, TX',
        description: 'Built data products for enterprise teams.',
      },
    ]);
  });

  test('parses academic multi-position entries without empty organizations', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'UCLA', y: 670 }),
      textItem({ text: '7 years 11 months', y: 650 }),
      textItem({ text: 'Associate Professor', y: 630, fontSize: 11.5 }),
      textItem({ text: 'July 2024 - Present (1 year 11 months)', y: 610 }),
      textItem({ text: 'Assistant Professor', y: 580, fontSize: 11.5 }),
      textItem({ text: 'July 2018 - July 2024 (6 years 1 month)', y: 560 }),
      textItem({ text: 'Los Angeles CA', y: 540 }),
      textItem({ text: 'Visual Machines Group', y: 500 }),
      textItem({ text: 'Leader', y: 480, fontSize: 11.5 }),
      textItem({ text: 'July 2018 - Present (7 years 11 months)', y: 460 }),
      textItem({ text: 'Intrinsic', y: 420 }),
      textItem({ text: 'Research Scientist', y: 400, fontSize: 11.5 }),
      textItem({ text: 'May 2022 - November 2023 (1 year 7 months)', y: 380 }),
      textItem({ text: 'MIT Media Lab', y: 340 }),
      textItem({ text: 'Research Assistant', y: 320, fontSize: 11.5 }),
      textItem({
        text: 'September 2012 - May 2018 (5 years 9 months)',
        y: 300,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'UCLA',
        positions: [
          expect.objectContaining({
            duration: 'July 2024 - Present',
            title: 'Associate Professor',
          }),
          expect.objectContaining({
            duration: 'July 2018 - July 2024',
            location: 'Los Angeles CA',
            title: 'Assistant Professor',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Visual Machines Group',
        positions: [
          expect.objectContaining({
            duration: 'July 2018 - Present',
            title: 'Leader',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Intrinsic',
        positions: [
          expect.objectContaining({
            duration: 'May 2022 - November 2023',
            title: 'Research Scientist',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'MIT Media Lab',
        positions: [
          expect.objectContaining({
            duration: 'September 2012 - May 2018',
            title: 'Research Assistant',
          }),
        ],
      }),
    ]);
  });

  test('preserves company total duration and duplicate dated positions', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Berufserfahrung', y: 700, fontSize: 16 }),
      textItem({ text: 'Wolske Wealth Management', y: 670 }),
      textItem({ text: '6 Jahre', y: 650 }),
      textItem({ text: 'CEO', y: 630, fontSize: 11.5 }),
      textItem({ text: '2020 - Present (6 Jahre)', y: 610 }),
      textItem({ text: 'Founder', y: 580, fontSize: 11.5 }),
      textItem({ text: '2020 - Present (6 Jahre)', y: 560 }),
    ]);

    expect(experience).toEqual(
      expect.objectContaining({
        organization: 'Wolske Wealth Management',
        totalDuration: '6 Jahre',
        positions: [
          expect.objectContaining({
            duration: '2020 - Present',
            title: 'CEO',
            dates: expect.objectContaining({
              durationText: '6 Jahre',
              originalText: '2020 - Present (6 Jahre)',
            }),
          }),
          expect.objectContaining({
            duration: '2020 - Present',
            title: 'Founder',
          }),
        ],
      })
    );
  });

  test('recognizes organizations before short domain-specific titles', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Horatius Group', y: 670 }),
      textItem({ text: 'Managing Director', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2016 - Present (10 years)', y: 630 }),
      textItem({ text: 'United States Marine Corps', y: 590 }),
      textItem({ text: 'Marine', y: 570, fontSize: 11.5 }),
      textItem({ text: 'May 2001 - September 2009 (8 years 5 months)', y: 550 }),
      textItem({ text: 'Fund Fellow Founders (fff.vc)', y: 510 }),
      textItem({ text: 'Angel Investor', y: 490, fontSize: 11.5 }),
      textItem({ text: 'October 2022 - Present (3 years 8 months)', y: 470 }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Horatius Group',
      }),
      expect.objectContaining({
        organization: 'United States Marine Corps',
        positions: [
          expect.objectContaining({
            title: 'Marine',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Fund Fellow Founders (fff.vc)',
        positions: [
          expect.objectContaining({
            title: 'Angel Investor',
          }),
        ],
      }),
    ]);
  });

  test('keeps prose with role verbs in descriptions when no date follows', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Mimosa Ventures', y: 670 }),
      textItem({ text: 'Founder', y: 650, fontSize: 11.5 }),
      textItem({ text: 'September 2024 - Present (1 year 9 months)', y: 630 }),
      textItem({ text: 'Dallas, TX', y: 610 }),
      textItem({
        text: "We don't lead rounds or demand board seats. When we invest, it's because",
        y: 590,
      }),
      textItem({
        text: 'we have conviction in the founder.',
        y: 570,
      }),
      textItem({ text: 'DallasMeetup', y: 530 }),
      textItem({ text: 'Executive Advisor', y: 510, fontSize: 11.5 }),
      textItem({ text: 'July 2025 - Present (11 months)', y: 490 }),
      textItem({
        text: "Executive advisor for Dallas's largest industry-agnostic networking event.",
        y: 470,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Mimosa Ventures',
        positions: [
          expect.objectContaining({
            description:
              "We don't lead rounds or demand board seats. When we invest, it's because we have conviction in the founder.",
            title: 'Founder',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'DallasMeetup',
        positions: [
          expect.objectContaining({
            description:
              "Executive advisor for Dallas's largest industry-agnostic networking event.",
            duration: 'July 2025 - Present',
            title: 'Executive Advisor',
          }),
        ],
      }),
    ]);
  });

  test('parses board-advisor organization names with lowercase connectors', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'More than Equal', y: 670 }),
      textItem({ text: 'Senior Advisor to the CEO', y: 650, fontSize: 11.5 }),
      textItem({ text: 'April 2026 - Present (2 months)', y: 630 }),
      textItem({ text: 'London Area, United Kingdom', y: 610 }),
      textItem({
        text: 'More than Equal is a global high-performance motorsport programme.',
        y: 590,
      }),
      textItem({ text: 'UNRSF – UN Road Safety Fund', y: 550 }),
      textItem({
        text: 'Member of the Board of Advisors',
        y: 530,
        fontSize: 11.5,
      }),
      textItem({ text: 'December 2025 - Present (6 months)', y: 510 }),
      textItem({ text: 'Geneva, Switzerland', y: 490 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'More than Equal',
        positions: [
          expect.objectContaining({
            duration: 'April 2026 - Present',
            location: 'London Area, United Kingdom',
            title: 'Senior Advisor to the CEO',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'UNRSF – UN Road Safety Fund',
        positions: [
          expect.objectContaining({
            duration: 'December 2025 - Present',
            location: 'Geneva, Switzerland',
            title: 'Member of the Board of Advisors',
          }),
        ],
      }),
    ]);
  });

  test('keeps valid single-column experience lines left of the raw x fallback', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Decorative right rail', x: 220, y: 720 }),
      textItem({ text: 'Experience', x: 90, y: 700, fontSize: 16 }),
      textItem({ text: 'Women in AI', x: 90, y: 670 }),
      textItem({ text: 'Advisor', x: 90, y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - Present (6 years)', x: 90, y: 630 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Women in AI',
        positions: [
          expect.objectContaining({
            duration: 'January 2020 - Present',
            title: 'Advisor',
          }),
        ],
      }),
    ]);
  });

  test('keeps short wrapped title continuations when a duration follows nearby', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Architect', y: 650, fontSize: 11.5 }),
      textItem({ text: 'AI', y: 630, fontSize: 11.5 }),
      textItem({ text: 'Remote', y: 610 }),
      textItem({ text: 'January 2020 - Present (6 years)', y: 590 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value[0]?.positions[0]).toEqual(
      expect.objectContaining({
        duration: 'January 2020 - Present',
        location: 'Remote',
        title: 'Principal Architect AI',
      })
    );
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

  test('recognizes short LinkedIn title vocabulary without turning titles into organizations', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'VDOSH', y: 670 }),
      textItem({ text: 'Managing Partner', y: 650, fontSize: 11.5 }),
      textItem({ text: 'April 2016 - Present', y: 630 }),
      textItem({ text: 'Greater Los Angeles Area', y: 610 }),
      textItem({ text: 'Alchemist Accelerator', y: 570 }),
      textItem({ text: 'Mentor', y: 550, fontSize: 11.5 }),
      textItem({ text: 'January 2018 - Present', y: 530 }),
      textItem({ text: 'Accenture', y: 490 }),
      textItem({
        text: 'Business & Technology Executive',
        y: 470,
        fontSize: 11.5,
      }),
      textItem({ text: 'March 2015 - January 2022', y: 450 }),
      textItem({ text: 'Zones', y: 410 }),
      textItem({ text: 'Sr. Web Programmer', y: 390, fontSize: 11.5 }),
      textItem({ text: 'August 2000 - September 2001', y: 370 }),
      textItem({ text: 'MOSUM Technology Pvt Ltd', y: 330 }),
      textItem({ text: 'Programmer', y: 310, fontSize: 11.5 }),
      textItem({ text: 'September 1998 - January 1999', y: 290 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'VDOSH',
        positions: [
          expect.objectContaining({
            duration: 'April 2016 - Present',
            location: 'Greater Los Angeles Area',
            title: 'Managing Partner',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Alchemist Accelerator',
        positions: [
          expect.objectContaining({
            duration: 'January 2018 - Present',
            title: 'Mentor',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Accenture',
        positions: [
          expect.objectContaining({
            duration: 'March 2015 - January 2022',
            title: 'Business & Technology Executive',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Zones',
        positions: [
          expect.objectContaining({
            duration: 'August 2000 - September 2001',
            title: 'Sr. Web Programmer',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'MOSUM Technology Pvt Ltd',
        positions: [
          expect.objectContaining({
            duration: 'September 1998 - January 1999',
            title: 'Programmer',
          }),
        ],
      }),
    ]);
  });

  test('keeps page-break role details with the organization that started before the footer', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Microsoft', y: 670 }),
      textItem({
        text: 'Software Design Engineer in Test',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: 'October 2002 - November 2008', y: 630 }),
      textItem({ text: 'Redmond, WA', y: 610 }),
      textItem({ text: '- Office Communication Server', y: 590 }),
      textItem({ text: '- Microsoft VISIO', y: 570 }),
      textItem({ text: 'Innosoft, Inc', y: 530 }),
      textItem({
        text: 'Sr. Programmer / Project Lead',
        y: 510,
        fontSize: 11.5,
      }),
      textItem({ text: 'Page 2 of 3', y: 490, fontSize: 9 }),
      textItem({ text: 'November 2001 - October 2002', y: -9300 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Microsoft',
        positions: [
          expect.objectContaining({
            description: '- Office Communication Server - Microsoft VISIO',
            location: 'Redmond, WA',
            title: 'Software Design Engineer in Test',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Innosoft, Inc',
        positions: [
          expect.objectContaining({
            duration: 'November 2001 - October 2002',
            title: 'Sr. Programmer / Project Lead',
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
            description: 'Worked as a Researcher in renewable energy projects.',
            duration: 'December 2006 - April 2010',
            location:
              'Av. Horácio Macedo, 354 - Cidade Universitária - Rio de Janeiro - RJ, 21941-911',
            title:
              'Technical Researcher – Automation and Robotics (Contractor)',
          }),
        ],
      })
    );
  });

  test('recognizes dotted address prefixes before spaces', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Research Systems Group', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2024', y: 630 }),
      textItem({ text: 'Rd. 10', y: 610 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        location: 'Rd. 10',
      })
    );
  });

  test('normalizes the full joined split location', () => {
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
        text: 'New Y',
        type: 'location',
      }),
      structuralSection({
        text: 'ork, N Y',
        type: 'location',
      }),
    ];

    const [experience] =
      ExperienceStructuralParser['buildWorkExperiences'](sections);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        location: 'New York, NY',
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

  test('keeps producer roles under the current organization and preserves short description continuations', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({
        text: 'Discovery Communications / Fischer Productions',
        y: 670,
      }),
      textItem({
        text: "Post Production Supervisor, KING'S OF CRASH",
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: 'November 2012 - January 2013', y: 630 }),
      textItem({ text: 'Park City, UT', y: 610 }),
      textItem({
        text: 'Executive Produced by Alexander Campbell & Naomi Steinberg',
        y: 590,
      }),
      textItem({
        text: "Producer, KING'S OF CRASH",
        y: 560,
        fontSize: 11.5,
      }),
      textItem({ text: 'October 2012 - November 2012', y: 540 }),
      textItem({ text: 'Park City, UT', y: 520 }),
      textItem({
        text: 'subject matter I helped actively develop story through field interviewing of',
        y: 500,
      }),
      textItem({ text: 'characters.', y: 480 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience).toEqual(
      expect.objectContaining({
        organization: 'Discovery Communications / Fischer Productions',
        positions: [
          expect.objectContaining({
            description:
              'Executive Produced by Alexander Campbell & Naomi Steinberg',
            duration: 'November 2012 - January 2013',
            location: 'Park City, UT',
            title: "Post Production Supervisor, KING'S OF CRASH",
          }),
          expect.objectContaining({
            description:
              'subject matter I helped actively develop story through field interviewing of characters.',
            duration: 'October 2012 - November 2012',
            location: 'Park City, UT',
            title: "Producer, KING'S OF CRASH",
          }),
        ],
      })
    );
  });

  test('keeps short description fragments after short location lines', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Acme Labs', y: 670 }),
      textItem({ text: 'Engineering Manager', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2021', y: 630 }),
      textItem({ text: 'Remote', y: 610 }),
      textItem({ text: 'led rollout.', y: 590 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        description: 'led rollout.',
        duration: '2020 - 2021',
        location: 'Remote',
        title: 'Engineering Manager',
      }),
    ]);
  });

  test('accepts dotted position titles and lowercase location markers', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Acme Labs', y: 670 }),
      textItem({ text: 'Manager.', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2021', y: 630 }),
      textItem({ text: 'remote', y: 610 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        duration: '2020 - 2021',
        location: 'remote',
        title: 'Manager.',
      }),
    ]);
  });

  test('classifies Colorado state abbreviation as a location', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Acme Labs', y: 670 }),
      textItem({ text: 'Staff Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2022', y: 630 }),
      textItem({ text: 'Denver, CO', y: 610 }),
      textItem({ text: 'Built internal systems for support teams.', y: 590 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        description: 'Built internal systems for support teams.',
        location: 'Denver, CO',
        title: 'Staff Engineer',
      }),
    ]);
  });

  test('starts a new organization after a description ending with a preposition', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2021', y: 630 }),
      textItem({ text: 'Owned platform migrations and rollout of', y: 610 }),
      textItem({ text: 'Blue Oak Labs', y: 580 }),
      textItem({ text: 'Staff Engineer', y: 560, fontSize: 11.5 }),
      textItem({ text: '2022 - 2023', y: 540 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Northstar Solutions',
        positions: [
          expect.objectContaining({
            description: 'Owned platform migrations and rollout of',
            title: 'Principal Engineer',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Blue Oak Labs',
        positions: [
          expect.objectContaining({
            duration: '2022 - 2023',
            title: 'Staff Engineer',
          }),
        ],
      }),
    ]);
  });

  test.each([
    ['worked at', 'Client Sites', 'worked at Client Sites'],
    ['guided by', 'Senior Advisors', 'guided by Senior Advisors'],
    ['served on', 'Advisory Boards', 'served on Advisory Boards'],
  ])(
    'continues uppercase fragments after short preposition line "%s"',
    (firstFragment, secondFragment, expectedDescription) => {
      const items = [
        textItem({ text: 'Experience', y: 700, fontSize: 16 }),
        textItem({ text: 'Acme Labs', y: 670 }),
        textItem({ text: 'Engineering Manager', y: 650, fontSize: 11.5 }),
        textItem({ text: '2020 - 2021', y: 630 }),
        textItem({ text: 'Remote', y: 610 }),
        textItem({ text: firstFragment, y: 590 }),
        textItem({ text: secondFragment, y: 570 }),
      ];

      const [experience] = ExperienceStructuralParser.parseExperience(items);

      expect(experience.positions).toEqual([
        expect.objectContaining({
          description: expectedDescription,
          title: 'Engineering Manager',
        }),
      ]);
    }
  );

  test('keeps sentence-ending title words inside existing descriptions', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Community Relief Services', y: 670 }),
      textItem({ text: 'Director of Online Media', y: 650, fontSize: 11.5 }),
      textItem({ text: 'June 2008 - January 2012', y: 630 }),
      textItem({
        text: 'Full-time staff member, under the direction of the Secretary and Publishing',
        y: 610,
      }),
      textItem({ text: 'Manager.', y: 590 }),
      textItem({
        text: 'I oversaw paid and volunteer staff in the multimedia division.',
        y: 570,
      }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        description:
          'Full-time staff member, under the direction of the Secretary and Publishing Manager. I oversaw paid and volunteer staff in the multimedia division.',
        title: 'Director of Online Media',
      }),
    ]);
  });

  test('starts dotted position titles after complete description sentences', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Acme Labs', y: 670 }),
      textItem({ text: 'Staff Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2021', y: 630 }),
      textItem({ text: 'Remote', y: 610 }),
      textItem({
        text: 'Led distributed platform migrations across regions.',
        y: 590,
      }),
      textItem({ text: 'Manager.', y: 570, fontSize: 11.5 }),
      textItem({ text: '2022 - Present', y: 550 }),
      textItem({ text: 'Managed support operations.', y: 530 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        description: 'Led distributed platform migrations across regions.',
        duration: '2020 - 2021',
        location: 'Remote',
        title: 'Staff Engineer',
      }),
      expect.objectContaining({
        description: 'Managed support operations.',
        duration: '2022 - Present',
        title: 'Manager.',
      }),
    ]);
  });

  test('starts dotted organization names after existing descriptions', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Omnispace360', y: 670 }),
      textItem({ text: 'President', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2015 - December 2023', y: 630 }),
      textItem({
        text: 'We believe this is the final digital medium for conveying stories.',
        y: 610,
      }),
      textItem({ text: 'Golden Angle Productions, LLC.', y: 590 }),
      textItem({ text: 'Chief Executive Officer', y: 570, fontSize: 11.5 }),
      textItem({ text: 'April 2011 - March 2014', y: 550 }),
      textItem({
        text: 'Led talent acquisition and improved hiring signal over time.',
        y: 520,
      }),
      textItem({ text: 'Partiu Vantagens!', y: 500 }),
      textItem({ text: 'Head of Engineering', y: 480, fontSize: 11.5 }),
      textItem({ text: 'October 2015 - October 2017', y: 460 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Omnispace360',
        positions: [
          expect.objectContaining({
            description:
              'We believe this is the final digital medium for conveying stories.',
            title: 'President',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Golden Angle Productions, LLC.',
        positions: [
          expect.objectContaining({
            duration: 'April 2011 - March 2014',
            title: 'Chief Executive Officer',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Partiu Vantagens!',
        positions: [
          expect.objectContaining({
            duration: 'October 2015 - October 2017',
            title: 'Head of Engineering',
          }),
        ],
      }),
    ]);
  });

  test('keeps sentence-ending locations out of existing descriptions', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2021', y: 630 }),
      textItem({
        text: 'Led distributed platform migrations across regions.',
        y: 610,
      }),
      textItem({ text: 'Washington, D.C.', y: 590 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        description: 'Led distributed platform migrations across regions.',
        location: 'Washington, D.C.',
        title: 'Principal Engineer',
      })
    );
  });

  test('parses page-break descriptions, fellow roles, and greater area locations', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Hexagon Wireless', y: 670 }),
      textItem({ text: 'Co-Founder', y: 650, fontSize: 11.5 }),
      textItem({ text: 'November 2021 - January 2023', y: 630 }),
      textItem({
        text: 'Hexagon Wireless was a leader in building decentralized physical',
        y: 610,
      }),
      textItem({
        text: 'infrastructure networks and accelerating DePIN technologies in',
        y: 590,
      }),
      textItem({ text: 'the United States and Colombia.', y: 570 }),
      textItem({ text: 'International Monetary Fund', y: 540 }),
      textItem({ text: '2022 Youth Fellow', y: 520, fontSize: 11.5 }),
      textItem({ text: '2022 - 2022', y: 500 }),
      textItem({ text: 'Foreign Brief', y: 460 }),
      textItem({ text: 'Contributing Writer', y: 440, fontSize: 11.5 }),
      textItem({ text: 'February 2020 - August 2021', y: 420 }),
      textItem({ text: 'Page 1 of 2', y: 390, fontSize: 9 }),
      textItem({
        text: 'Weekly columns and interviews analyzing global geopolitical events and their',
        y: -9260,
      }),
      textItem({ text: 'implications.', y: -9280 }),
      textItem({ text: 'Bank of America Merrill Lynch', y: -9320 }),
      textItem({ text: 'Investment Advisor', y: -9340, fontSize: 11.5 }),
      textItem({ text: 'November 2017 - August 2018', y: -9360 }),
      textItem({
        text: 'Minneapolis, Minnesota, United States',
        y: -9380,
      }),
      textItem({ text: 'Inspire Medical $INSP IPO', y: -9400 }),
      textItem({
        text: 'Organisation for the Prohibition of Chemical Weapons (OPCW)',
        y: -9440,
      }),
      textItem({ text: 'Business Analyst', y: -9460, fontSize: 11.5 }),
      textItem({ text: 'June 2016 - December 2016', y: -9480 }),
      textItem({ text: 'The Hague Area, Netherlands', y: -9500 }),
      textItem({ text: 'Fermilab', y: -9540 }),
      textItem({ text: 'Student Manager', y: -9560, fontSize: 11.5 }),
      textItem({ text: 'October 2011 - October 2013', y: -9580 }),
      textItem({ text: 'Greater Minneapolis-St. Paul Area', y: -9600 }),
      textItem({ text: 'Education', y: -9700, fontSize: 16 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);
    const byOrganization = new Map(
      experiences.map(experience => [experience.organization, experience])
    );

    expect(
      byOrganization.get('Hexagon Wireless')?.positions[0]?.description
    ).toBe(
      'Hexagon Wireless was a leader in building decentralized physical infrastructure networks and accelerating DePIN technologies in the United States and Colombia.'
    );
    expect(
      byOrganization.get('International Monetary Fund')?.positions[0]
    ).toEqual(
      expect.objectContaining({
        duration: '2022 - 2022',
        title: '2022 Youth Fellow',
      })
    );
    expect(byOrganization.get('Foreign Brief')?.positions[0]).toEqual(
      expect.objectContaining({
        description:
          'Weekly columns and interviews analyzing global geopolitical events and their implications.',
        title: 'Contributing Writer',
      })
    );
    expect(
      byOrganization.get('Bank of America Merrill Lynch')?.positions[0]
    ).toEqual(
      expect.objectContaining({
        description: 'Inspire Medical $INSP IPO',
        title: 'Investment Advisor',
      })
    );
    expect(
      byOrganization.get(
        'Organisation for the Prohibition of Chemical Weapons (OPCW)'
      )?.positions[0]
    ).toEqual(
      expect.objectContaining({
        location: 'The Hague Area, Netherlands',
        title: 'Business Analyst',
      })
    );
    expect(byOrganization.get('Fermilab')?.positions[0]).toEqual(
      expect.objectContaining({
        location: 'Greater Minneapolis-St. Paul Area',
        title: 'Student Manager',
      })
    );
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

  test('parses bounded right-column lines without an explicit section header', () => {
    const items = [
      textItem({ text: 'Ignored Sidebar', x: 80, y: 670 }),
      textItem({ text: 'Outside Range Labs', y: 700 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2024', y: 630 }),
      textItem({ text: 'Ignored Later Labs', y: 550 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(
      items,
      680,
      580
    );

    expect(experience).toEqual(
      expect.objectContaining({
        organization: 'Northstar Solutions',
        positions: [
          expect.objectContaining({
            duration: '2020 - 2024',
            title: 'Principal Engineer',
          }),
        ],
      })
    );
  });

  test('drops organization total duration rows when no position title follows', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: '2020 - 2024', y: 650 }),
    ]);

    expect(result.value).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test('starts a replacement organization before any title appears', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Blue Oak Labs', y: 640 }),
      textItem({ text: 'Staff Engineer', y: 620, fontSize: 11.5 }),
      textItem({ text: '2021 - 2024', y: 600 }),
    ]);

    expect(experiences).toEqual([
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

  test('keeps locations that appear before dates on the current position', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'Austin, TX', y: 630 }),
      textItem({ text: '2020 - 2024', y: 610 }),
    ]);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        duration: '2020 - 2024',
        location: 'Austin, TX',
        title: 'Principal Engineer',
      }),
    ]);
  });

  test('splits consecutive position titles under the same organization', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Northstar Solutions', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'Engineering Manager', y: 630, fontSize: 11.5 }),
      textItem({ text: '2021 - 2024', y: 610 }),
    ]);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        duration: '',
        title: 'Principal Engineer',
      }),
      expect.objectContaining({
        duration: '2021 - 2024',
        title: 'Engineering Manager',
      }),
    ]);
  });

  test('normalizes fallback duration fragments when date parsing cannot', () => {
    expect(
      ExperienceStructuralParser['extractCleanDuration'](
        'Museum archive appointment 1888 - 1889'
      )
    ).toBe('1888 - 1889');
    expect(
      ExperienceStructuralParser['extractCleanDuration'](
        '• shipped in fiscal 1888 after launch'
      )
    ).toBe('fiscal 1888');
    expect(
      ExperienceStructuralParser['extractCleanDuration']('contract-to-hire')
    ).toBe('contract-to-hire');

    const longNonDateText =
      'served without explicit dates in a description that is too long to be treated like a compact duration value';

    expect(
      ExperienceStructuralParser['extractCleanDuration'](longNonDateText)
    ).toBe(longNonDateText);
  });

  test('reports unparseable non-profile date ranges separately from missing dates', () => {
    const warnings = ExperienceStructuralParser['createExperienceWarnings']([
      {
        organization: 'Archive Museum',
        positions: [
          {
            description: '',
            duration: '1888 - 1889',
            title: 'Cataloger',
          },
        ],
      },
    ]);

    expect(warnings).toEqual([
      expect.objectContaining({
        field: 'dates',
        message: 'Could not parse date range',
        rawText: '1888 - 1889',
      }),
    ]);
  });

  test('classifies sparse parser lines through fallback states', () => {
    const sections = ExperienceStructuralParser['classifyLines']([
      parserLine({ text: 'Experience' }),
      parserLine({ index: 1, text: '2020 - 2021' }),
      parserLine({ index: 2, text: 'Remote' }),
      parserLine({
        fontSize: 13,
        index: 3,
        text: 'Northstar Solutions',
      }),
      parserLine({ index: 4, text: 'Principal Engineer' }),
      parserLine({
        index: 5,
        text: 'A description line long enough to classify as prose.',
      }),
      parserLine({ index: 6, text: 'x' }),
    ]);

    expect(sections.map(section => section.type)).toEqual([
      'other',
      'duration',
      'location',
      'organization',
      'position',
      'description',
    ]);
  });

  test('covers fallback line classification outcomes directly', () => {
    expect(
      ExperienceStructuralParser['fallbackLineType']('Blue Oak Labs', 9, 0, [
        'Blue Oak Labs',
        'Staff Engineer',
        '2020 - 2022',
      ])
    ).toBe('organization');
    expect(
      ExperienceStructuralParser['fallbackLineType']('ok', 12, 0, ['ok'])
    ).toBe('other');
    expect(
      ExperienceStructuralParser['fallbackLineType'](
        'This description line is long enough to be treated as prose.',
        12,
        0,
        []
      )
    ).toBe('description');
  });

  test('classifies explicit states with missing optional structural metadata', () => {
    const organizationLine = parserLine({ text: 'Blue Oak Labs' });
    const otherLine = parserLine({ text: 'tiny' });
    const sentenceLine = parserLine({ text: 'Wrapped sentence.' });

    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [
          organizationLine,
          parserLine({ index: 1, text: 'Staff Engineer' }),
        ],
        index: 0,
        line: organizationLine,
        state: 'seeking_title',
      })
    ).toBe('organization');
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [otherLine],
        index: 0,
        line: otherLine,
        state: 'seeking_title',
      })
    ).toBe('other');
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [
          parserLine({
            text: 'Previous role description with enough context.',
          }),
          organizationLine,
          parserLine({ index: 2, text: 'Staff Engineer' }),
        ],
        index: 1,
        line: organizationLine,
        state: 'in_description',
      })
    ).toBe('organization');
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [sentenceLine],
        index: 0,
        line: sentenceLine,
        state: 'in_description',
      })
    ).toBe('other');
  });

  test('covers description continuation helpers directly', () => {
    expect(ExperienceStructuralParser['looksLikeDescriptionLine']('Tiny')).toBe(
      false
    );
    expect(
      ExperienceStructuralParser['looksLikeDescriptionLine'](
        'Migration rollout',
        'Owned migration planning for'
      )
    ).toBe(true);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionContinuationLine'](
        'continued rollout'
      )
    ).toBe(false);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionContinuationLine'](
        'Shipped safely.',
        'Owned migration planning with enough context'
      )
    ).toBe(true);
    expect(
      ExperienceStructuralParser[
        'looksLikeSentenceEndingDescriptionContinuationLine'
      ]('Manager.', 'This previous sentence is complete.')
    ).toBe(false);
  });

  test('handles orphan structural sections and optional position fields', () => {
    const experiences = ExperienceStructuralParser['buildWorkExperiences']([
      structuralSection({
        text: 'Austin, TX',
        type: 'organization',
      }),
      structuralSection({
        text: 'Principal Engineer',
        type: 'position',
      }),
      structuralSection({
        text: '2020 - 2021',
        type: 'duration',
      }),
      structuralSection({
        text: 'Remote',
        type: 'location',
      }),
      structuralSection({
        text: 'Northstar Solutions',
        type: 'organization',
      }),
      structuralSection({
        text: '2022 - 2024',
        type: 'duration',
      }),
      structuralSection({
        text: 'Austin, TX',
        type: 'location',
      }),
    ]);

    expect(experiences).toEqual([]);
    expect(
      ExperienceStructuralParser['buildWorkExperiences']([
        structuralSection({
          text: 'Principal Engineer',
          type: 'position',
        }),
        structuralSection({
          text: '2020 - 2021',
          type: 'duration',
        }),
        structuralSection({
          text: 'Staff Engineer',
          type: 'position',
        }),
      ])
    ).toEqual([]);
    expect(
      ExperienceStructuralParser['buildWorkExperiences']([
        structuralSection({
          text: 'Northstar Solutions',
          type: 'organization',
        }),
        structuralSection({
          text: '2020 - 2021',
          type: 'duration',
        }),
        structuralSection({
          text: '2022 - 2024',
          type: 'duration',
        }),
      ])
    ).toEqual([]);
    expect(
      ExperienceStructuralParser['completePosition']({
        descriptionLines: [],
        position: {
          title: 'Advisor',
        },
      })
    ).toEqual({
      description: '',
      duration: '',
      title: 'Advisor',
    });
    expect(
      ExperienceStructuralParser['completeWorkExperience']({
        descriptionLines: [],
        position: null,
        workExperience: {
          organization: 'Existing Roles',
          positions: [
            {
              description: '',
              duration: '',
              title: 'Advisor',
            },
          ],
        },
      })
    ).toEqual({
      organization: 'Existing Roles',
      positions: [
        {
          description: '',
          duration: '',
          title: 'Advisor',
        },
      ],
      totalDuration: undefined,
    });
    expect(
      ExperienceStructuralParser['completeWorkExperience']({
        descriptionLines: [],
        position: {
          duration: '',
          title: 'Advisor',
        },
        workExperience: {
          organization: 'No Existing Roles',
        },
      })
    ).toEqual({
      organization: 'No Existing Roles',
      positions: [
        {
          description: '',
          duration: '',
          title: 'Advisor',
        },
      ],
      totalDuration: undefined,
    });
  });

  test('covers organization, confidence, and duration fallback edges', () => {
    expect(
      ExperienceStructuralParser['looksLikeOrganization'](
        'International Research Systems Group Partners',
        9,
        0,
        [
          'International Research Systems Group Partners',
          'Staff Engineer',
          '2020 - 2022',
        ]
      )
    ).toBe(false);
    expect(
      ExperienceStructuralParser['calculateConfidence'](
        'Northstar Solutions',
        'organization',
        13
      )
    ).toBeCloseTo(0.9);
    expect(
      ExperienceStructuralParser['calculateConfidence'](
        'Present',
        'duration',
        12
      )
    ).toBe(0.5);
    expect(
      ExperienceStructuralParser['extractCleanDuration']('Launched in 2025')
    ).toBe('2025');
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

function parserLine({
  fontSize,
  index = 0,
  text,
  y,
}: {
  fontSize?: number;
  index?: number;
  text: string;
  y?: number;
}): NormalizedParserLine {
  return {
    ...(fontSize !== undefined ? { fontSize } : {}),
    ...(y !== undefined ? { y } : {}),
    index,
    section: 'experience',
    source: 'structural',
    text,
  };
}
