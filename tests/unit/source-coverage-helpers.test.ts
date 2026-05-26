import {
  collectOutputValues,
  createSourceCoverageReport,
  createSourceSegmentsFromLayoutText,
} from '../../scripts/lib/source-coverage-helpers.mjs';

describe('source coverage helpers', () => {
  test('classifies right-column profile text separately from left-column contact text', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Contact',
        '                              Cassandra Troy',
        'cassandra@example.com              Staff Engineer',
        '                              San Francisco, California',
        '',
        '                              Summary',
        '                              Builds robust parsers.',
        '',
        '                              Experience',
        '                              Example Co',
        '                              Staff Engineer',
      ].join('\n')
    );

    expect(sourceView.mainColumnStart).toBeGreaterThan(12);
    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column: 'main',
          section: 'identity',
          text: 'Cassandra Troy',
        }),
        expect.objectContaining({
          column: 'sidebar',
          section: 'contact',
          text: 'cassandra@example.com',
        }),
        expect.objectContaining({
          column: 'main',
          section: 'summary',
          text: 'Builds robust parsers.',
        }),
        expect.objectContaining({
          column: 'main',
          section: 'experience',
          text: 'Example Co',
        }),
      ])
    );
  });

  test('requires source text to match output values in the same inferred section', () => {
    const report = createSourceCoverageReport({
      layoutText: ['Summary', 'Engineer', 'Experience', 'Engineer'].join('\n'),
      parsedJson: {
        profile: {
          name: '',
          headline: '',
          location: '',
          contact: {},
          top_skills: [],
          languages: [],
          certifications: [],
          volunteer_work: [],
          projects: [],
          publications: [],
          honors_awards: [],
          summary: 'Engineer',
          experience: [],
          experience_groups: [],
          education: [],
        },
        warnings: [],
      },
      pdfFileName: 'same-section.pdf',
    });

    expect(report.unmatchedSourceSegments).toEqual([
      expect.objectContaining({
        section: 'experience',
        text: 'Engineer',
      }),
    ]);
  });

  test('classifies volunteering experience headings as volunteer work', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      ['Volunteering Experience', 'Board Member'].join('\n')
    );

    expect(sourceView.segments).toEqual([
      expect.objectContaining({
        section: 'volunteer_work',
        text: 'Board Member',
      }),
    ]);
  });

  test('reports token-only matches separately from exact source matches', () => {
    const report = createSourceCoverageReport({
      layoutText: ['Experience', 'Staff Engineer, ML'].join('\n'),
      parsedJson: {
        profile: {
          name: '',
          headline: '',
          location: '',
          contact: {},
          top_skills: [],
          languages: [],
          certifications: [],
          volunteer_work: [],
          projects: [],
          publications: [],
          honors_awards: [],
          summary: '',
          experience: [
            {
              company: 'Example Co',
              title: 'Staff Engineer ML',
            },
          ],
          experience_groups: [],
          education: [],
        },
        warnings: [],
      },
      pdfFileName: 'loose.pdf',
    });

    expect(report.unmatchedSourceSegmentCount).toBe(0);
    expect(report.looseSourceMatches).toEqual([
      expect.objectContaining({
        matchedValue: 'Staff Engineer ML',
        text: 'Staff Engineer, ML',
      }),
    ]);
  });

  test('treats punctuation-spacing differences as exact source matches', () => {
    const report = createSourceCoverageReport({
      layoutText: ['Experience', 'London , England'].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            location: 'London, England',
          },
        ],
      }),
      pdfFileName: 'punctuation-spacing.pdf',
    });

    expect(report.unmatchedSourceSegmentCount).toBe(0);
    expect(report.looseSourceMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
  });

  test('matches wrapped adjacent same-section source segments exactly', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Languages                         Experience',
        'Chinese (Traditional) (Limited    Manhattan Venture Partners',
        'Working)                          Vice President',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Manhattan Venture Partners',
            title: 'Vice President',
          },
        ],
        languages: [
          {
            language: 'Chinese (Traditional)',
            proficiency: 'Limited Working',
          },
        ],
      }),
      pdfFileName: 'wrapped-language.pdf',
    });

    expect(report.unmatchedSourceSegmentCount).toBe(0);
    expect(report.looseSourceMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
  });

  test('traces output values found in another source section separately', () => {
    const report = createSourceCoverageReport({
      layoutText: ['Summary', 'Reach Cassandra at cassandra@example.com.'].join(
        '\n'
      ),
      parsedJson: parsedJsonWithProfile({
        contact: {
          email: 'cassandra@example.com',
        },
        summary: 'Reach Cassandra at cassandra@example.com.',
      }),
      pdfFileName: 'cross-section-email.pdf',
    });

    expect(report.unmatchedSourceSegmentCount).toBe(0);
    expect(report.looseSourceMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
    expect(report.crossSectionOutputMatchCount).toBe(1);
    expect(report.crossSectionOutputMatches).toEqual([
      expect.objectContaining({
        matchedSection: 'summary',
        path: 'profile.contact.email',
        section: 'contact',
      }),
    ]);
  });

  test('does not require derived date fields or warnings to trace to PDF text', () => {
    const values = collectOutputValues({
      profile: {
        experience: [
          {
            dates: {
              kind: 'current',
              start: {
                iso: '2024-07',
                precision: 'month',
                text: 'July 2024',
              },
            },
          },
        ],
        languages: [
          {
            name: 'Esperanto',
            proficiency: 'Unknown',
          },
        ],
      },
      warnings: [
        {
          code: 'missing_profile_field',
          message: 'Could not extract contact email',
        },
      ],
    });

    expect(values).toEqual([
      {
        path: 'profile.experience[0].dates.start.text',
        section: 'experience',
        value: 'July 2024',
      },
      {
        path: 'profile.languages[0].name',
        section: 'languages',
        value: 'Esperanto',
      },
    ]);
  });

  test('matches wrapped URL source text against normalized output URLs', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Contact',
        'www.linkedin.com/in/',
        'cassandra-troy (LinkedIn)',
      ].join('\n'),
      parsedJson: {
        profile: {
          name: '',
          headline: '',
          location: '',
          contact: {
            linkedin_url: 'https://linkedin.com/in/cassandra-troy',
          },
          top_skills: [],
          languages: [],
          certifications: [],
          volunteer_work: [],
          projects: [],
          publications: [],
          honors_awards: [],
          summary: '',
          experience: [],
          experience_groups: [],
          education: [],
        },
        warnings: [],
      },
      pdfFileName: 'wrapped-url.pdf',
    });

    expect(report.untracedOutputValueCount).toBe(0);
  });
});

function parsedJsonWithProfile(profile: Record<string, unknown>) {
  return {
    profile: {
      name: '',
      headline: '',
      location: '',
      contact: {},
      top_skills: [],
      languages: [],
      certifications: [],
      volunteer_work: [],
      projects: [],
      publications: [],
      honors_awards: [],
      summary: '',
      experience: [],
      experience_groups: [],
      education: [],
      ...profile,
    },
    warnings: [],
  };
}
