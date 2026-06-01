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
      Technical Institute
      Executive Program (January 2019 - 2020)
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
      expect.objectContaining({
        institution: 'Technical Institute',
        degree: 'Executive Program',
        year: 'January 2019 - 2020',
      }),
    ]);
  });

  test('cleans month-qualified dates from degree text', () => {
    const educations = EducationParser.parse(`
      Education
      Executive Institute
      Executive Program - (January 2019 - December 2020)
      Language School
      Certificate in French · (January 2022)
    `);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Executive Program',
        institution: 'Executive Institute',
        year: 'January 2019 - December 2020',
      }),
      expect.objectContaining({
        degree: 'Certificate in French',
        institution: 'Language School',
        year: 'January 2022',
      }),
    ]);
  });

  test('cleans Unicode dash date ranges from degree text', () => {
    const educations = EducationParser.parse(`
      Education
      Unicode Dash Institute
      Certificate in Strategy · (January 2019 – December 2020)
    `);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Certificate in Strategy',
        institution: 'Unicode Dash Institute',
        year: 'January 2019 - December 2020',
      }),
    ]);
  });

  test('cleans localized month-qualified dates from degree text', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Utdanning', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: "King's College London",
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: "Bachelor's degree, Politics, Philosophy and Economics · (september",
        y: 710,
      }),
      structuralLine({ fontSize: 10, text: '2018 - juni 2021)', y: 696 }),
      structuralLine({ fontSize: 14, text: 'Blindern VGS', y: 680 }),
      structuralLine({
        fontSize: 10,
        text: 'International Baccalaureate · (august 2016 - juni 2018)',
        y: 660,
      }),
      structuralLine({ fontSize: 16, text: 'Erfaring', y: 620 }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        dates: expect.objectContaining({
          originalText: 'september 2018 - juni 2021',
          start: expect.objectContaining({ iso: '2018-09' }),
          end: expect.objectContaining({ iso: '2021-06' }),
        }),
        degree: "Bachelor's degree, Politics, Philosophy and Economics",
        institution: "King's College London",
        year: 'september 2018 - juni 2021',
      }),
      expect.objectContaining({
        dates: expect.objectContaining({
          originalText: 'august 2016 - juni 2018',
          start: expect.objectContaining({ iso: '2016-08' }),
          end: expect.objectContaining({ iso: '2018-06' }),
        }),
        degree: 'International Baccalaureate',
        institution: 'Blindern VGS',
        year: 'august 2016 - juni 2018',
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

  test('recognizes localized structural education headers', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Formation', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'University of Southern California',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'Master’s Degree, Petroleum Engineering · (2014 - 2015)',
        y: 710,
      }),
      structuralLine({ fontSize: 16, text: 'Expérience', y: 680 }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'Master’s Degree, Petroleum Engineering',
        institution: 'University of Southern California',
        year: '2014 - 2015',
      }),
    ]);
  });

  test('repairs missing grade separator in structural degree text', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({ fontSize: 14, text: 'CHIPPING NORTON SCHOOL', y: 730 }),
      structuralLine({
        fontSize: 10,
        text: "11 GCSE'SA*-C, ART, DESIGN, P.E, FRENCH, GEOGRAPHY, MATHS,",
        y: 710,
      }),
      structuralLine({
        fontSize: 10,
        text: 'SCIENCE, ENGLISH, R.E, ICT · (2004 - 2006)',
        y: 690,
      }),
    ]);

    expect(educations[0]?.degree).toBe(
      "11 GCSE'S A*-C, ART, DESIGN, P.E, FRENCH, GEOGRAPHY, MATHS, SCIENCE, ENGLISH, R.E, ICT"
    );
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

  test('joins minor degree continuations', () => {
    const [education] = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({ fontSize: 14, text: 'University of Denver', y: 730 }),
      structuralLine({
        fontSize: 10,
        text: 'Bachelor of Science (B.S.) Bachelor of Arts (B.A.), Economics , History, Minor',
        y: 710,
      }),
      structuralLine({
        fontSize: 10,
        text: 'in Speech Communication',
        y: 696,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(education).toEqual(
      expect.objectContaining({
        degree:
          'Bachelor of Science (B.S.) Bachelor of Arts (B.A.), Economics , History, Minor in Speech Communication',
        institution: 'University of Denver',
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

  test('joins multi-word school of institution continuations', () => {
    const [education] = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Example University School of',
        y: 730,
      }),
      structuralLine({
        fontSize: 14,
        text: 'Business Administration',
        y: 716,
      }),
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
        institution: 'Example University School of Business Administration',
        year: '2002 - 2004',
      })
    );
  });

  test('joins same-size school-of institution continuations before degree parsing', () => {
    const educations = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Massachusetts Institute of Technology - Sloan School of',
        y: 730,
      }),
      structuralLine({ fontSize: 14, text: 'Management', y: 716 }),
      structuralLine({
        fontSize: 10,
        text: 'MBA · (August 2010 - August 2012)',
        y: 696,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 660 }),
    ]);

    expect(educations).toEqual([
      expect.objectContaining({
        degree: 'MBA',
        institution:
          'Massachusetts Institute of Technology - Sloan School of Management',
        year: 'August 2010 - August 2012',
      }),
    ]);
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

  test('keeps economics institution names in text fallback parsing', () => {
    const [education] = EducationParser.parse(`
      Education
      London School of Economics
      Graduate Diploma, Economics · (2017 - 2019)
    `);

    expect(education).toEqual(
      expect.objectContaining({
        degree: 'Graduate Diploma, Economics',
        institution: 'London School of Economics',
        year: '2017 - 2019',
      })
    );
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

  test('classifies comma-separated academic program details as degree text', () => {
    const [education] = EducationParser.parseStructural([
      structuralLine({ fontSize: 16, text: 'Education', y: 760 }),
      structuralLine({
        fontSize: 14,
        text: 'Columbia Business School',
        y: 730,
      }),
      structuralLine({
        fontSize: 10,
        text: 'YPO Academy, CIBE',
        y: 710,
      }),
      structuralLine({ fontSize: 16, text: 'Experience', y: 680 }),
    ]);

    expect(education).toEqual(
      expect.objectContaining({
        degree: 'YPO Academy, CIBE',
        institution: 'Columbia Business School',
        location: '',
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

  test('covers structural degree detail helper branches', () => {
    const educationWithDatedDegree = {
      degree: '',
      institution: 'Example University',
      location: '',
      year: '',
    };
    const educationWithStandaloneYear = {
      degree: '',
      institution: 'Example University',
      location: '',
      year: '',
    };

    EducationParser['addStructuralEducationDetail']({
      education: educationWithDatedDegree,
      line: 'Product Design 2016',
    });
    EducationParser['addStructuralEducationDetail']({
      education: educationWithStandaloneYear,
      line: '2016',
    });

    expect(educationWithDatedDegree).toEqual(
      expect.objectContaining({
        degree: 'Product Design',
        year: '2016',
      })
    );
    expect(educationWithStandaloneYear).toEqual(
      expect.objectContaining({
        degree: '',
        year: '2016',
      })
    );

    expect(
      EducationParser['shouldAppendStructuralDegreePart']({
        degreePart: '',
        existingDegree: 'Bachelor of',
        line: '',
        year: '',
      })
    ).toBe(false);
    expect(
      EducationParser['shouldAppendStructuralDegreePart']({
        degreePart: 'New York, NY',
        existingDegree: 'Bachelor of Science',
        line: 'New York, NY',
        year: '2020',
      })
    ).toBe(false);
    expect(
      EducationParser['looksLikeInstitutionContinuation']({
        line: 'Business',
      })
    ).toBe(false);
    expect(
      EducationParser['looksLikeInstitutionContinuation']({
        institution: 'Example University School of',
        line: 'Business',
      })
    ).toBe(true);
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
