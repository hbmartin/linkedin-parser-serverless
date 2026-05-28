import {
  collectOutputValues,
  containsDelimitedPhrase,
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
          patents: [],
          organizations: [],
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

  test('classifies patents and memberships headings through source coverage', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Patents',
        'Systems and methods for profile parsing',
        'Memberships',
        'YPO',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        organizations: ['YPO'],
        patents: ['Systems and methods for profile parsing'],
      }),
      pdfFileName: 'extra-sections.pdf',
    });

    expect(report.unmatchedSourceSegmentCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
    expect(report.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'patents',
          sourceSegmentCount: 1,
        }),
        expect.objectContaining({
          section: 'organizations',
          sourceSegmentCount: 1,
        }),
      ])
    );
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
          patents: [],
          organizations: [],
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

  test('classifies standalone uppercase region-code locations', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'UK',
        'Built durable client tools.',
        'Second Co',
        'Staff Engineer',
        'January 2018 - December 2019',
        'USA',
        'Built durable internal tools.',
        'Third Co',
        'Advisor',
        'January 2016 - December 2017',
        'U.S.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'UK',
        }),
        expect.objectContaining({
          fieldRole: 'location',
          text: 'USA',
        }),
        expect.objectContaining({
          fieldRole: 'location',
          text: 'U.S.',
        }),
      ])
    );
  });

  test('does not classify ambiguous standalone region codes as locations', () => {
    for (const regionCode of [
      'IN',
      'ME',
      'OR',
      'Platform, IN',
      'Platform, ME',
      'Platform, OR',
    ]) {
      const sourceView = createSourceSegmentsFromLayoutText(
        [
          'Experience',
          'Example Co',
          'Principal Engineer',
          'January 2020 - Present',
          regionCode,
          'Built durable client tools.',
        ].join('\n')
      );

      expect(sourceView.segments).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldRole: 'location',
            text: regionCode,
          }),
        ])
      );
    }
  });

  test('keeps unambiguous comma-separated region-code locations', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'Platform, TX',
        'Built durable client tools.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'Platform, TX',
        }),
      ])
    );
  });

  test('normalizes diacritics for standalone location lookups', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'São Paulo',
        'Built durable client tools.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'São Paulo',
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
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'Platform Region',
        'Built durable client tools.',
      ].join('\n')
    );
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

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'description',
          text: 'Platform Region',
        }),
      ])
    );
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

  test('keeps descriptive duration phrases from becoming field mismatches', () => {
    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Warner Music Group',
        'Board Observer',
        'January 2020 - Present',
        'A 50 years old company still building new catalog analytics.',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Warner Music Group',
            title: 'Board Observer',
            duration: 'January 2020 - Present',
            description:
              'A 50 years old company still building new catalog analytics.',
          },
        ],
      }),
      pdfFileName: 'duration-prose-description.pdf',
    });

    expect(report.fieldMismatchOutputMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
  });

  test('keeps place-word organization names out of location field roles', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Los Angeles Animal Services',
        'Commissioner',
        'September 2003 - August 2005',
        'Tokyo Forex',
        'SVP',
        'August 1992 - August 1994',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'organization',
          text: 'Los Angeles Animal Services',
        }),
        expect.objectContaining({
          fieldRole: 'organization',
          text: 'Tokyo Forex',
        }),
      ])
    );
    expect(sourceView.segments).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'Los Angeles Animal Services',
        }),
        expect.objectContaining({
          fieldRole: 'location',
          text: 'Tokyo Forex',
        }),
      ])
    );
  });

  test('does not treat unsynced region codes as standalone locations', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Example Co',
        'Principal Engineer',
        'January 2020 - Present',
        'Hartford, CT',
        'Built durable client tools.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'description',
          text: 'Hartford, CT',
        }),
      ])
    );
  });

  test('classifies full-state city locations as metadata source fields', () => {
    const sourceView = createSourceSegmentsFromLayoutText(
      [
        'Experience',
        'Parametric',
        'Senior Investment Analyst',
        'September 2016 - May 2019',
        'Minneapolis, Minnesota',
        'Built overlay solutions.',
      ].join('\n')
    );

    expect(sourceView.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldRole: 'location',
          text: 'Minneapolis, Minnesota',
        }),
      ])
    );

    const report = createSourceCoverageReport({
      layoutText: [
        'Experience',
        'Parametric',
        'Senior Investment Analyst',
        'September 2016 - May 2019',
        'Minneapolis, Minnesota',
        'Built overlay solutions.',
      ].join('\n'),
      parsedJson: parsedJsonWithProfile({
        experience: [
          {
            company: 'Parametric',
            title: 'Senior Investment Analyst',
            duration: 'September 2016 - May 2019',
            location: 'Minneapolis, Minnesota',
            description: 'Built overlay solutions.',
          },
        ],
      }),
      pdfFileName: 'full-state-location.pdf',
    });

    expect(report.fieldMismatchOutputMatchCount).toBe(0);
    expect(report.untracedOutputValueCount).toBe(0);
  });

  test('empty delimited phrases do not match', () => {
    expect(containsDelimitedPhrase('Los Angeles', '')).toBe(false);
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
          patents: [],
          organizations: [],
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

function parsedJsonWithProfile(
  profile: Record<string, unknown>
): Record<string, unknown> {
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
      patents: [],
      organizations: [],
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
