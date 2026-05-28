import {
  extractProfileDateRangeText,
  parseProfileDateRange,
} from '../../src/utils/date-parser.js';

describe('profile date parser', () => {
  test('parses abbreviated English ranges with dash variants and duration text', () => {
    expect(parseProfileDateRange('Jan 2020 – Mar 2021 · 1 yr 3 mos')).toEqual({
      durationText: '1 yr 3 mos',
      end: {
        iso: '2021-03',
        precision: 'month',
        text: 'March 2021',
      },
      kind: 'completed',
      originalText: 'Jan 2020 - Mar 2021 · 1 yr 3 mos',
      start: {
        iso: '2020-01',
        precision: 'month',
        text: 'January 2020',
      },
    });
  });

  test('extracts parenthetical duration text from the shared duration vocabulary', () => {
    expect(parseProfileDateRange('Jan 2020 - Mar 2021 (1 yr 3 mos)')).toEqual(
      expect.objectContaining({
        durationText: '1 yr 3 mos',
        end: expect.objectContaining({ iso: '2021-03' }),
        start: expect.objectContaining({ iso: '2020-01' }),
      })
    );
  });

  test('parses current roles without inventing an end date', () => {
    expect(parseProfileDateRange('Jan 2020 - Present')).toEqual({
      kind: 'current',
      originalText: 'Jan 2020 - Present',
      start: {
        iso: '2020-01',
        precision: 'month',
        text: 'January 2020',
      },
    });
  });

  test('preserves canonical capitalization for full English month names', () => {
    expect(parseProfileDateRange('March 2015 - January 2022')).toEqual(
      expect.objectContaining({
        end: expect.objectContaining({ text: 'January 2022' }),
        start: expect.objectContaining({ text: 'March 2015' }),
      })
    );
    expect(parseProfileDateRange('May 2019 - May 2020')).toEqual(
      expect.objectContaining({
        end: expect.objectContaining({ text: 'May 2020' }),
        start: expect.objectContaining({ text: 'May 2019' }),
      })
    );
  });

  test('parses localized month ranges', () => {
    expect(parseProfileDateRange('janeiro de 2020 - março de 2024')).toEqual(
      expect.objectContaining({
        end: expect.objectContaining({ iso: '2024-03' }),
        start: expect.objectContaining({ iso: '2020-01' }),
      })
    );
    expect(parseProfileDateRange('janvier 2020 - présent')).toEqual(
      expect.objectContaining({
        kind: 'current',
        start: expect.objectContaining({ iso: '2020-01' }),
      })
    );
  });

  test('extracts embedded year ranges and rejects relative durations', () => {
    expect(
      extractProfileDateRangeText('Provided support from 2019 - 2021')
    ).toBe('2019 - 2021');
    expect(parseProfileDateRange('in 3 months')).toBeUndefined();
    expect(parseProfileDateRange('sometime later')).toBeUndefined();
  });

  test('does not split ISO or compact month-year dates on internal hyphens', () => {
    expect(parseProfileDateRange('2020-01')).toEqual({
      kind: 'single',
      originalText: '2020-01',
      start: {
        iso: '2020-01',
        precision: 'month',
        text: '2020-01',
      },
    });
    expect(parseProfileDateRange('2020-01-31')).toEqual({
      kind: 'single',
      originalText: '2020-01-31',
      start: {
        iso: '2020-01-31',
        precision: 'day',
        text: '2020-01-31',
      },
    });
    expect(parseProfileDateRange('2020-01-00')).toBeUndefined();
    expect(parseProfileDateRange('Jan-2020')).toEqual({
      kind: 'single',
      originalText: 'Jan-2020',
      start: {
        iso: '2020-01',
        precision: 'month',
        text: 'January-2020',
      },
    });
    expect(parseProfileDateRange('2020-2024')).toEqual({
      end: {
        iso: '2024',
        precision: 'year',
        text: '2024',
      },
      kind: 'completed',
      originalText: '2020-2024',
      start: {
        iso: '2020',
        precision: 'year',
        text: '2020',
      },
    });
  });

  test('parses ISO day ranges without relying on chrono range detection', () => {
    expect(parseProfileDateRange('2020-01-31 - 2020-02-28')).toEqual({
      end: {
        iso: '2020-02-28',
        precision: 'day',
        text: '2020-02-28',
      },
      kind: 'completed',
      originalText: '2020-01-31 - 2020-02-28',
      start: {
        iso: '2020-01-31',
        precision: 'day',
        text: '2020-01-31',
      },
    });
  });

  test('parses chrono-only year and day ranges', () => {
    expect(parseProfileDateRange('during 2020')).toEqual({
      kind: 'single',
      originalText: 'during 2020',
      start: {
        iso: '2020',
        precision: 'year',
        text: '2020',
      },
    });

    expect(parseProfileDateRange('January 5 to February 6 2020')).toEqual(
      expect.objectContaining({
        end: expect.objectContaining({
          iso: '2020-02-06',
          precision: 'day',
        }),
        kind: 'completed',
        start: expect.objectContaining({
          iso: '2020-01-05',
          precision: 'day',
        }),
      })
    );
  });

  test('rejects empty and incomplete date ranges', () => {
    expect(parseProfileDateRange('')).toBeUndefined();
    expect(parseProfileDateRange('2020 - eventually')).toBeUndefined();
    expect(parseProfileDateRange('Present')).toBeUndefined();
  });

  test('parses single chrono month and year dates after leading prose', () => {
    expect(parseProfileDateRange('worked from January 2020')).toEqual({
      kind: 'single',
      originalText: 'worked from January 2020',
      start: {
        iso: '2020-01',
        precision: 'month',
        text: 'January 2020',
      },
    });
    expect(parseProfileDateRange('worked from 2020')).toEqual({
      kind: 'single',
      originalText: 'worked from 2020',
      start: {
        iso: '2020',
        precision: 'year',
        text: '2020',
      },
    });
  });

  test('parses chrono ranges that use words instead of dash delimiters', () => {
    expect(parseProfileDateRange('January 2020 through March 2021')).toEqual(
      expect.objectContaining({
        end: expect.objectContaining({
          iso: '2021-03',
          precision: 'month',
        }),
        kind: 'completed',
        start: expect.objectContaining({
          iso: '2020-01',
          precision: 'month',
        }),
      })
    );
  });

  test('returns independent objects for repeated date parses', () => {
    const firstResult = parseProfileDateRange('Jan 2020 - Mar 2021');
    const secondResult = parseProfileDateRange('Jan 2020 - Mar 2021');

    expect(secondResult).toEqual(firstResult);
    expect(secondResult).not.toBe(firstResult);

    if (
      firstResult?.kind === 'completed' &&
      secondResult?.kind === 'completed'
    ) {
      expect(secondResult.start).not.toBe(firstResult.start);
      expect(secondResult.end).not.toBe(firstResult.end);
    }
  });

  test('returns stable undefined results for repeated invalid date parses', () => {
    expect(parseProfileDateRange('sometime later')).toBeUndefined();
    expect(parseProfileDateRange('sometime later')).toBeUndefined();
  });
});
