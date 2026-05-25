import { EducationParser } from '../../src/parsers/education.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

describe('EducationParser', () => {
  test('removes extracted years from degree text', () => {
    const educations = EducationParser.parse(`
      Education
      Example University
      Bachelor of Science 2016 in Engineering
      State College
      Master of Business (2018)
    `);

    expect(educations).toEqual([
      expect.objectContaining({
        institution: 'Example University',
        degree: 'Bachelor of Science in Engineering',
        year: '2016',
      }),
      expect.objectContaining({
        institution: 'State College',
        degree: 'Master of Business',
        year: '2018',
      }),
    ]);
  });

  test('recognizes Brazilian Portuguese degree names', () => {
    const educations = EducationParser.parse(`
      Education
      Universidade Federal Exemplo
      Bacharelado em Engenharia de Computação · (2010 - 2014)
      Faculdade Municipal
      Mestrado em Ciência de Dados 2018
      Instituto Técnico
      Tecnólogo em Sistemas para Internet
    `);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Bacharelado em Engenharia de Computação',
        institution: 'Universidade Federal Exemplo',
        year: '2010 - 2014',
      }),
      expect.objectContaining({
        degree: 'Mestrado em Ciência de Dados',
        institution: 'Faculdade Municipal',
        year: '2018',
      }),
      expect.objectContaining({
        degree: 'Tecnólogo em Sistemas para Internet',
        institution: 'Instituto Técnico',
      }),
    ]);
  });

  test('recognizes associate and certificate degree names', () => {
    const educations = EducationParser.parse(`
      Education
      Example Community College
      Associate of Arts 2012
      Technical Institute
      Certificate in Data Analytics 2014
      Faculdade Municipal
      Certificação em Gestão 2018
    `);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Associate of Arts',
        institution: 'Example Community College',
        year: '2012',
      }),
      expect.objectContaining({
        degree: 'Certificate in Data Analytics',
        institution: 'Technical Institute',
        year: '2014',
      }),
      expect.objectContaining({
        degree: 'Certificação em Gestão',
        institution: 'Faculdade Municipal',
        year: '2018',
      }),
    ]);
  });

  test('parses structural education by visual hierarchy', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({ fontSize: 14, text: 'Universidade Exemplo', y: 730 }),
      structuralLine({
        fontSize: 10,
        text: 'Licenciatura em Matemática · (2012 - 2016)',
        y: 710,
      }),
      structuralLine({ fontSize: 14, text: 'Instituto Exemplo', y: 680 }),
      structuralLine({
        fontSize: 10,
        text: 'Pós-graduação em Gestão de Produto 2018',
        y: 660,
      }),
      structuralLine({ fontSize: 16, text: 'Projects', y: 620 }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Licenciatura em Matemática',
        institution: 'Universidade Exemplo',
        year: '2012 - 2016',
      }),
      expect.objectContaining({
        degree: 'Pós-graduação em Gestão de Produto',
        institution: 'Instituto Exemplo',
        year: '2018',
      }),
    ]);
  });

  test('joins wrapped structural degree lines before extracting dates', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Universidade Veiga de Almeida',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Master of Business Administration - MBA, Business',
        y: 710,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Management · (2017 - 2018)',
        y: 696,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        dates: expect.objectContaining({
          originalText: '2017 - 2018',
        }),
        degree: 'Master of Business Administration - MBA, Business Management',
        institution: 'Universidade Veiga de Almeida',
        year: '2017 - 2018',
      }),
    ]);
  });

  test('joins slash-wrapped structural degree lines without adding a space', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'ETE Ferreira Viana (FAETEC)',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Telecommunications Technician, Telecommunications Technology/',
        y: 710,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Technician · (2002 - 2005)',
        y: 696,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(educations[0]).toEqual(
      expect.objectContaining({
        degree:
          'Telecommunications Technician, Telecommunications Technology/Technician',
        year: '2002 - 2005',
      })
    );
  });

  test('joins no-date wrapped structural degree lines', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Universidade Veiga de Almeida',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Master of Business Administration - MBA, Business',
        y: 710,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Management',
        y: 696,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(educations[0]).toEqual(
      expect.objectContaining({
        degree: 'Master of Business Administration - MBA, Business Management',
        location: '',
        year: '',
      })
    );
  });

  test('preserves degree text when structural date ranges share the same line', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({ fontSize: 14, text: 'Harvard University', y: 730 }),
      structuralLine({
        fontSize: 10,
        text: 'BA, Government · (1998 - 2002)',
        y: 710,
      }),
      structuralLine({ fontSize: 14, text: 'École Polytechnique', y: 680 }),
      structuralLine({
        fontSize: 10,
        text: 'Intermediate Certificate of French Language Français B1/B2 · (January 2022)',
        y: 660,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 620 }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'BA, Government',
        institution: 'Harvard University',
        year: '1998 - 2002',
      }),
      expect.objectContaining({
        degree: 'Intermediate Certificate of French Language Français B1/B2',
        institution: 'École Polytechnique',
        year: 'January 2022',
      }),
    ]);
  });

  test('joins wrapped institution names before assigning degree details', () => {
    const [education] = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'City University of New York-Baruch College - Zicklin School of',
        y: 730,
      }),
      structuralLine({ fontSize: 14, text: 'Business', y: 716 }),
      structuralLine({
        fontSize: 10,
        text: 'MBA, Finance · (2002 - 2004)',
        y: 696,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(education).toEqual(
      expect.objectContaining({
        degree: 'MBA, Finance',
        institution:
          'City University of New York-Baruch College - Zicklin School of Business',
        year: '2002 - 2004',
      })
    );
  });

  test('does not append comma-adjacent non-academic details to degree text', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Example University',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Certificate, Honors',
        y: 710,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Policy',
        y: 696,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(educations[0]).toEqual(
      expect.objectContaining({
        degree: 'Certificate, Honors',
        location: '',
      })
    );
  });

  test('splits structural institution names that contain degree keywords', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 12,
        text: 'Fletcher, The Graduate School of Global Affairs at Tufts University',
        y: 730,
      }),
      structuralLine({
        fontSize: 10.5,
        text: 'Post-MBA Fellowship · (2019 - 2020)',
        y: 710,
      }),
      structuralLine({
        fontSize: 12,
        text: 'The London School of Economics and Political Science (LSE)',
        y: 680,
      }),
      structuralLine({
        fontSize: 10.5,
        text: 'Graduate Diploma, Economics · (2017 - 2019)',
        y: 660,
      }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Post-MBA Fellowship',
        institution:
          'Fletcher, The Graduate School of Global Affairs at Tufts University',
        year: '2019 - 2020',
      }),
      expect.objectContaining({
        degree: 'Graduate Diploma, Economics',
        institution:
          'The London School of Economics and Political Science (LSE)',
        year: '2017 - 2019',
      }),
    ]);
  });

  test('recognizes dotted and hyphenated structural education locations', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Example University',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Computer Science',
        y: 710,
      }),
      structuralLine({ fontSize: 10, text: 'Winston-Salem, NC', y: 696 }),
      structuralLine({
        fontSize: 14,
        text: 'State College',
        y: 660,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Bachelor of Science',
        y: 640,
      }),
      structuralLine({ fontSize: 10, text: 'Washington, D.C.', y: 626 }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 600 }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Computer Science',
        location: 'Winston-Salem, NC',
      }),
      expect.objectContaining({
        degree: 'Bachelor of Science',
        location: 'Washington, D.C.',
      }),
    ]);
  });

  test('does not append structural locations to an existing degree', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Example University',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Computer Science',
        y: 710,
      }),
      structuralLine({ fontSize: 10, text: 'New York, NY', y: 696 }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(educations[0]).toEqual(
      expect.objectContaining({
        degree: 'Computer Science',
        location: 'New York, NY',
      })
    );
  });

  test('adds structured dates for education ranges', () => {
    const [education] = EducationParser.parse(`
      Education
      Example University
      Bachelor of Science
      2020 - 2024
    `);

    expect(education.dates).toEqual({
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
    });
  });

  test('parses standalone year and location detail lines', () => {
    const [education] = EducationParser.parse(`
      Education
      Example University
      Bachelor of Science
      2016
      Austin, Texas
    `);

    expect(education).toEqual(
      expect.objectContaining({
        degree: 'Bachelor of Science',
        institution: 'Example University',
        location: 'Austin, Texas',
        year: '2016',
      })
    );
  });

  test('returns no structural entries when an education section is absent', () => {
    expect(EducationParser.parseStructural([])).toEqual([]);
    expect(
      EducationParser.parseStructural([
        structuralLine({ fontSize: 16, text: 'Experience', y: 760 }),
        structuralLine({ fontSize: 10, text: 'Example University', y: 730 }),
      ])
    ).toEqual([]);
  });

  test('uses the first structural detail as an institution when hierarchy is missing', () => {
    const [education] = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 10,
        text: 'Certificate in Product Design 2020',
        y: 730,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 700 }),
    ]);

    expect(education).toEqual(
      expect.objectContaining({
        degree: '',
        institution: 'Certificate in Product Design 2020',
      })
    );
  });

  test('warns when an education year cannot be parsed as a profile date', () => {
    const result = EducationParser.parseWithWarnings(`
      Education
      Archive College
      Certificate in Cataloging
      1888 - 1889
    `);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'dates',
        rawText: '1888 - 1889',
      }),
    ]);
  });

  test('creates warnings for unparseable education sections and missing institutions', () => {
    expect(
      EducationParser['createEducationWarnings'](
        [],
        ['Continuing studies without an institution']
      )
    ).toEqual([
      expect.objectContaining({
        field: 'entry',
        section: 'education',
      }),
    ]);
    expect(
      EducationParser['createEducationWarnings'](
        [
          {
            degree: 'Certificate in Cataloging',
            institution: '',
            location: '',
            year: '',
          },
        ],
        []
      )
    ).toEqual([
      expect.objectContaining({
        field: 'institution',
        rawText: 'Certificate in Cataloging',
      }),
    ]);
  });
});

function structuralLine({
  fontSize,
  text,
  y,
}: {
  fontSize: number;
  text: string;
  y: number;
}): StructuralLine {
  return {
    column: 'right',
    fontSize,
    height: fontSize,
    text,
    width: text.length * 5,
    x: 220,
    y,
  };
}
