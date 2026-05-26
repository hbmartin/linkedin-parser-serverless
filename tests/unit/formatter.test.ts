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

  test('returns an empty string when every section is empty', () => {
    expect(
      formatLinkedInProfile(createEmptyProfile(), {
        includeContact: true,
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
    projects: [],
    publications: [],
    top_skills: [],
    volunteer_work: [],
  };
}
