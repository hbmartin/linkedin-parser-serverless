import * as fs from 'fs';
import { fileURLToPath } from 'node:url';
import { parseLinkedInPDF, type ParseResult } from '../../src/index.js';

describe('Profile.pdf fixture', () => {
  const profilePdfPath = fileURLToPath(
    new URL('../../Profile.pdf', import.meta.url)
  );
  let result: ParseResult;

  beforeAll(async () => {
    if (!fs.existsSync(profilePdfPath)) {
      throw new Error(`Profile fixture not found at ${profilePdfPath}`);
    }

    result = await parseLinkedInPDF(fs.readFileSync(profilePdfPath), {
      includeRawText: true,
    });
  });

  test('extracts the main profile identity block', () => {
    expect(result.profile.name).toBe('Harold Martin');
    expect(result.profile.headline).toBe('CTO @ SVRN');
    expect(result.profile.location).toBe(
      'Los Angeles, California, United States'
    );
  });

  test('extracts complete contact details without treating URL fragments as phone numbers', () => {
    expect(result.profile.contact.email).toBe('harold.martin@gmail.com');
    expect(result.profile.contact.linkedin_url).toBe(
      'https://linkedin.com/in/harold-martin-98526971'
    );
    expect(result.profile.contact.phone).toBeUndefined();
  });

  test('extracts sidebar skills from the left column', () => {
    expect(result.profile.top_skills).toEqual([
      'Python',
      'Amazon Web Services (AWS)',
      'ElasticSearch',
    ]);
  });

  test('extracts experience entries in visual order', () => {
    const expectedExperience = [
      {
        company: 'SVRN',
        title: 'Chief Technology Officer',
        duration: 'November 2025 - Present',
      },
      {
        company: 'Self-employed',
        title: 'Mobile and AI Consultant',
        duration: 'January 2024 - December 2025',
      },
      {
        company: 'Jump',
        title: 'Mobile Lead',
        duration: 'December 2022 - November 2023',
        location: 'Los Angeles, California, United States',
      },
      {
        company: 'AllTrails',
        title: 'Senior Android Engineer',
        duration: 'November 2021 - December 2022',
      },
      {
        company: 'Tinder, Inc.',
        title: 'Senior Android Engineer',
        duration: 'July 2017 - November 2021',
        location: 'Greater Los Angeles Area',
      },
      {
        company: 'WikiRealty',
        title: 'Lead Engineer',
        duration: 'January 2015 - January 2016',
        location: 'Santa Monica, CA',
      },
      {
        company: 'Whisper',
        title: 'Technical Manager',
        duration: 'May 2014 - January 2015',
        location: 'Venice, CA',
      },
      {
        company: 'OpenX',
        title: 'Software Engineer',
        duration: 'June 2012 - May 2014',
        location: 'Pasadena, CA',
      },
      {
        company: 'California Institute of Technology',
        title: 'Undergraduate Researcher',
        duration: 'June 2011 - September 2011',
        location: 'Pasadena, CA',
      },
      {
        company: 'Intel Corporation',
        title: 'Platform Engineer Intern',
        duration: 'June 2007 - September 2007',
        location: 'Dupont, WA',
      },
    ];

    expect(result.profile.experience).toHaveLength(expectedExperience.length);
    expectedExperience.forEach((expected, index) => {
      expect(result.profile.experience[index]).toEqual(
        expect.objectContaining(expected)
      );
    });
  });

  test('extracts education separately from experience', () => {
    expect(result.profile.education).toEqual([
      {
        institution: 'California Institute of Technology',
        degree: 'BS, Chemical Engineering',
        year: '2006 - 2012',
        location: '',
      },
    ]);
  });

  test('includes raw text from both PDF pages for fixture demos', () => {
    expect(result.rawText).toEqual(expect.stringContaining('Harold Martin'));
    expect(result.rawText).toEqual(expect.stringContaining('SVRN'));
    expect(result.rawText).toEqual(
      expect.stringContaining('Intel Corporation')
    );
    expect(result.rawText).toEqual(expect.stringContaining('Page 2 of 2'));
  });
});
