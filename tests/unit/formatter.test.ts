import {
  formatLinkedInProfile,
  type LinkedInProfile,
} from '../../src/index.js';

describe('formatLinkedInProfile', () => {
  test('formats a stable plain-text profile without contact by default', () => {
    expect(formatLinkedInProfile(createProfile())).toBe(
      [
        'Orion Helios',
        'Principal Engineer',
        'San Francisco, CA',
        '',
        'Summary',
        'Builds reliable parsing systems.',
        '',
        'Experience',
        'Principal Engineer at Fixture Co',
        'January 2020 - Present',
        'San Francisco, CA',
        'Leads platform work.',
        '',
        'Education',
        'BS Computer Science, Example University',
        '2012',
        '',
        'Top Skills',
        '- TypeScript',
        '- Parsing',
        '',
        'Languages',
        '- English (Native)',
        '- French',
        '',
        'Projects',
        '- Parser Toolkit',
      ].join('\n')
    );
  });

  test('formats a stable plain-text profile when explicitly requested', () => {
    expect(
      formatLinkedInProfile(createProfile(), {
        outputFormat: 'plainText',
      })
    ).toBe(formatLinkedInProfile(createProfile()));
  });

  test('formats a stable markdown profile without contact', () => {
    expect(
      formatLinkedInProfile(createProfile(), {
        outputFormat: 'markdown',
      })
    ).toBe(
      [
        '# Orion Helios',
        'Principal Engineer',
        'San Francisco, CA',
        '',
        '## Summary',
        'Builds reliable parsing systems.',
        '',
        '## Experience',
        'Principal Engineer at Fixture Co',
        'January 2020 - Present',
        'San Francisco, CA',
        'Leads platform work.',
        '',
        '## Education',
        'BS Computer Science, Example University',
        '2012',
        '',
        '## Top Skills',
        '- TypeScript',
        '- Parsing',
        '',
        '## Languages',
        '- English (Native)',
        '- French',
        '',
        '## Projects',
        '- Parser Toolkit',
      ].join('\n')
    );
  });

  test('includes contact details only when requested', () => {
    const profile = createProfile();

    expect(formatLinkedInProfile(profile)).not.toContain('Email:');
    expect(
      formatLinkedInProfile(profile, {
        includeContact: true,
      })
    ).toContain(
      [
        'Contact',
        'Email: orion@example.com',
        'Phone: +1 555 123 4567',
        'LinkedIn: https://linkedin.com/in/orion',
        'Portfolio: https://example.com/orion',
      ].join('\n')
    );
  });

  test('includes contact details in markdown only when requested', () => {
    const profile = createProfile();

    expect(
      formatLinkedInProfile(profile, {
        outputFormat: 'markdown',
      })
    ).not.toContain('## Contact');
    expect(
      formatLinkedInProfile(profile, {
        includeContact: true,
        outputFormat: 'markdown',
      })
    ).toContain(
      [
        '## Contact',
        'Email: orion@example.com',
        'Phone: +1 555 123 4567',
        'LinkedIn: https://linkedin.com/in/orion',
        'Portfolio: https://example.com/orion',
      ].join('\n')
    );
  });

  test('omits contact links without URLs', () => {
    expect(
      formatLinkedInProfile(
        {
          ...createEmptyProfile(),
          contact: {
            links: [
              {
                label: 'Portfolio',
                rawText: 'Portfolio',
                url: '',
              },
              {
                rawText: 'https://example.com',
                url: 'https://example.com',
              },
            ],
          },
        },
        {
          includeContact: true,
        }
      )
    ).toBe(['Contact', 'https://example.com'].join('\n'));
  });

  test('skips malformed contact link entries without crashing', () => {
    const profileWithMalformedLinks = JSON.parse(
      JSON.stringify({
        ...createEmptyProfile(),
        contact: {
          links: [
            null,
            {
              label: '  Portfolio  ',
              rawText: 'Portfolio',
              url: '  https://example.com  ',
            },
            {
              label: 'No URL',
              rawText: 'No URL',
            },
          ],
        },
      })
    );

    expect(
      formatLinkedInProfile(profileWithMalformedLinks, {
        includeContact: true,
      })
    ).toBe(['Contact', 'Portfolio: https://example.com'].join('\n'));
  });

  test('omits contact links that duplicate the canonical LinkedIn URL', () => {
    expect(
      formatLinkedInProfile(
        {
          ...createEmptyProfile(),
          contact: {
            links: [
              {
                label: 'LinkedIn',
                rawText: 'LinkedIn',
                url: 'https://linkedin.com/in/orion',
              },
              {
                label: 'Portfolio',
                rawText: 'Portfolio',
                url: 'https://example.com/orion',
              },
            ],
            linkedin_url: '  https://linkedin.com/in/orion  ',
          },
        },
        {
          includeContact: true,
        }
      )
    ).toBe(
      [
        'Contact',
        'LinkedIn: https://linkedin.com/in/orion',
        'Portfolio: https://example.com/orion',
      ].join('\n')
    );
  });

  test('omits LinkedIn contact links with common URL variations', () => {
    expect(
      formatLinkedInProfile(
        {
          ...createEmptyProfile(),
          contact: {
            links: [
              {
                label: 'LinkedIn',
                rawText: 'LinkedIn',
                url: 'HTTP://WWW.LinkedIn.com/in/ORION/',
              },
              {
                label: 'LinkedIn',
                rawText: 'LinkedIn',
                url: 'www.LinkedIn.com/in/ORION/',
              },
              {
                label: 'Portfolio',
                rawText: 'Portfolio',
                url: 'https://example.com/orion',
              },
            ],
            linkedin_url: 'https://linkedin.com/in/orion',
          },
        },
        {
          includeContact: true,
        }
      )
    ).toBe(
      [
        'Contact',
        'LinkedIn: https://linkedin.com/in/orion',
        'Portfolio: https://example.com/orion',
      ].join('\n')
    );
  });

  test('normalizes whitespace and skips malformed contact links in markdown', () => {
    const profileWithMalformedLinks = JSON.parse(
      JSON.stringify({
        ...createEmptyProfile(),
        contact: {
          links: [
            null,
            {
              label: '  Portfolio  ',
              rawText: 'Portfolio',
              url: '  https://example.com  ',
            },
            {
              label: 'No URL',
              rawText: 'No URL',
            },
          ],
        },
        name: '  Cassandra   Troy ',
        summary: 'Builds\n\ncareful\tinterfaces.',
      })
    );

    expect(
      formatLinkedInProfile(profileWithMalformedLinks, {
        includeContact: true,
        outputFormat: 'markdown',
      })
    ).toBe(
      [
        '# Cassandra Troy',
        '',
        '## Contact',
        'Portfolio: https://example.com',
        '',
        '## Summary',
        'Builds careful interfaces.',
      ].join('\n')
    );
  });

  test('separates multiple experience and education entries', () => {
    expect(
      formatLinkedInProfile({
        ...createEmptyProfile(),
        education: [
          {
            degree: 'BS Computer Science',
            institution: 'Example University',
            year: '2012',
          },
          {
            degree: 'MS Systems',
            institution: 'Northern College',
            year: '2014',
          },
        ],
        experience: [
          {
            company: 'Fixture Co',
            description: 'Built parsing tools.',
            duration: '2020 - 2022',
            title: 'Engineer',
          },
          {
            company: 'Example Labs',
            description: 'Led platform work.',
            duration: '2022 - Present',
            title: 'Senior Engineer',
          },
        ],
      })
    ).toBe(
      [
        'Experience',
        'Engineer at Fixture Co',
        '2020 - 2022',
        'Built parsing tools.',
        '',
        'Senior Engineer at Example Labs',
        '2022 - Present',
        'Led platform work.',
        '',
        'Education',
        'BS Computer Science, Example University',
        '2012',
        '',
        'MS Systems, Northern College',
        '2014',
      ].join('\n')
    );
  });

  test('normalizes whitespace and skips empty sections', () => {
    expect(
      formatLinkedInProfile({
        ...createEmptyProfile(),
        name: '  Cassandra   Troy ',
        summary: 'Builds\n\ncareful\tinterfaces.',
      })
    ).toBe(
      ['Cassandra Troy', '', 'Summary', 'Builds careful interfaces.'].join('\n')
    );
  });

  test('formats patents and organizations when present', () => {
    expect(
      formatLinkedInProfile({
        ...createEmptyProfile(),
        organizations: ['YPO', 'IEEE Computer Society'],
        patents: ['Systems and methods for profile parsing'],
      })
    ).toBe(
      [
        'Patents',
        '- Systems and methods for profile parsing',
        '',
        'Organizations',
        '- YPO',
        '- IEEE Computer Society',
      ].join('\n')
    );
  });

  test('returns an empty string when every section is empty', () => {
    expect(
      formatLinkedInProfile(createEmptyProfile(), {
        includeContact: true,
      })
    ).toBe('');
  });

  test('returns an empty string for markdown when every section is empty', () => {
    expect(
      formatLinkedInProfile(createEmptyProfile(), {
        includeContact: true,
        outputFormat: 'markdown',
      })
    ).toBe('');
  });

  test('formats sparse entries and skips blank language names', () => {
    expect(
      formatLinkedInProfile(
        {
          ...createEmptyProfile(),
          contact: {
            links: [
              {
                rawText: 'https://example.com',
                url: 'https://example.com',
              },
            ],
          },
          education: [
            {
              degree: '',
              institution: 'Example University',
            },
          ],
          experience: [
            {
              company: '',
              duration: '',
              title: 'Advisor',
            },
          ],
          languages: [
            {
              language: '',
              proficiency: 'Native',
            },
            {
              language: 'Spanish',
              proficiency: '',
            },
          ],
        },
        {
          includeContact: true,
        }
      )
    ).toBe(
      [
        'Contact',
        'https://example.com',
        '',
        'Experience',
        'Advisor',
        '',
        'Education',
        'Example University',
        '',
        'Languages',
        '- Spanish',
      ].join('\n')
    );
  });
});

