import {
  calculateDurationStats,
  formatBytes,
  formatPerformanceReport,
  measureInputPerformance,
  parseMeasurePerformanceArgs,
  parsePositiveIntegerOption,
} from '../../scripts/measure-performance.mjs';

describe('performance measurement script', () => {
  test('parses default and explicit CLI options', () => {
    expect(parseMeasurePerformanceArgs([])).toEqual({
      iterations: 10,
      json: false,
      warmup: 3,
    });
    expect(
      parseMeasurePerformanceArgs([
        '--',
        '--iterations',
        '25',
        '--warmup=5',
        '--json',
      ])
    ).toEqual({
      iterations: 25,
      json: true,
      warmup: 5,
    });
  });

  test('rejects invalid CLI options', () => {
    expect(() => parseMeasurePerformanceArgs(['--slow'])).toThrow(
      'Unknown option'
    );
    expect(() => parsePositiveIntegerOption('--iterations', '0')).toThrow(
      'positive integer'
    );
    expect(() => parsePositiveIntegerOption('--iterations', '10ms')).toThrow(
      'positive integer'
    );
    expect(() => parsePositiveIntegerOption('--warmup', '3.5')).toThrow(
      'positive integer'
    );
    expect(() => parsePositiveIntegerOption('--warmup', undefined)).toThrow(
      'Missing value'
    );
  });

  test('calculates latency summary statistics', () => {
    expect(calculateDurationStats([10, 2, 8, 4, 6])).toEqual({
      average: 6,
      max: 10,
      median: 6,
      min: 2,
      p95: 10,
    });
    expect(calculateDurationStats([1, 2, 3, 100])).toEqual({
      average: 26.5,
      max: 100,
      median: 2.5,
      min: 1,
      p95: 100,
    });
  });

  test('runs warmup and measured parse iterations', async () => {
    let callCount = 0;
    const result = await measureInputPerformance({
      input: 'linkedin text',
      iterations: 3,
      parse: async () => {
        callCount += 1;
      },
      warmup: 2,
    });

    expect(callCount).toBe(5);
    expect(result.durationsMs).toHaveLength(3);
    expect(result.maxHeapDeltaBytes).toBeUndefined();
    expect(result.stats.min).toBeGreaterThanOrEqual(0);
  });

  test('formats byte counts and markdown reports', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.50 KiB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MiB');
    expect(
      formatPerformanceReport({
        bundles: [
          {
            gzipBytes: 512,
            name: 'dist/index.min.js',
            rawBytes: 1536,
          },
        ],
        inputs: [
          {
            file: 'Profile.pdf',
            kind: 'pdf',
            maxHeapDeltaBytes: 2048,
            sizeBytes: 4096,
            stats: {
              average: 12.345,
              max: 15,
              median: 12,
              min: 10,
              p95: 15,
            },
          },
        ],
        iterations: 5,
        node: 'v22.0.0',
        platform: 'darwin/arm64',
        warmup: 1,
      })
    ).toContain(
      '| Profile.pdf | pdf | 4.00 KiB | 12.3ms | 12.0ms | 15.0ms | 10.0ms | 15.0ms | 2.00 KiB |'
    );
  });
});
