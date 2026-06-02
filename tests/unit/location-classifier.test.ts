import {
  classifyLocationText,
  isKnownCountryAliasText,
  isUnambiguousCountryAliasText,
  normalizeCountryAliasText,
} from '../../src/utils/location-classifier.js';

describe('location classifier', () => {
  test('rejects empty location text without signals', () => {
    expect(classifyLocationText({ text: '   ' })).toEqual({
      isLocation: false,
      score: 0,
      signals: [],
    });
  });

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
      classifyLocationText({
        context: { structuralContext: 'metadata' },
        text: 'Boston',
      })
    ).toEqual(
      expect.objectContaining({
        isLocation: false,
        score: 3,
        signals: expect.arrayContaining(['exact-place', 'proper-shape']),
      })
    );

    expect(classifyLocationText({ text: 'California' })).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining(['admin-region', 'proper-shape']),
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

    expect(
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text: 'Chicago, IL',
      })
    ).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining(['known-place', 'region-code']),
      })
    );

    expect(
      classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text: 'IN, San Diego',
      })
    ).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining(['known-place', 'region-code']),
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
      'West Hollywood',
      'États Unis',
      "Stati Uniti d'America",
      'Trinidad and Tobago',
    ]) {
      expect(
        classifyLocationText({
          context: { structuralContext: 'after-duration' },
          text: location,
        }).isLocation
      ).toBe(true);
    }
  });

  test('recognizes proper qualified area and after-duration comma location shapes', () => {
    for (const location of [
      'Salt Lake City Metropolitan Area',
      'Greater Pittsburgh Area',
      'Jakarta, Indonesia',
      'Taipei City, Taiwan',
      'Riyadh, Saudi Arabia',
      'Doha, Qatar',
    ]) {
      expect(
        classifyLocationText({
          context: { structuralContext: 'after-duration' },
          text: location,
        }).isLocation
      ).toBe(true);
    }
  });

  test('rejects academic program details that look comma-separated but lack location evidence', () => {
    const result = classifyLocationText({
      context: { structuralContext: 'metadata' },
      text: 'YPO Academy, CIBE',
    });

    expect(result.isLocation).toBe(false);
    expect(result.signals).not.toContain('comma-region');
  });

  test('recognizes standard ZIP+4 postal codes', () => {
    expect(classifyLocationText({ text: '12345-6789' })).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining(['postal-code']),
      })
    );

    expect(classifyLocationText({ text: '21941-911' })).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining(['postal-code']),
      })
    );

    expect(classifyLocationText({ text: '12345-67' }).isLocation).toBe(false);
  });

  test('rejects duration ranges with alternate dash characters', () => {
    for (const text of [
      '2020 ‐ Present',
      '2020 ‑ 2021',
      '2020 ‒ current',
      '2020 — Present',
      '2020 − 2021',
    ]) {
      expect(classifyLocationText({ text })).toEqual(
        expect.objectContaining({
          isLocation: false,
          signals: expect.arrayContaining(['duration']),
        })
      );
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

  test('normalizes dotted and spaced country aliases without changing location scoring', () => {
    for (const text of ['US', 'U.S.', 'U S', 'USA', 'U.S.A.']) {
      expect(normalizeCountryAliasText(text)).toBe('united states');
      expect(isKnownCountryAliasText(text)).toBe(true);
      expect(isUnambiguousCountryAliasText(text)).toBe(true);
    }

    expect(normalizeCountryAliasText('us')).toBe('united states');
    expect(isKnownCountryAliasText('us')).toBe(true);
    expect(isUnambiguousCountryAliasText('us')).toBe(false);
    expect(normalizeCountryAliasText('California')).toBeUndefined();
    expect(classifyLocationText({ text: 'US' }).isLocation).toBe(false);
  });

  test('rejects place-word organization names and prose with ambiguous region-code words', () => {
    for (const text of [
      'Los Angeles Animal Services',
      'Tokyo Forex',
      'Keidanren (Japan Business Federation)',
      'schools that generate meaningful results for families in New York',
      'built, IN',
      'built, ME',
      'built, OR',
    ]) {
      const result = classifyLocationText({
        context: { structuralContext: 'after-duration' },
        text,
      });
      const hasRegionCodeSignal = result.signals.some(signal =>
        signal.includes('region-code')
      );

      expect(result.isLocation).toBe(false);
      expect(hasRegionCodeSignal).toBe(false);
      expect(result.signals).not.toContain('comma-region');
    }
  });

  test('returns independent objects for repeated classifications', () => {
    const firstResult = classifyLocationText({
      context: { structuralContext: 'after-duration' },
      text: 'San Francisco, CA',
    });
    const secondResult = classifyLocationText({
      context: { structuralContext: 'after-duration' },
      text: 'San Francisco, CA',
    });

    expect(secondResult).toEqual(firstResult);
    expect(secondResult).not.toBe(firstResult);
    expect(secondResult.signals).not.toBe(firstResult.signals);
  });

  test('keeps classification cache entries context-sensitive', () => {
    const defaultResult = classifyLocationText({ text: 'Boston' });
    const metadataResult = classifyLocationText({
      context: { structuralContext: 'metadata' },
      text: 'Boston',
    });

    expect(defaultResult).toEqual(
      expect.objectContaining({
        isLocation: true,
        score: 5,
        signals: expect.arrayContaining(['exact-place', 'proper-shape']),
      })
    );
    expect(metadataResult).toEqual(
      expect.objectContaining({
        isLocation: false,
        score: 3,
        signals: expect.arrayContaining(['exact-place', 'proper-shape']),
      })
    );
  });

  test('does not match single-word known places inside larger words', () => {
    const result = classifyLocationText({
      context: { structuralContext: 'after-duration' },
      text: 'Bostonian',
    });

    expect(result.isLocation).toBe(false);
    expect(result.signals).not.toContain('known-place');
    expect(result.signals).not.toContain('exact-place');
  });

  test('continues to match delimited multi-word known places', () => {
    const result = classifyLocationText({
      context: { structuralContext: 'after-duration' },
      text: 'Greater New York Area',
    });

    expect(result).toEqual(
      expect.objectContaining({
        isLocation: true,
        signals: expect.arrayContaining(['known-place', 'qualified-area']),
      })
    );
  });
});
