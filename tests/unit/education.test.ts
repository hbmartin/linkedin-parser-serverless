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
