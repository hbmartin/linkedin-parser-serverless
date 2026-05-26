import {
  optionValue,
  sampleWarningFailureDetailLines,
} from '../../scripts/lib/sample-script-helpers.mjs';

describe('sample script helpers', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  test('returns option values by flag name', () => {
    process.argv = ['node', 'script.mjs', '--samples', 'fixtures'];

    expect(optionValue('--samples')).toBe('fixtures');
  });

  test('rejects missing option values', () => {
    process.argv = ['node', 'script.mjs', '--samples', '--output', 'out'];

    expect(() => optionValue('--samples')).toThrow(
      'Missing value for --samples'
    );
  });

  test('formats section warnings and parse failures together', () => {
    expect(
      sampleWarningFailureDetailLines([
        {
          pdfFileName: 'Profile.pdf',
          warnings: [
            {
              code: 'section_parse_warning',
              entry: 2,
              field: 'title',
              message: 'could not classify line',
              rawText: 'Lead',
              section: 'experience',
            },
          ],
        },
        {
          parseError: 'PDF appears to be empty or unreadable',
          pdfFileName: 'Broken.pdf',
          warnings: [],
        },
      ])
    ).toEqual([
      'Profile.pdf experience.title#2 could not classify line: Lead',
      'Broken.pdf parse_error PDF appears to be empty or unreadable',
    ]);
  });
});
