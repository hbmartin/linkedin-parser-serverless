import { BasicInfoParser } from '../../src/parsers/basic-info.js';

describe('BasicInfoParser', () => {
  test('does not classify spaced email addresses as short company headlines', () => {
    const profile = BasicInfoParser.parse(`
      Test User
      name @ domain.com
      Senior Engineer @ ExampleCo
      Los Angeles, California, United States
    `);

    expect(profile.headline).toBe('Senior Engineer @ ExampleCo');
  });
});