function createProfile(): LinkedInProfile {
  return {
    certifications: [],
    contact: {
      email: 'orion@example.com',
      links: [
        {
          label: 'Portfolio',
          rawText: 'Portfolio',
          url: 'https://example.com/orion',
        },
      ],
      linkedin_url: 'https://linkedin.com/in/orion',
      phone: '+1 555 123 4567',
    },
    education: [
      {
        degree: 'BS Computer Science',
        institution: 'Example University',
        year: '2012',
      },
    ],
    experience: [
      {
        company: 'Fixture Co',
        description: 'Leads platform work.',
        duration: 'January 2020 - Present',
        location: 'San Francisco, CA',
        title: 'Principal Engineer',
      },
    ],
    experience_groups: [],
    headline: 'Principal Engineer',
    honors_awards: [],
    languages: [
      {
        language: 'English',
        proficiency: 'Native',
      },
      {
        language: 'French',
        proficiency: 'Unknown',
      },
    ],
    location: 'San Francisco, CA',
    name: 'Orion Helios',
    organizations: [],
    patents: [],
    projects: ['Parser Toolkit'],
    publications: [],
    summary: 'Builds reliable parsing systems.',
    top_skills: ['TypeScript', 'Parsing'],
    volunteer_work: [],
  };
}

function createEmptyProfile(): LinkedInProfile {
  return {
    certifications: [],
    contact: {},
    education: [],
    experience: [],
    experience_groups: [],
    honors_awards: [],
    languages: [],
    organizations: [],
    patents: [],
    projects: [],
    publications: [],
    top_skills: [],
    volunteer_work: [],
  };
}
