import { classifyLocationText } from '../../src/utils/location-classifier.js';

describe('location classifier', () => {
  test('scores named place, region, and country signals as locations', () => {
    expect(
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text: 'Washington D.C.',
      })
    ).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining([
          'known-place',
          'region-code',
          'after-duration',
        ]),
      })
    );

    expect(
      classifyLocationText({ text: 'Greater Los Angeles Area, United States' })
    ).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining([
          'known-place',
          'country-or-region',
          'qualified-area',
        ]),
      })
    );
  });

  test('rejects generic geo-token and title-bearing phrases without strong evidence', () => {
    expect(
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text: 'Platform Region',
      }).isLocation
    ).toBe(false);

    expect(
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text: 'Corporate Finance Los Angeles Metropolitan Area',
      }).isLocation
    ).toBe(false);
  });
});
