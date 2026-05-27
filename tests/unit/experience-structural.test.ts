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

  test('keeps prose description before acquisition-qualified organization boundary', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 760, fontSize: 16 }),
      textItem({ text: 'Intrinsic', y: 730 }),
      textItem({ text: 'Page 1 of 2', y: 710, fontSize: 9 }),
      textItem({ text: 'Research Scientist', y: 690, fontSize: 11.5 }),
      textItem({ text: 'May 2022 - November 2023 (1 year 7 months)', y: 670 }),
      textItem({
        text: 'Intrinsic is an AI Research Group at Google',
        y: 650,
        fontSize: 10.5,
      }),
      textItem({
        text: 'Akasha Imaging (Acquired, now part of Alphabet)',
        y: 610,
      }),
      textItem({ text: 'Co-Founder (Acquired)', y: 590, fontSize: 11.5 }),
      textItem({ text: '2019 - May 2022 (3 years)', y: 570 }),
      textItem({ text: 'Palo Alto, CA', y: 550 }),
      textItem({
        text: "Startup backed by Khosla Ventures. Founded in '19 and acquired in '22 (now",
        y: 530,
      }),
      textItem({ text: 'part of Intrinsic / Google).', y: 510 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Intrinsic',
        positions: [
          expect.objectContaining({
            description: 'Intrinsic is an AI Research Group at Google',
            duration: 'May 2022 - November 2023',
            title: 'Research Scientist',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Akasha Imaging (Acquired, now part of Alphabet)',
        positions: [
          expect.objectContaining({
            description:
              "Startup backed by Khosla Ventures. Founded in '19 and acquired in '22 (now part of Intrinsic / Google).",
            duration: '2019 - May 2022',
            location: 'Palo Alto, CA',
            title: 'Co-Founder (Acquired)',
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
      textItem({
        text: 'May 2001 - September 2009 (8 years 5 months)',
        y: 550,
      }),
      textItem({ text: 'Fund Fellow Founders (FFF.VC)', y: 510 }),
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
        organization: 'Fund Fellow Founders (FFF.VC)',
        positions: [
          expect.objectContaining({
            title: 'Angel Investor',
          }),
        ],
      }),
    ]);
  });

  test('recognizes lower-camel organizations with lowercase suffixes', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'xLabs llc', y: 670 }),
      textItem({ text: 'Principal Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - Present (6 years)', y: 630 }),
    ]);

    expect(experience.organization).toBe('xLabs llc');
    expect(experience.positions[0]?.title).toBe('Principal Engineer');
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

  test('keeps short media descriptors inside experience descriptions', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Fulldome Film Society', y: 670 }),
      textItem({
        text: 'Producer, “MYSTERY OF THE KUMBH MELA"',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: 'February 2013 - April 2013 (3 months)', y: 630 }),
      textItem({ text: 'Directed by Apollo Phoebus', y: 610 }),
      textItem({ text: 'Feature Film', y: 590 }),
      textItem({
        text: 'Scouted to find story subjects and conducted pre-interviews for back story',
        y: 570,
      }),
      textItem({
        text: 'Discovery Communications / Fischer Productions',
        y: 530,
      }),
      textItem({ text: '4 months', y: 510 }),
      textItem({
        text: "Post Production Supervisor, KING'S OF CRASH",
        y: 490,
        fontSize: 11.5,
      }),
      textItem({ text: 'November 2012 - January 2013 (3 months)', y: 470 }),
      textItem({ text: 'Park City, UT', y: 450 }),
      textItem({
        text: 'Executive Produced by Achilles Pelides & Circe Aeaea',
        y: 430,
      }),
      textItem({ text: 'Television Series', y: 410 }),
      textItem({ text: 'Areas of responsibility included:', y: 390 }),
      textItem({
        text: '• Maintenance of daily operation of the Facilis server and editor workstations',
        y: 370,
      }),
      textItem({
        text: "Producer, KING'S OF CRASH",
        y: 330,
        fontSize: 11.5,
      }),
      textItem({ text: 'October 2012 - November 2012 (2 months)', y: 310 }),
      textItem({ text: 'Park City, UT', y: 290 }),
      textItem({
        text: 'Executive Produced by Achilles Pelides & Circe Aeaea',
        y: 270,
      }),
      textItem({ text: 'Television Series', y: 250 }),
      textItem({
        text: 'I was a primary shooter/field producer on a fast-paced reality television series',
        y: 230,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Fulldome Film Society',
        positions: [
          expect.objectContaining({
            description:
              'Directed by Apollo Phoebus Feature Film Scouted to find story subjects and conducted pre-interviews for back story',
            title: 'Producer, “MYSTERY OF THE KUMBH MELA"',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Discovery Communications / Fischer Productions',
        positions: [
          expect.objectContaining({
            description:
              'Executive Produced by Achilles Pelides & Circe Aeaea Television Series Areas of responsibility included: • Maintenance of daily operation of the Facilis server and editor workstations',
            title: "Post Production Supervisor, KING'S OF CRASH",
          }),
          expect.objectContaining({
            description:
              'Executive Produced by Achilles Pelides & Circe Aeaea Television Series I was a primary shooter/field producer on a fast-paced reality television series',
            title: "Producer, KING'S OF CRASH",
          }),
        ],
        totalDuration: '4 months',
      }),
    ]);
  });

  test('keeps short descriptors and client labels in descriptions', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Visual Machines Group', y: 670 }),
      textItem({ text: 'Leader', y: 650, fontSize: 11.5 }),
      textItem({ text: 'July 2018 - Present (7 years 11 months)', y: 630 }),
      textItem({ text: 'Los Angeles CA', y: 610 }),
      textItem({ text: 'Spatial AI', y: 590 }),
      textItem({ text: 'OnePager', y: 550 }),
      textItem({ text: 'Venture', y: 530, fontSize: 11.5 }),
      textItem({
        text: 'September 2020 - February 2022 (1 year 6 months)',
        y: 510,
      }),
      textItem({
        text: 'data room for startups in one link— email gate, analytics, and deck viewer.',
        y: 490,
      }),
      textItem({ text: 'RQ', y: 450 }),
      textItem({ text: 'Account Supervisor', y: 430, fontSize: 11.5 }),
      textItem({
        text: 'May 2015 - September 2017 (2 years 5 months)',
        y: 410,
      }),
      textItem({ text: 'Client: Paypal + Airbnb', y: 390 }),
      textItem({
        text: 'Meet Halfway led the co-marketing initiative.',
        y: 370,
      }),
      textItem({ text: 'Client: 1800 Tequila', y: 350 }),
      textItem({
        text: 'Led the strategic repositioning of 1800 Tequila.',
        y: 330,
      }),
      textItem({ text: 'KPMG', y: 290 }),
      textItem({ text: 'Intern', y: 270, fontSize: 11.5 }),
      textItem({ text: 'September 2003 - February 2004 (6 months)', y: 250 }),
      textItem({ text: 'Paris Area, France', y: 230 }),
      textItem({ text: 'Audit', y: 210 }),
      textItem({ text: 'HEC Junior Conseil', y: 170 }),
      textItem({ text: 'Consultant', y: 150, fontSize: 11.5 }),
      textItem({
        text: 'December 2001 - March 2003 (1 year 4 months)',
        y: 130,
      }),
      textItem({ text: 'Consulting', y: 110 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Visual Machines Group',
        positions: [
          expect.objectContaining({
            description: 'Spatial AI',
            title: 'Leader',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'OnePager',
        positions: [
          expect.objectContaining({
            description:
              'data room for startups in one link— email gate, analytics, and deck viewer.',
            title: 'Venture',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'RQ',
        positions: [
          expect.objectContaining({
            description:
              'Client: Paypal + Airbnb Meet Halfway led the co-marketing initiative. Client: 1800 Tequila Led the strategic repositioning of 1800 Tequila.',
            title: 'Account Supervisor',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'KPMG',
        positions: [
          expect.objectContaining({
            description: 'Audit',
            title: 'Intern',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'HEC Junior Conseil',
        positions: [
          expect.objectContaining({
            description: 'Consulting',
            title: 'Consultant',
          }),
        ],
      }),
    ]);
  });

  test('does not let sentence-like description lines hide the next organization', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Hermès', y: 670 }),
      textItem({
        text: 'VP, corporate VC investments',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: 'February 2019 - Present (7 years 4 months)', y: 630 }),
      textItem({ text: 'Greater Los Angeles Area', y: 610 }),
      textItem({
        text: 'Exploring modern craftsmanship and looking for singularity through our',
        y: 590,
      }),
      textItem({
        text: 'Corporate VC. Actively but discreetly investing in tech …',
        y: 570,
      }),
      textItem({ text: 'Ampli & Co', y: 530 }),
      textItem({ text: 'Consultant', y: 510, fontSize: 11.5 }),
      textItem({
        text: 'February 2018 - February 2019 (1 year 1 month)',
        y: 490,
      }),
      textItem({ text: 'Greater Los Angeles Area', y: 470 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Hermès',
        positions: [
          expect.objectContaining({
            description:
              'Exploring modern craftsmanship and looking for singularity through our Corporate VC. Actively but discreetly investing in tech …',
            title: 'VP, corporate VC investments',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Ampli & Co',
        positions: [
          expect.objectContaining({
            duration: 'February 2018 - February 2019',
            location: 'Greater Los Angeles Area',
            title: 'Consultant',
          }),
        ],
      }),
    ]);
  });

  test('merges wrapped bilingual organization headings', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({
        text: 'Consulate General of Canada in New York | Consulat général du',
        y: 670,
      }),
      textItem({ text: 'Canada à New York', y: 652 }),
      textItem({ text: 'Venture Partner', y: 630, fontSize: 11.5 }),
      textItem({ text: 'March 2023 - March 2024 (1 year 1 month)', y: 610 }),
      textItem({ text: 'New York City Metropolitan Area', y: 590 }),
      textItem({
        text: "Seed Stage Venture Capital Program hosted by Canada's Trade Commissioner Service.",
        y: 570,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization:
          'Consulate General of Canada in New York | Consulat général du Canada à New York',
        positions: [
          expect.objectContaining({
            description:
              "Seed Stage Venture Capital Program hosted by Canada's Trade Commissioner Service.",
            duration: 'March 2023 - March 2024',
            location: 'New York City Metropolitan Area',
            title: 'Venture Partner',
          }),
        ],
      }),
    ]);
  });

  test('preserves hyphenated organization taglines', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'WhereTo - Business Travel Reimagined', y: 670 }),
      textItem({ text: 'Board Member', y: 650, fontSize: 11.5 }),
      textItem({ text: 'April 2017 - February 2018 (11 months)', y: 630 }),
    ]);

    expect(experience.organization).toBe(
      'WhereTo - Business Travel Reimagined'
    );
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

  test('parses person-shaped organization names with canonical visual hierarchy', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Hermes Argus', y: 670 }),
      textItem({ text: 'Software Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2022', y: 630 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Hermes Argus',
        positions: [
          expect.objectContaining({
            duration: '2020 - 2022',
            title: 'Software Engineer',
          }),
        ],
      }),
    ]);
  });

  test('rejects person-shaped organization names without aligned header hierarchy', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Hermes Argus', y: 670, fontSize: 10 }),
      textItem({
        text: 'Software Engineer',
        y: 650,
        fontSize: 12,
        x: 270,
      }),
      textItem({ text: '2020 - 2022', y: 630, fontSize: 12, x: 270 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([]);
  });

  test('recognizes angel network names before title and duration without a location', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Nordic Angels', y: 670 }),
      textItem({ text: 'Investor', y: 650, fontSize: 11.5 }),
      textItem({
        text: 'August 2024 - Present (1 year 10 months)',
        y: 630,
      }),
      textItem({
        text: 'Recommended and accepted as a member and investor of the private social',
        y: 610,
      }),
      textItem({
        text: 'investor network Nordic Angels. Nordic Angels is the largest angel investor',
        y: 590,
      }),
      textItem({
        text: 'network in the Nordics and mobilizes business angels through a combination',
        y: 570,
      }),
      textItem({
        text: 'of digital platforms and curated in-person events.',
        y: 550,
      }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Nordic Angels',
        positions: [
          expect.objectContaining({
            description:
              'Recommended and accepted as a member and investor of the private social investor network Nordic Angels. Nordic Angels is the largest angel investor network in the Nordics and mobilizes business angels through a combination of digital platforms and curated in-person events.',
            duration: 'August 2024 - Present',
            title: 'Investor',
          }),
        ],
      }),
    ]);
  });

  test('keeps page-footer noise and location inside canonical person-shaped blocks', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Aster Vale', y: 670 }),
      textItem({ text: 'Software Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'Page 1 of 2', y: 635, fontSize: 9 }),
      textItem({ text: 'January 2020 - Present', y: 620, fontSize: 10.5 }),
      textItem({ text: 'Austin, TX', y: 600, fontSize: 10.5 }),
      textItem({ text: 'Built durable workflow tools.', y: 580 }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Aster Vale',
        positions: [
          expect.objectContaining({
            description: 'Built durable workflow tools.',
            duration: 'January 2020 - Present',
            location: 'Austin, TX',
            title: 'Software Engineer',
          }),
        ],
      }),
    ]);
  });

  test('scores organization mentions after page-footer noise in canonical headers', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Aster Vale', y: 670 }),
      textItem({ text: 'Software Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - Present', y: 630 }),
      textItem({ text: 'Page 1 of 2', y: 615, fontSize: 9 }),
      textItem({
        text: 'Aster Vale builds planning software.',
        y: 600,
      }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Aster Vale',
        positions: [
          expect.objectContaining({
            description: 'Aster Vale builds planning software.',
            duration: 'January 2020 - Present',
            title: 'Software Engineer',
          }),
        ],
      }),
    ]);
  });

  test('recognizes person-shaped multi-position organizations with total duration', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Blue River', y: 670 }),
      textItem({ text: '3 years', y: 650, fontSize: 10.5 }),
      textItem({ text: 'Principal Engineer', y: 630, fontSize: 11.5 }),
      textItem({ text: 'January 2022 - Present', y: 610, fontSize: 10.5 }),
      textItem({ text: 'Senior Engineer', y: 580, fontSize: 11.5 }),
      textItem({ text: 'January 2021 - January 2022', y: 560, fontSize: 10.5 }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Blue River',
        positions: [
          expect.objectContaining({
            duration: 'January 2022 - Present',
            title: 'Principal Engineer',
          }),
          expect.objectContaining({
            duration: 'January 2021 - January 2022',
            title: 'Senior Engineer',
          }),
        ],
        totalDuration: '3 years',
      }),
    ]);
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

  test('starts confirmed organizations after descriptions and merges wrapped titles', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Spirit Bomb', y: 670 }),
      textItem({ text: 'Board Observer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - Present', y: 630 }),
      textItem({
        text: 'Works with founders on media and marketplace strategy.',
        y: 610,
      }),
      textItem({ text: 'Warner Music Group', y: 570 }),
      textItem({ text: 'Director, Global Business', y: 550, fontSize: 11.5 }),
      textItem({ text: 'Development', y: 538, fontSize: 11.5 }),
      textItem({ text: 'May 2018 - December 2019', y: 518 }),
      textItem({ text: 'New York, NY', y: 498 }),
      textItem({ text: 'Portugal Ventures', y: 458 }),
      textItem({ text: 'Venture Partner', y: 438, fontSize: 11.5 }),
      textItem({ text: 'January 2016 - April 2018', y: 418 }),
      textItem({ text: 'Lisbon, Portugal', y: 398 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Spirit Bomb',
        positions: [
          expect.objectContaining({
            description:
              'Works with founders on media and marketplace strategy.',
            title: 'Board Observer',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Warner Music Group',
        positions: [
          expect.objectContaining({
            duration: 'May 2018 - December 2019',
            location: 'New York, NY',
            title: 'Director, Global Business Development',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Portugal Ventures',
        positions: [
          expect.objectContaining({
            duration: 'January 2016 - April 2018',
            location: 'Lisbon, Portugal',
            title: 'Venture Partner',
          }),
        ],
      }),
    ]);
  });

  test('keeps a confirmed organization before a long wrapped business title', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Spirit Bomb', y: 670 }),
      textItem({ text: 'Board Observer', y: 650, fontSize: 11.5 }),
      textItem({ text: 'July 2020 - March 2023', y: 630 }),
      textItem({
        text: 'Worked with media founders on publishing strategy.',
        y: 610,
      }),
      textItem({ text: 'Warner Music Group', y: 570 }),
      textItem({
        text: 'Corporate Strategy, New Business & Ventures - Gaming & Emerging',
        y: 550,
        fontSize: 11.5,
      }),
      textItem({ text: 'Tech', y: 538, fontSize: 11.5 }),
      textItem({ text: 'February 2018 - March 2023', y: 518 }),
      textItem({ text: 'London, United Kingdom', y: 498 }),
      textItem({ text: 'Portugal Ventures', y: 458 }),
      textItem({
        text: 'Media and Entertainment Investment Expert',
        y: 438,
        fontSize: 11.5,
      }),
      textItem({ text: 'March 2016 - 2022', y: 418 }),
      textItem({ text: 'Portugal', y: 398 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Spirit Bomb',
      }),
      expect.objectContaining({
        organization: 'Warner Music Group',
        positions: [
          expect.objectContaining({
            duration: 'February 2018 - March 2023',
            location: 'London, United Kingdom',
            title:
              'Corporate Strategy, New Business & Ventures - Gaming & Emerging Tech',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Portugal Ventures',
        positions: [
          expect.objectContaining({
            duration: 'March 2016 - 2022',
            location: 'Portugal',
            title: 'Media and Entertainment Investment Expert',
          }),
        ],
      }),
    ]);
  });

  test('recognizes legal-suffix organizations after description text', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Explorer', y: 670 }),
      textItem({ text: 'Advisor', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - Present', y: 630 }),
      textItem({ text: 'Built a founder network across fintech.', y: 610 }),
      textItem({ text: 'Santander Bank, N.A.', y: 570 }),
      textItem({ text: 'Senior Product Manager', y: 550, fontSize: 11.5 }),
      textItem({ text: 'March 2018 - December 2019', y: 530 }),
      textItem({ text: 'Boston, MA', y: 510 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Explorer',
        positions: [
          expect.objectContaining({
            description: 'Built a founder network across fintech.',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Santander Bank, N.A.',
        positions: [
          expect.objectContaining({
            duration: 'March 2018 - December 2019',
            location: 'Boston, MA',
            title: 'Senior Product Manager',
          }),
        ],
      }),
    ]);
  });

  test('classifies n.a. legal suffix organizations across boundary paths', () => {
    const organization = 'Santander Bank, N.A.';
    const lines = [
      organization,
      'Senior Product Manager',
      'March 2018 - December 2019',
    ];

    expect(
      ExperienceStructuralParser['fallbackLineType'](organization, 12, 0, lines)
    ).toBe('organization');
    expect(
      ExperienceStructuralParser['looksLikeOrganizationBeforePosition'](
        organization,
        0,
        lines
      )
    ).toBe(true);
  });

  test('keeps no-date title-looking hiring lines in descriptions', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'PNC', y: 670 }),
      textItem({
        text: 'Head of Enterprise Innovation',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: 'January 2022 - Present', y: 630 }),
      textItem({ text: 'Greater Pittsburgh Area', y: 610 }),
      textItem({
        text: '>> Software engineer? Strategist? Experience Strategist? Designer? Product',
        y: 590,
      }),
      textItem({ text: "Manager? We're Hiring! Message me.", y: 578 }),
      textItem({
        text: 'Head of Technology Innovation',
        y: 550,
        fontSize: 11.5,
      }),
      textItem({ text: 'January 2020 - December 2021', y: 530 }),
      textItem({ text: 'Greater Pittsburgh Area', y: 510 }),
    ]);

    expect(experience).toEqual(
      expect.objectContaining({
        organization: 'PNC',
        positions: [
          expect.objectContaining({
            description:
              ">> Software engineer? Strategist? Experience Strategist? Designer? Product Manager? We're Hiring! Message me.",
            location: 'Greater Pittsburgh Area',
            title: 'Head of Enterprise Innovation',
          }),
          expect.objectContaining({
            duration: 'January 2020 - December 2021',
            location: 'Greater Pittsburgh Area',
            title: 'Head of Technology Innovation',
          }),
        ],
      })
    );
  });

  test('extracts international after-duration locations from metadata lines', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Market Systems', y: 670 }),
      textItem({ text: 'Advisor', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2024 - Present', y: 630 }),
      textItem({ text: 'Jakarta, Indonesia', y: 610 }),
      textItem({ text: 'Taipei Analytics', y: 570 }),
      textItem({ text: 'Board Member', y: 550, fontSize: 11.5 }),
      textItem({ text: 'January 2022 - December 2023', y: 530 }),
      textItem({ text: 'Taipei City, Taiwan', y: 510 }),
      textItem({ text: 'Gulf Ventures', y: 470 }),
      textItem({ text: 'Venture Partner', y: 450, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - December 2021', y: 430 }),
      textItem({ text: 'Riyadh, Saudi Arabia', y: 410 }),
      textItem({ text: 'Doha Labs', y: 370 }),
      textItem({ text: 'Advisor', y: 350, fontSize: 11.5 }),
      textItem({ text: 'January 2018 - December 2019', y: 330 }),
      textItem({ text: 'Doha, Qatar', y: 310 }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        positions: [
          expect.objectContaining({
            location: 'Jakarta, Indonesia',
          }),
        ],
      }),
      expect.objectContaining({
        positions: [
          expect.objectContaining({
            location: 'Taipei City, Taiwan',
          }),
        ],
      }),
      expect.objectContaining({
        positions: [
          expect.objectContaining({
            location: 'Riyadh, Saudi Arabia',
          }),
        ],
      }),
      expect.objectContaining({
        positions: [
          expect.objectContaining({
            location: 'Doha, Qatar',
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

  test('starts a new same-organization role when a page footer splits title and dates', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Carta', y: 670 }),
      textItem({ text: 'Tech Lead Manager', y: 650, fontSize: 11.5 }),
      textItem({ text: 'July 2019 - October 2021', y: 630 }),
      textItem({ text: 'Palo Alto, CA', y: 610 }),
      textItem({
        text: 'Provided technical leadership and mentored engineers.',
        y: 590,
      }),
      textItem({
        text: 'Senior Software Engineer',
        y: 560,
        fontSize: 11.5,
      }),
      textItem({ text: 'Page 2 of 7', y: 540, fontSize: 9 }),
      textItem({ text: 'October 2017 - June 2019', y: -9300 }),
      textItem({ text: 'Rio de Janeiro', y: -9320 }),
    ]);

    expect(experience).toEqual(
      expect.objectContaining({
        organization: 'Carta',
        positions: [
          expect.objectContaining({
            description:
              'Provided technical leadership and mentored engineers.',
            title: 'Tech Lead Manager',
          }),
          expect.objectContaining({
            duration: 'October 2017 - June 2019',
            location: 'Rio de Janeiro',
            title: 'Senior Software Engineer',
          }),
        ],
      })
    );
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

  test('keeps noisy embedded date lines in descriptions', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Research Systems Group', y: 670 }),
      textItem({ text: 'Researcher', y: 650, fontSize: 11.5 }),
      textItem({ text: 'Provided support from 2019 - 2021', y: 630 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        description: 'Provided support from 2019 - 2021',
        duration: '',
      })
    );
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

  test('keeps RQ client campaign lines in the dated role description', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'RQ', y: 670 }),
      textItem({ text: 'Associate Director', y: 650, fontSize: 11.5 }),
      textItem({
        text: 'September 2017 - June 2018 (10 months)',
        y: 630,
      }),
      textItem({
        text: 'Los Angeles, California, United States',
        y: 610,
      }),
      textItem({ text: 'Client: YouTube', y: 590 }),
      textItem({
        text: 'Creative strategy, planning, and event activation for influencer campaigns for',
        y: 570,
      }),
      textItem({ text: 'YouTube Originals + YouTube TV:', y: 550 }),
      textItem({
        text: '+ YouTube x Getty Studio Sundance Photo Studio',
        y: 530,
      }),
      textItem({
        text: '+ World Series Partner Programming 2018',
        y: 510,
      }),
      textItem({ text: 'Account Supervisor', y: 480, fontSize: 11.5 }),
      textItem({
        text: 'May 2015 - September 2017 (2 years 5 months)',
        y: 460,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'RQ',
        positions: [
          expect.objectContaining({
            description:
              'Client: YouTube Creative strategy, planning, and event activation for influencer campaigns for YouTube Originals + YouTube TV: + YouTube x Getty Studio Sundance Photo Studio + World Series Partner Programming 2018',
            duration: 'September 2017 - June 2018',
            title: 'Associate Director',
          }),
          expect.objectContaining({
            duration: 'May 2015 - September 2017',
            title: 'Account Supervisor',
          }),
        ],
      }),
    ]);
  });

  test('keeps no-date Future US prose as description and starts the next organization', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'The Future US', y: 670 }),
      textItem({
        text: 'Member of the Board of Advisors',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({
        text: 'January 2023 - February 2025 (2 years 2 months)',
        y: 630,
      }),
      textItem({ text: 'Washington DC-Baltimore Area', y: 610 }),
      textItem({
        text: 'Non-profit organization and catalytic, post-partisan policy accelerator.',
        y: 590,
      }),
      textItem({ text: 'Venture Partner', y: 560, fontSize: 11.5 }),
      textItem({
        text: 'March 2023 - March 2024 (1 year 1 month)',
        y: 540,
      }),
      textItem({ text: 'New York City Metropolitan Area', y: 520 }),
      textItem({
        text: "Seed Stage Venture Capital Program hosted by Canada's Trade",
        y: 500,
      }),
      textItem({ text: 'Commissioner Service.', y: 480 }),
      textItem({ text: 'SurveyMonkey', y: 450 }),
      textItem({
        text: 'Strategic Finance & Business Operation Lead',
        y: 430,
        fontSize: 11.5,
      }),
      textItem({ text: '2020 - 2021 (1 year)', y: 410 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'The Future US',
        positions: [
          expect.objectContaining({
            title: 'Member of the Board of Advisors',
          }),
          expect.objectContaining({
            description:
              "Seed Stage Venture Capital Program hosted by Canada's Trade Commissioner Service.",
            duration: 'March 2023 - March 2024',
            title: 'Venture Partner',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'SurveyMonkey',
        positions: [
          expect.objectContaining({
            duration: '2020 - 2021',
            title: 'Strategic Finance & Business Operation Lead',
          }),
        ],
      }),
    ]);
  });

  test('does not let J.P. Morgan description text swallow Goldman Sachs', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'J.P. Morgan', y: 670 }),
      textItem({ text: 'Investment Banking', y: 650, fontSize: 11.5 }),
      textItem({ text: '2015 - 2016 (1 year)', y: 630 }),
      textItem({ text: 'New York, New York, United States', y: 610 }),
      textItem({ text: 'Mergers & Acquisitions Group (M&A)', y: 590 }),
      textItem({ text: 'Goldman Sachs', y: 560 }),
      textItem({ text: 'Investment Banking', y: 540, fontSize: 11.5 }),
      textItem({ text: '2014 - 2015 (1 year)', y: 520 }),
      textItem({ text: 'New York, New York, United States', y: 500 }),
      textItem({ text: 'Financial Institutions Group (FIG)', y: 480 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'J.P. Morgan',
        positions: [
          expect.objectContaining({
            description: 'Mergers & Acquisitions Group (M&A)',
            duration: '2015 - 2016',
            title: 'Investment Banking',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Goldman Sachs',
        positions: [
          expect.objectContaining({
            description: 'Financial Institutions Group (FIG)',
            duration: '2014 - 2015',
            title: 'Investment Banking',
          }),
        ],
      }),
    ]);
  });

  test('keeps CAA founder detail as Creative Artists Agency description', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Creative Artists Agency', y: 670 }),
      textItem({
        text: 'Member of Management Committee / Senior Talent Agent',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: '1986 - 1995 (9 years)', y: 630 }),
      textItem({
        text: 'Founder CAA Corporate Advisory Group in 1987.',
        y: 610,
      }),
      textItem({ text: 'MGM', y: 580 }),
      textItem({
        text: 'Executive Positions in Productions and Distribution',
        y: 560,
        fontSize: 11.5,
      }),
      textItem({ text: '1979 - 1985 (6 years)', y: 540 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Creative Artists Agency',
        positions: [
          expect.objectContaining({
            description: 'Founder CAA Corporate Advisory Group in 1987.',
            duration: '1986 - 1995',
            title: 'Member of Management Committee / Senior Talent Agent',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'MGM',
      }),
    ]);
  });

  test('keeps Helios Phaethon description continuations under their dated roles', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Rotary International', y: 670 }),
      textItem({ text: 'Angel Investor', y: 650, fontSize: 11.5 }),
      textItem({
        text: 'January 2014 - January 2024 (10 years 1 month)',
        y: 630,
      }),
      textItem({
        text: 'Invest in early stage companies in B2B SaaS, Digital Health, Cybersecurity,',
        y: 610,
      }),
      textItem({
        text: 'Diagnostics, Medical Device, IoT, Future of Work, HRtech, Adtech, AR/VR,',
        y: 590,
      }),
      textItem({
        text: 'Mental Health. Also invest as Limited Partner in Emerging Funds in the US.',
        y: 570,
      }),
      textItem({ text: '500 Global', y: 540 }),
      textItem({ text: 'Mentor', y: 520, fontSize: 11.5 }),
      textItem({
        text: 'December 2021 - November 2023 (2 years)',
        y: 500,
      }),
      textItem({ text: 'GBSS Group', y: 460 }),
      textItem({
        text: 'Co-Founder & CEO (Business Units Acquired Separately: 2006, 2010, 2013)',
        y: 440,
        fontSize: 11.5,
      }),
      textItem({
        text: 'November 1999 - June 2013 (13 years 8 months)',
        y: 420,
      }),
      textItem({ text: 'San Diego, California, United States', y: 400 }),
      textItem({
        text: 'A group of ecommerce and technology companies in the office supplies,',
        y: 380,
      }),
      textItem({
        text: 'Successfully spin-off three business units that lead to three different exits.',
        y: 360,
      }),
      textItem({ text: 'Interbank Turkiye', y: 330 }),
      textItem({
        text: 'Product Manager / Strategic Planning Manager',
        y: 310,
        fontSize: 11.5,
      }),
      textItem({
        text: 'June 1996 - August 1998 (2 years 3 months)',
        y: 290,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Rotary International',
        positions: [
          expect.objectContaining({
            description:
              'Invest in early stage companies in B2B SaaS, Digital Health, Cybersecurity, Diagnostics, Medical Device, IoT, Future of Work, HRtech, Adtech, AR/VR, Mental Health. Also invest as Limited Partner in Emerging Funds in the US.',
            title: 'Angel Investor',
          }),
        ],
      }),
      expect.objectContaining({
        organization: '500 Global',
      }),
      expect.objectContaining({
        organization: 'GBSS Group',
        positions: [
          expect.objectContaining({
            description:
              'A group of ecommerce and technology companies in the office supplies, Successfully spin-off three business units that lead to three different exits.',
            title:
              'Co-Founder & CEO (Business Units Acquired Separately: 2006, 2010, 2013)',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Interbank Turkiye',
      }),
    ]);
  });

  test('separates Andromeda Cassiopeia company boundaries and keeps prose out of locations', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 900, fontSize: 16 }),
      textItem({ text: 'MUDE', y: 870 }),
      textItem({ text: 'Founder', y: 850, fontSize: 11.5 }),
      textItem({ text: 'April 2025 - Present (1 year 2 months)', y: 830 }),
      textItem({ text: 'In stealth. More information coming soon.', y: 810 }),
      textItem({ text: 'Velocity AI', y: 780 }),
      textItem({ text: 'Strategic Advisor', y: 760, fontSize: 11.5 }),
      textItem({ text: 'March 2026 - Present (3 months)', y: 740 }),
      textItem({
        text: 'Velocity AI is building The Operating System of Human Performance™,',
        y: 720,
      }),
      textItem({ text: 'HeadVantage Corporation', y: 690 }),
      textItem({ text: 'Strategic Advisor', y: 670, fontSize: 11.5 }),
      textItem({ text: 'March 2025 - Present (1 year 3 months)', y: 650 }),
      textItem({
        text: 'HeadVantage puts fans inside the helmet, delivering live, first-person athlete',
        y: 630,
      }),
      textItem({
        text: 'Comcast NBCUniversal SportsTech Accelerator, HeadVantage is redefining',
        y: 610,
      }),
      textItem({ text: 'how the world experiences sport.', y: 590 }),
      textItem({ text: 'Prescient', y: 560 }),
      textItem({ text: 'Founding Partner + Advisor', y: 540, fontSize: 11.5 }),
      textItem({ text: 'October 2018 - Present (7 years 8 months)', y: 520 }),
      textItem({
        text: 'Prescient, formerly Vybn, is a decision science platform that unifies and',
        y: 500,
      }),
      textItem({
        text: 'After securing an exclusive partnership with Warner Music, Prescient is now',
        y: 480,
      }),
      textItem({
        text: 'focused on a variety of brands, accelerating LTV in a cookieless world.',
        y: 460,
      }),
      textItem({ text: 'Rasgo', y: 430 }),
      textItem({
        text: 'Chief of Staff + Head of Operations',
        y: 410,
        fontSize: 11.5,
      }),
      textItem({
        text: 'January 2020 - January 2023 (3 years 1 month)',
        y: 390,
      }),
      textItem({ text: 'New York, United States', y: 370 }),
      textItem({
        text: 'As the first partner to the two founders, I helped bring the vision to life',
        y: 350,
      }),
    ]);
    const byOrganization = new Map(
      result.value.map(experience => [experience.organization, experience])
    );

    expect(result.warnings).toEqual([]);
    expect(byOrganization.get('MUDE')?.positions[0]?.location).toBeUndefined();
    expect(byOrganization.get('Velocity AI')?.positions[0]?.title).toBe(
      'Strategic Advisor'
    );
    expect(
      byOrganization.get('HeadVantage Corporation')?.positions[0]?.location
    ).toBeUndefined();
    expect(
      byOrganization.get('HeadVantage Corporation')?.positions[0]?.description
    ).toContain('Comcast NBCUniversal SportsTech Accelerator');
    expect(
      byOrganization.get('Prescient')?.positions[0]?.location
    ).toBeUndefined();
    expect(byOrganization.get('Rasgo')?.positions[0]?.location).toBe(
      'New York, United States'
    );
    expect(byOrganization.get('Rasgo')?.positions[0]?.description).toContain(
      'As the first partner'
    );
  });

  test('keeps Helios Phaethon wrapped titles and Cross Ocean boundaries intact', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 900, fontSize: 16 }),
      textItem({ text: 'Cross Ocean Ventures', y: 870 }),
      textItem({ text: 'Co-Founder General Partner', y: 850, fontSize: 11.5 }),
      textItem({ text: 'April 2021 - Present (5 years 2 months)', y: 830 }),
      textItem({ text: 'San Diego Metropolitan Area', y: 810 }),
      textItem({
        text: 'The leading go to early-stage investor of choice for ambitious high growth',
        y: 790,
      }),
      textItem({ text: 'Breakaway Partners OU', y: 760 }),
      textItem({ text: 'Co-Founder & Partner', y: 740, fontSize: 11.5 }),
      textItem({ text: '2021 - Present (5 years)', y: 720 }),
      textItem({ text: 'Tallinn, Harjumaa, Estonia', y: 700 }),
      textItem({ text: 'GBSS Group', y: 670 }),
      textItem({
        text: 'Co-Founder & CEO (Business Units Acquired Separately: 2006, 2010,',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: '2013)', y: 635, fontSize: 11.5 }),
      textItem({
        text: 'November 1999 - June 2013 (13 years 8 months)',
        y: 615,
      }),
    ]);
    const byOrganization = new Map(
      result.value.map(experience => [experience.organization, experience])
    );

    expect(result.warnings).toEqual([]);
    expect(byOrganization.get('Cross Ocean Ventures')?.positions).toEqual([
      expect.objectContaining({
        location: 'San Diego Metropolitan Area',
        title: 'Co-Founder General Partner',
      }),
    ]);
    expect(byOrganization.get('Breakaway Partners OU')?.positions).toEqual([
      expect.objectContaining({
        location: 'Tallinn, Harjumaa, Estonia',
        title: 'Co-Founder & Partner',
      }),
    ]);
    expect(byOrganization.get('GBSS Group')?.positions[0]?.title).toBe(
      'Co-Founder & CEO (Business Units Acquired Separately: 2006, 2010, 2013)'
    );
  });

  test('keeps Orion Lycaon prose dates and wrapped Brown organization names', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 900, fontSize: 16 }),
      textItem({ text: 'Resilient Connections', y: 870 }),
      textItem({
        text: 'Founding Executive Director',
        y: 850,
        fontSize: 11.5,
      }),
      textItem({ text: '2020 - 2020 (less than a year)', y: 830 }),
      textItem({
        text: 'Resilient Connections was a pop-up non-profit that launched in March 2020 to',
        y: 810,
      }),
      textItem({
        text: 'coordinate high potential impact grass roots COVID-19 response projects that',
        y: 790,
      }),
      textItem({
        text: 'Clinical and Affective Neuroscience Laboratory (CLANlab) at Brown',
        y: 760,
      }),
      textItem({ text: 'University', y: 742 }),
      textItem({ text: 'Research Assistant', y: 720, fontSize: 11.5 }),
      textItem({ text: '2008 - 2010 (2 years)', y: 700 }),
      textItem({
        text: 'Harvard John A. Paulson School of Engineering and Applied',
        y: 670,
      }),
      textItem({ text: 'Sciences', y: 652 }),
      textItem({
        text: 'Applied Physics Teaching Fellow',
        y: 630,
        fontSize: 11.5,
      }),
      textItem({
        text: 'January 2019 - December 2019 (1 year)',
        y: 610,
      }),
      textItem({
        text: 'University de',
        y: 580,
      }),
      textItem({ text: 'Paris', y: 562 }),
      textItem({
        text: 'Research Fellow',
        y: 540,
        fontSize: 11.5,
      }),
      textItem({
        text: 'September 2011 - June 2012 (10 months)',
        y: 520,
      }),
    ]);
    const byOrganization = new Map(
      result.value.map(experience => [experience.organization, experience])
    );

    expect(result.warnings).toEqual([]);
    expect(byOrganization.get('Resilient Connections')?.positions[0]).toEqual(
      expect.objectContaining({
        description: expect.stringContaining('launched in March 2020 to'),
        duration: '2020 - 2020',
      })
    );
    expect(
      byOrganization.get(
        'Clinical and Affective Neuroscience Laboratory (CLANlab) at Brown University'
      )?.positions[0]?.title
    ).toBe('Research Assistant');
    expect(
      byOrganization.get(
        'Harvard John A. Paulson School of Engineering and Applied Sciences'
      )?.positions[0]?.title
    ).toBe('Applied Physics Teaching Fellow');
    expect(byOrganization.get('University de Paris')?.positions[0]?.title).toBe(
      'Research Fellow'
    );
    expect(byOrganization.has('University')).toBe(false);
    expect(byOrganization.has('Sciences')).toBe(false);
    expect(byOrganization.has('Paris')).toBe(false);
  });

  test('keeps secondary reference companies and page-break prose out of locations', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 1100, fontSize: 16 }),
      textItem({ text: 'WeGive', y: 1070 }),
      textItem({ text: 'Board Member', y: 1050, fontSize: 11.5 }),
      textItem({ text: 'January 2024 - Present (2 years 5 months)', y: 1030 }),
      textItem({ text: 'Mission Control AI', y: 1000 }),
      textItem({ text: 'Board Member', y: 980, fontSize: 11.5 }),
      textItem({ text: 'March 2022 - Present (4 years 3 months)', y: 960 }),
      textItem({ text: 'Visual Machines Group', y: 930 }),
      textItem({ text: 'Leader', y: 910, fontSize: 11.5 }),
      textItem({ text: 'July 2018 - Present (7 years 11 months)', y: 890 }),
      textItem({ text: 'Los Angeles CA', y: 870 }),
      textItem({ text: 'Spatial AI', y: 850 }),
      textItem({ text: 'Vayu Robotics', y: 820 }),
      textItem({ text: 'Co-Founder (Acquired)', y: 800, fontSize: 11.5 }),
      textItem({
        text: 'October 2021 - August 2025 (3 years 11 months)',
        y: 780,
      }),
      textItem({ text: 'Alerian', y: 750 }),
      textItem({ text: '9 years 5 months', y: 730 }),
      textItem({ text: 'Director of Data Science', y: 710, fontSize: 11.5 }),
      textItem({ text: 'January 2013 - December 2020 (8 years)', y: 690 }),
      textItem({ text: 'Dallas, Texas', y: 670 }),
      textItem({
        text: 'Over nearly a decade, I designed benchmarks and indices from concept',
        y: 650,
      }),
    ]);
    const byOrganization = new Map(
      result.value.map(experience => [experience.organization, experience])
    );

    expect(result.warnings).toEqual([]);
    expect(byOrganization.get('WeGive')?.positions).toHaveLength(1);
    expect(byOrganization.get('Mission Control AI')?.positions[0]?.title).toBe(
      'Board Member'
    );
    expect(byOrganization.get('Visual Machines Group')?.positions[0]).toEqual(
      expect.objectContaining({
        location: 'Los Angeles CA',
      })
    );
    expect(
      byOrganization.get('Visual Machines Group')?.positions[0]?.location
    ).not.toContain('Spatial AI');
    expect(byOrganization.has('Spatial AI')).toBe(false);
    expect(byOrganization.get('Vayu Robotics')?.positions[0]?.title).toBe(
      'Co-Founder (Acquired)'
    );
    expect(byOrganization.get('Alerian')?.positions[0]).toEqual(
      expect.objectContaining({
        description: expect.stringContaining('Over nearly a decade'),
        location: 'Dallas, Texas',
      })
    );
  });

  test('preserves description labels used by investor and corporate-development roles', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 900, fontSize: 16 }),
      textItem({ text: 'Global Ventures', y: 870 }),
      textItem({ text: 'VC Investor', y: 850, fontSize: 11.5 }),
      textItem({ text: 'June 2023 - November 2023 (6 months)', y: 830 }),
      textItem({ text: 'IC Deal: Fuse', y: 810 }),
      textItem({ text: 'Collide Capital', y: 780 }),
      textItem({
        text: 'VC Investor | Venture Fellow',
        y: 760,
        fontSize: 11.5,
      }),
      textItem({ text: 'January 2023 - May 2023 (5 months)', y: 740 }),
      textItem({ text: 'Sourced Investment: Coldcart', y: 720 }),
      textItem({ text: 'Cinedigm', y: 690 }),
      textItem({
        text: 'VP, Corporate Development and Strategy',
        y: 670,
        fontSize: 11.5,
      }),
      textItem({
        text: 'March 2012 - September 2016 (4 years 7 months)',
        y: 650,
      }),
      textItem({ text: 'Achievements:', y: 630 }),
      textItem({
        text: 'Oversaw strategic and business planning of video app new business.',
        y: 610,
      }),
    ]);
    const byOrganization = new Map(
      result.value.map(experience => [experience.organization, experience])
    );

    expect(result.warnings).toEqual([]);
    expect(
      byOrganization.get('Global Ventures')?.positions[0]?.description
    ).toBe('IC Deal: Fuse');
    expect(
      byOrganization.get('Collide Capital')?.positions[0]?.description
    ).toBe('Sourced Investment: Coldcart');
    expect(byOrganization.get('Cinedigm')?.positions[0]?.description).toBe(
      'Achievements: Oversaw strategic and business planning of video app new business.'
    );
  });

  test('splits Medea Colchis combined organization-title rows and keeps Bosch prose', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Stealth Company', y: 670 }),
      textItem({ text: 'Managing Partner', y: 650, fontSize: 11.5 }),
      textItem({ text: 'December 2024 - Present (1 year 6 months)', y: 630 }),
      textItem({ text: 'United States', y: 610 }),
      textItem({ text: 'Bookbinders Design', y: 580 }),
      textItem({
        text: 'Sales & Merchandising Manager (Fixed-term consulting)',
        y: 560,
        fontSize: 11.5,
      }),
      textItem({ text: 'May 2018 - June 2018 (2 months)', y: 540 }),
      textItem({
        text: 'Requested to provide training and process improvement.',
        y: 520,
      }),
      textItem({ text: 'Robert Bosch GmbH Business Controller', y: 490 }),
      textItem({
        text: 'December 2012 - August 2017 (4 years 9 months)',
        y: 470,
      }),
      textItem({ text: 'Yongin, Gyeonggi-do, Korea', y: 450 }),
      textItem({
        text: 'Stimulated organizational change and summarized best practice articles for',
        y: 430,
      }),
      textItem({ text: 'Bosch intranet homepage', y: 410 }),
      textItem({ text: 'Hyundai Kefico Corporation', y: 380 }),
      textItem({ text: 'Business Controller', y: 360, fontSize: 11.5 }),
      textItem({
        text: 'January 2012 - November 2012 (11 months)',
        y: 340,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Stealth Company',
        positions: [
          expect.objectContaining({
            duration: 'December 2024 - Present',
            title: 'Managing Partner',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Bookbinders Design',
        positions: [
          expect.objectContaining({
            duration: 'May 2018 - June 2018',
            title: 'Sales & Merchandising Manager (Fixed-term consulting)',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Robert Bosch GmbH',
        positions: [
          expect.objectContaining({
            description:
              'Stimulated organizational change and summarized best practice articles for Bosch intranet homepage',
            duration: 'December 2012 - August 2017',
            title: 'Business Controller',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Hyundai Kefico Corporation',
      }),
    ]);
  });

  test('splits combined organization-title rows with lowercase and mixed-case suffixes', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Robert Bosch GmbH. Business Controller', y: 670 }),
      textItem({
        text: 'December 2012 - August 2017 (4 years 9 months)',
        y: 650,
      }),
      textItem({ text: 'Acme llC Principal Consultant', y: 620 }),
      textItem({ text: 'January 2021 - Present (3 years 5 months)', y: 600 }),
      textItem({ text: 'Northstar ltd Staff Engineer', y: 570 }),
      textItem({ text: '2020 - 2022 (2 years)', y: 550 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Robert Bosch GmbH.',
        positions: [
          expect.objectContaining({
            duration: 'December 2012 - August 2017',
            title: 'Business Controller',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Acme llC',
        positions: [
          expect.objectContaining({
            duration: 'January 2021 - Present',
            title: 'Principal Consultant',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Northstar ltd',
        positions: [
          expect.objectContaining({
            duration: '2020 - 2022',
            title: 'Staff Engineer',
          }),
        ],
      }),
    ]);
  });

  test('does not split organization suffix-only rows into fake roles', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'My Company LLC', y: 670 }),
      textItem({ text: 'January 2021 - Present (3 years 5 months)', y: 650 }),
      textItem({ text: 'Robert Bosch GmbH Inc', y: 620 }),
      textItem({
        text: 'February 2019 - December 2020 (1 year 11 months)',
        y: 600,
      }),
      textItem({ text: 'Bosch Company GmbH.', y: 590 }),
      textItem({
        text: 'February 2018 - December 2018 (11 months)',
        y: 580,
      }),
      textItem({ text: 'Acme Agency Principal Consultant', y: 570 }),
      textItem({ text: 'January 2015 - January 2018 (3 years)', y: 550 }),
    ]);

    const parsedOrganizationTitles = result.value.flatMap(experience =>
      experience.positions.map(position => ({
        organization: experience.organization,
        title: position.title,
      }))
    );

    expect(result.warnings).toEqual([]);
    expect(parsedOrganizationTitles).toEqual([
      {
        organization: 'Acme Agency',
        title: 'Principal Consultant',
      },
    ]);
    expect(parsedOrganizationTitles).not.toContainEqual({
      organization: 'My Company',
      title: 'LLC',
    });
    expect(parsedOrganizationTitles).not.toContainEqual({
      organization: 'Robert Bosch GmbH',
      title: 'Inc',
    });
    expect(parsedOrganizationTitles).not.toContainEqual({
      organization: 'Bosch Company',
      title: 'GmbH.',
    });
  });

  test('recognizes dotted GmbH organization boundary rows', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Bosch Company GmbH.', y: 670 }),
      textItem({ text: 'Business Controller', y: 650, fontSize: 11.5 }),
      textItem({
        text: 'February 2018 - December 2018 (11 months)',
        y: 630,
      }),
      textItem({ text: 'Acme Holding, GmbH.', y: 590 }),
      textItem({ text: 'Principal Consultant', y: 570, fontSize: 11.5 }),
      textItem({ text: 'January 2015 - January 2018 (3 years)', y: 550 }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'Bosch Company GmbH.',
        positions: [
          expect.objectContaining({
            duration: 'February 2018 - December 2018',
            title: 'Business Controller',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Acme Holding, GmbH.',
        positions: [
          expect.objectContaining({
            duration: 'January 2015 - January 2018',
            title: 'Principal Consultant',
          }),
        ],
      }),
    ]);
  });

  test('keeps Palo Alto as a location instead of a no-date First Republic role', () => {
    const result = ExperienceStructuralParser.parseExperienceWithWarnings([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'First Republic Bank', y: 670 }),
      textItem({ text: '12 years 1 month', y: 650 }),
      textItem({
        text: 'Deputy Regional Managing Director',
        y: 630,
        fontSize: 11.5,
      }),
      textItem({
        text: 'April 2017 - June 2023 (6 years 3 months)',
        y: 610,
      }),
      textItem({
        text: 'Senior Managing Director',
        y: 580,
        fontSize: 11.5,
      }),
      textItem({
        text: 'February 2017 - June 2023 (6 years 5 months)',
        y: 560,
      }),
      textItem({ text: 'Palo Alto, California', y: 540 }),
      textItem({ text: 'Managing Director', y: 510, fontSize: 11.5 }),
      textItem({
        text: 'June 2011 - February 2017 (5 years 9 months)',
        y: 490,
      }),
      textItem({ text: 'Palo Alto', y: 470 }),
      textItem({ text: 'HSBC', y: 440 }),
      textItem({ text: '6 years', y: 420 }),
      textItem({
        text: 'Vice President- Bay Area',
        y: 400,
        fontSize: 11.5,
      }),
      textItem({
        text: 'August 2008 - June 2011 (2 years 11 months)',
        y: 380,
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.value).toEqual([
      expect.objectContaining({
        organization: 'First Republic Bank',
        totalDuration: '12 years 1 month',
        positions: [
          expect.objectContaining({
            title: 'Deputy Regional Managing Director',
          }),
          expect.objectContaining({
            location: 'Palo Alto, California',
            title: 'Senior Managing Director',
          }),
          expect.objectContaining({
            location: 'Palo Alto',
            title: 'Managing Director',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'HSBC',
      }),
    ]);
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
        text: 'Executive Produced by Achilles Pelides & Circe Aeaea',
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
            description: 'Executive Produced by Achilles Pelides & Circe Aeaea',
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

  test('classifies 3-letter country codes as location suffixes', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Acme Labs', y: 670 }),
      textItem({ text: 'Staff Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2022', y: 630 }),
      textItem({ text: 'San Francisco, CA, USA', y: 610 }),
      textItem({ text: 'Maple Systems', y: 580 }),
      textItem({ text: 'Engineering Manager', y: 560, fontSize: 11.5 }),
      textItem({ text: '2018 - 2020', y: 540 }),
      textItem({ text: 'Toronto, ON, CAN', y: 520 }),
    ];

    const experiences = ExperienceStructuralParser.parseExperience(items);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Acme Labs',
        positions: [
          expect.objectContaining({
            location: 'San Francisco, CA, USA',
            title: 'Staff Engineer',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Maple Systems',
        positions: [
          expect.objectContaining({
            location: 'Toronto, ON, CAN',
            title: 'Engineering Manager',
          }),
        ],
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

  test('starts long position titles before description fallback', () => {
    const items = [
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Acme Labs', y: 670 }),
      textItem({ text: 'Staff Engineer', y: 650, fontSize: 11.5 }),
      textItem({ text: '2020 - 2021', y: 630 }),
      textItem({
        text: 'Led distributed platform migrations across regions.',
        y: 610,
      }),
      textItem({
        text: 'Senior Director of Product Strategy and Platform Operations',
        y: 590,
        fontSize: 11.5,
      }),
      textItem({ text: '2022 - Present', y: 570 }),
    ];

    const [experience] = ExperienceStructuralParser.parseExperience(items);

    expect(experience.positions).toEqual([
      expect.objectContaining({
        description: 'Led distributed platform migrations across regions.',
        duration: '2020 - 2021',
        title: 'Staff Engineer',
      }),
      expect.objectContaining({
        duration: '2022 - Present',
        title: 'Senior Director of Product Strategy and Platform Operations',
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

  test('classifies dotted initial standalone locations after durations', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Policy Lab', y: 670 }),
      textItem({ text: 'Research Fellow', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2020 - Present', y: 630 }),
      textItem({ text: 'Washington D.C.', y: 610 }),
      textItem({ text: 'Built durable public-sector tools.', y: 590 }),
    ]);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        description: 'Built durable public-sector tools.',
        location: 'Washington D.C.',
        title: 'Research Fellow',
      })
    );
  });

  test('does not classify title-bearing area phrases as locations', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Creative Artists Agency', y: 670 }),
      textItem({
        text: 'Chief of Staff to the CEO - Evolution Media',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({ text: 'April 2013 - April 2014', y: 630 }),
      textItem({
        text: 'Corporate Finance Los Angeles Metropolitan Area',
        y: 610,
      }),
    ]);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        description: 'Corporate Finance Los Angeles Metropolitan Area',
      })
    );
    expect(experience.positions[0].location).toBeUndefined();
  });

  test('prefers organization boundaries over place-word names before title and duration', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'self-employed', y: 670 }),
      textItem({ text: 'Investor', y: 650, fontSize: 11.5 }),
      textItem({ text: 'January 2005 - August 2011', y: 630 }),
      textItem({
        text: 'Public investing a special situation portfolio.',
        y: 610,
      }),
      textItem({ text: 'Los Angeles Animal Services', y: 590 }),
      textItem({ text: 'Commissioner', y: 570, fontSize: 11.5 }),
      textItem({ text: 'September 2003 - August 2005', y: 550 }),
      textItem({ text: 'Appointed by the mayor.', y: 530 }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'self-employed',
        positions: [
          expect.objectContaining({
            description: 'Public investing a special situation portfolio.',
            title: 'Investor',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Los Angeles Animal Services',
        positions: [
          expect.objectContaining({
            description: 'Appointed by the mayor.',
            duration: 'September 2003 - August 2005',
            title: 'Commissioner',
          }),
        ],
      }),
    ]);
  });

  test('keeps adjacent location and place-word organization separate', () => {
    const experiences = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Cantor Fitzgerald LLC', y: 670 }),
      textItem({ text: 'SVP Foreign Exchange Trader', y: 650, fontSize: 11.5 }),
      textItem({ text: 'August 1994 - August 1999', y: 630 }),
      textItem({ text: 'London, England', y: 610 }),
      textItem({ text: 'Tokyo Forex', y: 590 }),
      textItem({ text: 'SVP', y: 570, fontSize: 11.5 }),
      textItem({ text: 'August 1992 - August 1994', y: 550 }),
      textItem({ text: 'Tokyo, Japan', y: 530 }),
    ]);

    expect(experiences).toEqual([
      expect.objectContaining({
        organization: 'Cantor Fitzgerald LLC',
        positions: [
          expect.objectContaining({
            duration: 'August 1994 - August 1999',
            location: 'London, England',
            title: 'SVP Foreign Exchange Trader',
          }),
        ],
      }),
      expect.objectContaining({
        organization: 'Tokyo Forex',
        positions: [
          expect.objectContaining({
            duration: 'August 1992 - August 1994',
            location: 'Tokyo, Japan',
            title: 'SVP',
          }),
        ],
      }),
    ]);
  });

  test('classifies city and full-state standalone locations after durations', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Parametric', y: 670 }),
      textItem({ text: 'Senior Investment Analyst', y: 650, fontSize: 11.5 }),
      textItem({ text: 'September 2016 - May 2019', y: 630 }),
      textItem({ text: 'Minneapolis, Minnesota', y: 610 }),
      textItem({ text: 'Built overlay solutions.', y: 590 }),
    ]);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        description: 'Built overlay solutions.',
        location: 'Minneapolis, Minnesota',
        title: 'Senior Investment Analyst',
      })
    );
  });

  test('keeps standalone city locations out of following descriptions', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Foundation Law Group LLP', y: 670 }),
      textItem({ text: 'Partner', y: 650, fontSize: 11.5 }),
      textItem({
        text: 'August 2017 - Present (8 years 10 months)',
        y: 630,
      }),
      textItem({ text: 'Los Angeles', y: 610 }),
      textItem({
        text: 'Foundation Law Group is a group of Big Firm attorneys.',
        y: 590,
      }),
    ]);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        description: 'Foundation Law Group is a group of Big Firm attorneys.',
        location: 'Los Angeles',
        title: 'Partner',
      })
    );
  });

  test('normalizes trailing commas on greater-area locations', () => {
    const [experience] = ExperienceStructuralParser.parseExperience([
      textItem({ text: 'Experience', y: 700, fontSize: 16 }),
      textItem({ text: 'Cantor Fitzgerald LLC', y: 670 }),
      textItem({
        text: 'Managing Director Institutional Equity Sales',
        y: 650,
        fontSize: 11.5,
      }),
      textItem({
        text: 'September 2001 - October 2016 (15 years 2 months)',
        y: 630,
      }),
      textItem({ text: 'Greater New York City Area,', y: 610 }),
      textItem({ text: '--Increased order flow and revenue.', y: 590 }),
    ]);

    expect(experience.positions[0]).toEqual(
      expect.objectContaining({
        description: '--Increased order flow and revenue.',
        location: 'Greater New York City Area',
        title: 'Managing Director Institutional Equity Sales',
      })
    );
  });

  test('normalizes trailing country codes on greater-area locations', () => {
    for (const countrySuffix of [
      ' US',
      ', US',
      ' U.S.',
      ', U.S.A.',
      ' U S',
      ' U S A',
      ', U. S. A.',
      ' US.',
      ' US,',
      ' U.S.,',
      ' USA ',
      ' U.S.A. ',
      ' U.S., ',
    ]) {
      const [experience] = ExperienceStructuralParser.parseExperience([
        textItem({ text: 'Experience', y: 700, fontSize: 16 }),
        textItem({ text: 'Example Co', y: 670 }),
        textItem({ text: 'Director', y: 650, fontSize: 11.5 }),
        textItem({ text: 'January 2020 - Present', y: 630 }),
        textItem({
          text: `Greater Los Angeles Area${countrySuffix}`,
          y: 610,
        }),
      ]);

      expect(experience.positions[0]).toEqual(
        expect.objectContaining({
          location: 'Greater Los Angeles Area',
          title: 'Director',
        })
      );
    }
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
          parserLine({ index: 3, text: 'January 2020 - Present' }),
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

  test('classifies standalone Venture as a position title', () => {
    const ventureLine = parserLine({ text: 'Venture' });

    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [ventureLine],
        index: 0,
        line: ventureLine,
        state: 'seeking_title',
      })
    ).toBe('position');
  });

  test('covers description continuation helpers directly', () => {
    expect(
      ExperienceStructuralParser['looksLikeDescriptionLine']({
        allLines: ['Tiny'],
        index: 0,
        line: 'Tiny',
      })
    ).toBe(false);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionLine']({
        allLines: ['Owned migration planning for', 'Migration rollout'],
        index: 1,
        line: 'Migration rollout',
        previousLine: 'Owned migration planning for',
      })
    ).toBe(true);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionLine']({
        allLines: [
          'Owned migration planning for',
          'Blue Oak Labs',
          'Staff Engineer',
          'January 2020 - Present',
        ],
        index: 1,
        line: 'Blue Oak Labs',
        previousLine: 'Owned migration planning for',
      })
    ).toBe(false);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionLine']({
        allLines: ['Inspire Medical $INSP IPO'],
        index: 0,
        line: 'Inspire Medical $INSP IPO',
      })
    ).toBe(true);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionLine']({
        allLines: ['Responsibilities: Led platform rollout.'],
        index: 0,
        line: 'Responsibilities: Led platform rollout.',
      })
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

  test('classifies only real location and duration lines for experience metadata', () => {
    for (const falseLocation of [
      'Velocity AI',
      'Mission Control AI',
      'Breakaway Partners OU',
      'Spatial AI',
      'Comcast NBCUniversal SportsTech Accelerator, HeadVantage is redefining',
      'After securing an exclusive partnership with Warner Music, Prescient is now',
    ]) {
      expect(
        ExperienceStructuralParser['looksLikeLocation'](falseLocation)
      ).toBe(false);
    }

    for (const trueLocation of [
      'Los Angeles CA',
      'San Diego',
      'San Diego Metropolitan Area',
      'Tallinn, Harjumaa, Estonia',
      'Dallas, Texas',
      'London Area, United Kingdom',
      'Denver, CO',
      'Greater New York City Area,',
    ]) {
      expect(
        ExperienceStructuralParser['looksLikeLocation'](trueLocation)
      ).toBe(true);
    }

    expect(
      ExperienceStructuralParser['looksLikeDuration'](
        'Resilient Connections was a pop-up non-profit that launched in March 2020 to'
      )
    ).toBe(false);
    expect(
      ExperienceStructuralParser['looksLikeDuration'](
        '2020 - 2020 (less than a year)'
      )
    ).toBe(true);
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [
          parserLine({ index: 0, text: 'Partner' }),
          parserLine({ index: 1, text: 'August 2017 - Present' }),
          parserLine({ index: 2, text: 'San Diego' }),
          parserLine({
            index: 3,
            text: 'Confirm BioSciences is a diagnostic commercialization company.',
          }),
        ],
        index: 2,
        line: parserLine({ index: 2, text: 'San Diego' }),
        state: 'in_description',
      })
    ).toBe('location');
  });

  test('covers remaining structural classification and helper branches', () => {
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [
          parserLine({ index: 0, text: 'Chief Architect' }),
          parserLine({ index: 1, text: 'AI' }),
          parserLine({ index: 2, text: 'Remote' }),
        ],
        index: 1,
        line: parserLine({ index: 1, text: 'AI' }),
        state: 'seeking_dates',
      })
    ).toBe('other');
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [
          parserLine({ index: 0, text: 'Principal Engineer' }),
          parserLine({ index: 1, text: '2020 - 2021' }),
          parserLine({ index: 2, text: 'Page 1 of 2' }),
        ],
        index: 2,
        line: parserLine({ index: 2, text: 'Page 1 of 2' }),
        state: 'in_description',
      })
    ).toBe('other');
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [
          parserLine({
            index: 0,
            text: 'Existing detailed work context with enough words',
          }),
          parserLine({
            index: 1,
            text: 'Detailed delivery narrative that should remain prose.',
          }),
          parserLine({ index: 2, text: '2020 - 2021' }),
        ],
        index: 1,
        line: parserLine({
          index: 1,
          text: 'Detailed delivery narrative that should remain prose.',
        }),
        state: 'in_description',
      })
    ).toBe('description');
    expect(
      ExperienceStructuralParser['classifyLineType']({
        allLines: [
          parserLine({
            index: 0,
            text: 'Owned migration planning with enough context',
          }),
          parserLine({ index: 1, text: 'continued rollout' }),
          parserLine({ index: 2, text: '2020 - 2021' }),
        ],
        index: 1,
        line: parserLine({ index: 1, text: 'continued rollout' }),
        state: 'in_description',
      })
    ).toBe('description');

    expect(
      ExperienceStructuralParser['hasTotalDurationThenPosition'](0, [
        'Example Labs',
        '3 years',
        'Principal Engineer',
      ])
    ).toBe(false);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionContinuationLine'](
        'Client Sites',
        'worked at'
      )
    ).toBe(true);
    expect(
      ExperienceStructuralParser['looksLikeDescriptionContinuationLine'](
        'Client Sites',
        'short'
      )
    ).toBe(false);
    expect(
      ExperienceStructuralParser['looksLikeShortDescriptorEntryHeader'](
        'Principal Engineer',
        0,
        ['Principal Engineer', '2020 - 2021']
      )
    ).toBe(true);
  });

  test('covers work-experience completion and warning edge branches directly', () => {
    expect(
      ExperienceStructuralParser['buildWorkExperiences']([
        structuralSection({
          text: 'Example Labs',
          type: 'organization',
        }),
        structuralSection({
          text: 'Principal Engineer',
          type: 'position',
        }),
        structuralSection({
          text: 'principal engineer',
          type: 'position',
        }),
        structuralSection({
          text: '2020 - 2021',
          type: 'duration',
        }),
      ])
    ).toEqual([
      expect.objectContaining({
        positions: [
          expect.objectContaining({
            title: 'principal engineer',
          }),
        ],
      }),
    ]);

    expect(
      ExperienceStructuralParser['completeWorkExperience']({
        descriptionLines: [],
        position: null,
        workExperience: {
          organization: 'Example Labs',
          positions: [
            {
              description: '',
              duration: '2020 - 2021',
              title: 'Principal Engineer',
            },
          ],
        },
      })
    ).toEqual(
      expect.objectContaining({
        organization: 'Example Labs',
      })
    );
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
      ExperienceStructuralParser['createExperienceWarnings']([
        {
          organization: 'Empty Company',
          positions: [],
        },
      ])
    ).toEqual([
      expect.objectContaining({
        field: 'positions',
        rawText: 'Empty Company',
      }),
    ]);
  });

  test('covers duration extraction fallbacks with embedded and compact years', () => {
    expect(
      ExperienceStructuralParser['extractCleanDuration'](
        'Managed launch work in fiscal 2020 planning cycle with no range text here'
      )
    ).toBe('fiscal 2020');
    expect(
      ExperienceStructuralParser['extractCleanDuration'](
        'FY2020 planning cycle with long text long text long text long text long text'
      )
    ).toBe('FY2020 planning cycle with long text long text lon');
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
