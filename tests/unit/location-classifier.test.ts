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

  test('recognizes sample city-region and translated country locations', () => {
    for (const location of [
      'Minneapolis, Minnesota',
      'Smithfield, Rhode Island',
      'Charlottesville, Virginia',
      'Dubai, Vereinigte Arabische Emirate',
      'Reno, Nevada Area',
      'Kauai, Hawaii',
    ]) {
      expect(
        classifyLocationText({
          context: { structuralContext: 'after-duration' },
          text: location,
        }).isLocation
      ).toBe(true);
    }
  });

  test('does not treat standalone country codes as location lines', () => {
    expect(
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text: 'US',
      }).isLocation
    ).toBe(false);
  });
});
