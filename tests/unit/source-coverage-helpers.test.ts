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

  test('classifies standalone experience locations without confusing the next company', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Foundation Law Group LLP',
        'Partner',
        'August 2017 - Present (8 years 10 months)',
        'Los Angeles',
        'Foundation Law Group built client tools.',
        'Arent Fox',
        'Partner',
        'January 2013 - August 2017 (4 years 8 months)',
        'DLA Piper',
        'Partner',
        'January 2006 - December 2012 (7 years)',
        'Los Angeles',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          experienceGroupIndex: 0,
          experiencePositionIndex: 0,
          fieldRole: 'location',
          text: 'Los Angeles',
        }),
        expect.objectContaining({
          experienceGroupIndex: 2,
          experiencePositionIndex: 2,
          fieldRole: 'organization',
          text: 'DLA Piper',
        }),
      ])
    );
  });

  test('reports location lines misclassified into experience descriptions', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Foundation Law Group LLP',
        'Partner',
        'August 2017 - Present (8 years 10 months)',
        'Los Angeles',
        'Built durable client tools.',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Foundation Law Group LLP',
            title: 'Partner',
            duration: 'August 2017 - Present',
            description: 'Los Angeles Built durable client tools.',
          },
        ],
      }),
      pdfFileName: 'experience-location-description-mismatch.pdf',
    });

    expect(report.unmatchedSourceSegmentCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
    expect(report.fieldMismatchOutputMatchCount).toBe(1);
    expect(report.fieldMismatchOutputMatches).toEqual([
      expect.objectContaining({
        outputFieldRole: 'description',
        path: 'profile.experience[0].description',
        sourceFieldRole: 'location',
        sourceText: 'Los Angeles',
      }),
    ]);
    expect(
      report.sections.find(section => section.section === 'experience')
    ).toEqual(expect.objectContaining({ fieldMismatchOutputMatchCount: 1 }));
  });

  test('reports single-word whitelisted locations misclassified into experience descriptions', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'London',
        'Built durable client tools.',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Example Co',
            title: 'Principal Engineer',
            duration: 'January 2020 - Present',
            description: 'London Built durable client tools.',
          },
        ],
      }),
      pdfFileName: 'single-word-location-description-mismatch.pdf',
    });

    expect(report.fieldMismatchOutputMatches).toEqual([
      expect.objectContaining({
        outputFieldRole: 'description',
        path: 'profile.experience[0].description',
        sourceFieldRole: 'location',
        sourceText: 'London',
      }),
    ]);
  });

  test('accepts standalone experience locations when they remain in location fields', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Foundation Law Group LLP',
        'Partner',
        'August 2017 - Present (8 years 10 months)',
        'Los Angeles',
        'Built durable client tools.',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Foundation Law Group LLP',
            title: 'Partner',
            duration: 'August 2017 - Present',
            location: 'Los Angeles',
            description: 'Built durable client tools.',
          },
        ],
      }),
      pdfFileName: 'experience-location-field.pdf',
    });

    expect(report.fieldMismatchOutputMatchCount).toBe(0);
  });

  test('classifies abbreviated standalone experience locations with periods', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'St. Louis',
        'Built durable client tools.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'St. Louis',
        }),
      ])
    );
  });

  test('classifies longer standalone area locations with country tokens', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'Greater Los Angeles Area, United States',
        'Built durable client tools.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'Greater Los Angeles Area, United States',
        }),
      ])
    );
  });

  test('keeps generic geo-token phrases in descriptions without stronger location evidence', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'Platform Region',
        'Built durable client tools.',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Example Co',
            title: 'Principal Engineer',
            duration: 'January 2020 - Present',
            description: 'Platform Region Built durable client tools.',
          },
        ],
      }),
      pdfFileName: 'generic-geo-token-description.pdf',
    });

    expect(report.fieldMismatchOutputMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
    expect(report.unmatchedSourceSegments).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'Platform Region',
        }),
      ])
    );
  });

  test('keeps title-bearing area phrases in descriptions', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Creative Artists Agency',
        'Chief of Staff to the CEO - Evolution Media',
        'April 2013 - April 2014',
        'Corporate Finance Los Angeles Metropolitan Area',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Creative Artists Agency',
            title: 'Chief of Staff to the CEO - Evolution Media',
            duration: 'April 2013 - April 2014',
            description: 'Corporate Finance Los Angeles Metropolitan Area',
          },
        ],
      }),
      pdfFileName: 'title-bearing-area-description.pdf',
    });

    expect(report.fieldMismatchOutputMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
  });

  test('does not classify comma phrases as locations without geo evidence', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Operations Lead',
        'January 2020 - Present',
        'Strategy, Operations',
        'Led durable programs.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'description',
          text: 'Strategy, Operations',
        }),
      ])
    );
  });

  test('uses experience ordinals when identical locations appear in multiple entries', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Alpha LLP',
        'Partner',
        'August 2017 - Present (8 years 10 months)',
        'Los Angeles',
        'Built durable client tools.',
        'Beta LLP',
        'Partner',
        'January 2006 - December 2012 (7 years)',
        'Los Angeles',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Alpha LLP',
            title: 'Partner',
            duration: 'August 2017 - Present',
            description: 'Built durable client tools.',
          },
          {
            company: 'Beta LLP',
            title: 'Partner',
            duration: 'January 2006 - December 2012',
            description: 'Los Angeles',
          },
        ],
      }),
      pdfFileName: 'repeated-location-mismatch.pdf',
    });

    expect(report.fieldMismatchOutputMatches).toEqual([
      expect.objectContaining({
        path: 'profile.experience[1].description',
        sourceLineNumber: 10,
        sourceText: 'Los Angeles',
      }),
    ]);
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

  test('traces cross-section output values across combined source segments', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Summary',
        'Reach Cassandra at',
        'cassandra@example.com.',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        contact: {
          email: 'cassandra@example.com',
        },
        summary: 'Reach Cassandra at cassandra@example.com.',
      }),
      pdfFileName: 'combined-cross-section-email.pdf',
    });

    expect(report.unmatchedSourceSegmentCount).toBe(0);
    expect(report.looseSourceMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
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
