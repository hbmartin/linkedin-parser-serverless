import { BasicInfoParser } from '../../src/parsers/basic-info.js';

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
});
