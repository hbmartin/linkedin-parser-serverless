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
        '                              Jane Doe',
        'jane@example.com              Staff Engineer',
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
          text: 'Jane Doe',
        }),
        expect.objectContaining({
          column: 'sidebar',
          section: 'contact',
          text: 'jane@example.com',
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
        'jane-example (LinkedIn)',
      ].join('\n'),
      parsedJson: {
        profile: {
          name: '',
          headline: '',
          location: '',
          contact: {
            linkedin_url: 'https://linkedin.com/in/jane-example',
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
