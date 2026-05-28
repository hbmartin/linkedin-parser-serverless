import {
  formatBundleSizeReport,
  measureBundleSizes,
} from '../../scripts/report-bundle-size.mjs';

describe('bundle size report script', () => {
  test('reports artifact and top-level JavaScript sizes', () => {
    const report = measureBundleSizes({
      bundleArtifacts: ['dist/index.js', 'dist/index.min.js'],
      listDistFileNames: () => ['index.js', 'index.min.js', 'index.d.ts'],
      readArtifact: relativePath => ({
        absolutePath: `/repo/${relativePath}`,
        gzipBytes: relativePath.endsWith('.min.js') ? 256 : 512,
        relativePath,
        size: relativePath.endsWith('.min.js') ? 1024 : 2048,
      }),
    });

    expect(report).toEqual({
      artifacts: [
        {
          absolutePath: '/repo/dist/index.js',
          gzipBytes: 512,
          relativePath: 'dist/index.js',
          size: 2048,
        },
        {
          absolutePath: '/repo/dist/index.min.js',
          gzipBytes: 256,
          relativePath: 'dist/index.min.js',
          size: 1024,
        },
      ],
      totalTopLevelJavaScriptBytes: 3072,
    });
  });

  test('does not reject artifacts by size budget', () => {
    expect(() =>
      measureBundleSizes({
        bundleArtifacts: ['dist/index.js'],
        listDistFileNames: () => ['index.js'],
        readArtifact: relativePath => ({
          absolutePath: `/repo/${relativePath}`,
          gzipBytes: 2 * 1024 * 1024,
          relativePath,
          size: 10 * 1024 * 1024,
        }),
      })
    ).not.toThrow();
  });

  test('formats reports without budget pass/fail language', () => {
    const output = formatBundleSizeReport({
      artifacts: [
        {
          absolutePath: '/repo/dist/index.js',
          gzipBytes: 512,
          relativePath: 'dist/index.js',
          size: 1536,
        },
      ],
      totalTopLevelJavaScriptBytes: 4096,
    });

    expect(output).toBe(
      [
        'Bundle artifact sizes:',
        'dist/index.js: 1.50 KiB raw, 512 B gzip',
        'Top-level dist JavaScript: 4.00 KiB raw',
      ].join('\n')
    );
    expect(output).not.toContain('budget');
    expect(output).not.toContain('above');
  });
});
