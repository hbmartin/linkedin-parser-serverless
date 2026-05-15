import { EducationParser } from '../../src/parsers/education.js';

describe('EducationParser', () => {
  test('removes extracted years from degree text', () => {
    const educations = EducationParser.parse(`
      Education
      Example University
      Bachelor of Science 2016 in Engineering
      State College
      Master of Business (2018)
    `);

    expect(educations).toEqual([
      expect.objectContaining({
        institution: 'Example University',
        degree: 'Bachelor of Science in Engineering',
        year: '2016',
      }),
      expect.objectContaining({
        institution: 'State College',
        degree: 'Master of Business',
        year: '2018',
      }),
    ]);
  });
});
