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
        text: 'march 2021',
      },
      kind: 'completed',
      originalText: 'Jan 2020 - Mar 2021 · 1 yr 3 mos',
      start: {
        iso: '2020-01',
        precision: 'month',
        text: 'january 2020',
      },
    });
  });

  test('parses current roles without inventing an end date', () => {
    expect(parseProfileDateRange('Jan 2020 - Present')).toEqual({
      kind: 'current',
      originalText: 'Jan 2020 - Present',
      start: {
        iso: '2020-01',
        precision: 'month',
        text: 'january 2020',
      },
    });
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
    expect(extractProfileDateRangeText('Provided support from 2019 - 2021')).toBe(
      '2019 - 2021'
    );
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
});
