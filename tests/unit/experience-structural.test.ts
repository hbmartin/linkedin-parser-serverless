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
