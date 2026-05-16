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
