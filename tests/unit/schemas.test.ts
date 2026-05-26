import {
  ExperienceSchema,
  LinkedInProfileSchema,
  ParseDiagnosticsSchema,
  ParseResultSchema,
  ParseWarningSchema,
} from '../../src/index.js';

describe('exported Zod schemas', () => {
  test('validates profile and result shapes', () => {
    const profile = LinkedInProfileSchema.parse({
      contact: {
        email: 'person@example.com',
      },
      top_skills: ['TypeScript'],
      languages: [],
      certifications: [],
      volunteer_work: [],
      projects: [],
      publications: [],
      honors_awards: [],
      experience: [
        {
          title: 'Engineer',
          company: 'Northstar AI',
          duration: '2020 - 2022',
          dates: {
            originalText: '2020 - 2022',
            start: { iso: '2020', precision: 'year', text: '2020' },
            end: { iso: '2022', precision: 'year', text: '2022' },
            kind: 'completed',
          },
        },
      ],
      experience_groups: [
        {
          company: 'Northstar AI',
          positions: [
            {
              title: 'Engineer',
              duration: '2020 - 2022',
              dates: {
                originalText: '2020 - 2022',
                start: { iso: '2020', precision: 'year', text: '2020' },
                end: { iso: '2022', precision: 'year', text: '2022' },
                kind: 'completed',
              },
            },
          ],
        },
      ],
      education: [],
    });

    expect(profile.experience[0].dates?.start?.iso).toBe('2020');
    expect(
      ParseResultSchema.safeParse({
        diagnostics: {
          confidence: 0.82,
          isEmpty: false,
          isLikelyLinkedInExport: true,
          sectionsFound: ['experience', 'education'],
        },
        profile,
        warnings: [],
      }).success
    ).toBe(true);
  });

  test('safeParse rejects invalid schema inputs', () => {
    expect(ExperienceSchema.safeParse({ title: 'Engineer' }).success).toBe(
      false
    );
    expect(ParseWarningSchema.safeParse({ code: 'unknown' }).success).toBe(
      false
    );
    expect(
      ParseDiagnosticsSchema.safeParse({
        confidence: 1.2,
        isEmpty: false,
        isLikelyLinkedInExport: true,
        sectionsFound: [],
      }).success
    ).toBe(false);
    expect(
      ExperienceSchema.safeParse({
        title: 'Engineer',
        company: 'Northstar AI',
        duration: '2020 - Present',
        dates: {
          kind: 'current',
          originalText: '2020 - Present',
          start: { iso: '2020', precision: 'year', text: '2020' },
          end: { iso: '2022', precision: 'year', text: '2022' },
        },
      }).success
    ).toBe(false);
  });

  test('validates section warning shapes', () => {
    expect(
      ParseWarningSchema.parse({
        code: 'section_parse_warning',
        section: 'experience',
        entry: 1,
        field: 'dates',
        message: 'Could not parse date range',
        rawText: 'whenever',
      })
    ).toEqual(
      expect.objectContaining({
        code: 'section_parse_warning',
        section: 'experience',
      })
    );
  });
});
