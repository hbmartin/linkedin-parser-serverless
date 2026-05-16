import { BasicInfoParser } from '../../src/parsers/basic-info.js';
import type { StructuralLine } from '../../src/utils/structural-lines.js';

describe('BasicInfoParser', () => {
  test('does not classify spaced email addresses as short company headlines', () => {
    const profile = BasicInfoParser.parse(`
      Test User
      name @ domain.com
      Senior Engineer @ ExampleCo
      Los Angeles, California, United States
    `);

    expect(profile.headline).toBe('Senior Engineer @ ExampleCo');
  });

  test('extracts generic names without exclusion words or ASCII-only assumptions', () => {
    const strategicProfile = BasicInfoParser.parse(`
      Strategic Planning
      strategic.planning@custom.dev
      Principal Advisor
      München, Bayern, Deutschland
    `);
    const portugueseProfile = BasicInfoParser.parse(`
      MARIA DE SOUZA
      maria.souza@empresa.com.br
      São Paulo, São Paulo, Brasil
    `);
    const apostropheProfile = BasicInfoParser.parse(`
      Sean O'Neil
      sean.oneil@example.consulting
      Dublin, Leinster, Ireland
    `);

    expect(strategicProfile.name).toBe('Strategic Planning');
    expect(strategicProfile.location).toBe('München, Bayern, Deutschland');
    expect(portugueseProfile.name).toBe('MARIA DE SOUZA');
    expect(portugueseProfile.location).toBe('São Paulo, São Paulo, Brasil');
    expect(apostropheProfile.name).toBe("Sean O'Neil");
  });

  test('omits email instead of returning an empty string', () => {
    const profile = BasicInfoParser.parse(`
      Missing Email User
      Product Advisor
      Toronto, Ontario, Canada
    `);

    expect(profile.contact.email).toBeUndefined();
  });

  test('does not emit basic-info warnings for later empty sections', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Test User
      Principal Advisor
      Toronto, Ontario, Canada

      Experience
      Example Labs
      Summary
      Contact
    `);

    expect(result.warnings).toEqual([]);
  });

  test('reports adjacent empty contact and summary sections in the header', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Test User
      Principal Advisor
      Contact
      Available on request
      Summary
    `);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'contact',
        section: 'contact',
      }),
      expect.objectContaining({
        field: 'summary',
        section: 'summary',
      }),
    ]);
  });

  test('stops header warnings at later target sections', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Test User
      Principal Advisor
      Contact

      Experience
      Example Labs
      Summary
    `);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'contact',
        section: 'contact',
      }),
    ]);
  });

  test('stops header warnings at boundary sections', () => {
    const result = BasicInfoParser.parseWithWarnings(`
      Test User
      Principal Advisor
      Contact

      Courses
      Summary
    `);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        field: 'contact',
        section: 'contact',
      }),
    ]);
  });

  test('extracts structural summary from its visual column', () => {
    const result = BasicInfoParser.parseStructuralWithWarnings(
      [
        'Test User',
        'Principal Advisor',
        'Toronto, Ontario, Canada',
        'Summary',
        'TypeScript',
        'Builds products across engineering and operations.',
        'Languages',
        'English (Native or Bilingual)',
        'with focus on reliable delivery and maintainable systems.',
        'Experience',
      ].join('\n'),
      [
        structuralLine({ column: 'right', text: 'Summary', y: 700 }),
        structuralLine({ column: 'left', text: 'TypeScript', y: 690 }),
        structuralLine({
          column: 'right',
          text: 'Builds products across engineering and operations.',
          y: 690,
        }),
        structuralLine({ column: 'left', text: 'Languages', y: 680 }),
        structuralLine({
          column: 'left',
          text: 'English (Native or Bilingual)',
          y: 670,
        }),
        structuralLine({
          column: 'right',
          text: 'with focus on reliable delivery and maintainable systems.',
          y: 670,
        }),
        structuralLine({ column: 'right', text: 'Experience', y: 660 }),
      ]
    );

    expect(result.value.summary).toBe(
      'Builds products across engineering and operations. with focus on reliable delivery and maintainable systems.'
    );
  });

  test('extracts pipe-delimited headlines and phone contact fields', () => {
    const profile = BasicInfoParser.parse(`
      Test User
      Product | Engineering | Operations
      Los Angeles, California, United States
      test.user@example.com
      (415) 5555-0101
    `);

    expect(profile.headline).toBe('Product | Engineering | Operations');
    expect(profile.contact).toEqual(
      expect.objectContaining({
        email: 'test.user@example.com',
        phone: '(415) 5555-0101',
      })
    );
  });

  test('uses the multiline engineering manager headline fallback', () => {
    const profile = BasicInfoParser.parse(`
      Test User
      Engineering Manager @ Acme |
      Platform Reliability
    `);

    expect(profile.headline).toBe(
      'Engineering Manager @ Acme | Platform Reliability'
    );
  });

  test('builds a fallback summary from long identity lines', () => {
    const profile = BasicInfoParser.parse(`
      Test User
      Principal Advisor
      Toronto, Ontario, Canada
      Portfolio Focus
      Advisory Practice
      Builds reliable product and engineering systems for teams that need repeatable delivery across multiple business units.
      Partners with operations leaders to remove delivery risk and improve maintainability across the platform.
    `);

    expect(profile.summary).toBe(
      'Builds reliable product and engineering systems for teams that need repeatable delivery across multiple business units.'
    );
  });

  test('preserves structural summary length consistently with fallback summary parsing', () => {
    const longSummaryLine = `Builds ${'reliable systems '.repeat(40)}`.trim();
    const result = BasicInfoParser.parseStructuralWithWarnings(
      ['Test User', 'Principal Advisor', 'Summary', longSummaryLine].join('\n'),
      [
        structuralLine({ column: 'right', text: 'Summary', y: 700 }),
        structuralLine({ column: 'right', text: longSummaryLine, y: 690 }),
      ]
    );

    expect(result.value.summary).toBe(longSummaryLine);
  });
});

function structuralLine({
  column,
  text,
  y,
}: {
  column: StructuralLine['column'];
  text: string;
  y: number;
}): StructuralLine {
  return {
    column,
    fontSize: 10,
    height: 10,
    text,
    width: text.length * 5,
    x: column === 'left' ? 20 : 220,
    y,
  };
}
