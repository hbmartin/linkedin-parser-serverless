import { jest } from '@jest/globals';
import {
  formatBundleSizeReport,
  listTopLevelDistFileNames,
  measureBundleSizes,
  readBundleArtifact,
  runBundleSizeReportCli,
} from '../../scripts/report-bundle-size.mjs';

interface BundleFile {
  absolutePath: string;
  relativePath: string;
  size: number;
}

interface BundleArtifact extends BundleFile {
  gzipBytes: number;
}

interface BundleSizeReport {
  artifacts: BundleArtifact[];
  totalTopLevelJavaScriptBytes: number;
}

type ReadArtifact = (relativePath: string) => BundleArtifact;
type GetFileSize = (relativePath: string) => number;

const fakeArtifactFor = (relativePath: string): BundleArtifact => ({
  absolutePath: `/repo/${relativePath}`,
  gzipBytes: relativePath.endsWith('.min.js') ? 256 : 512,
  relativePath,
  size: relativePath.endsWith('.min.js') ? 1024 : 2048,
});

describe('bundle size report script', () => {
  test('reports artifact and top-level JavaScript sizes', () => {
    const readArtifact: ReadArtifact = fakeArtifactFor;
    const getFileSize = jest.fn<GetFileSize>(relativePath =>
      relativePath.endsWith('.min.js') ? 1024 : 2048
    );

    const report = measureBundleSizes({
      bundleArtifacts: ['dist/index.js', 'dist/index.min.js'],
      listDistFileNames: () => ['index.js', 'index.min.js', 'index.d.ts'],
      readArtifact,
      getFileSize,
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
    expect(getFileSize).toHaveBeenCalledWith('dist/index.js');
    expect(getFileSize).toHaveBeenCalledWith('dist/index.min.js');
    expect(getFileSize).not.toHaveBeenCalledWith('dist/index.d.ts');
  });

  test('does not reject artifacts by size budget', () => {
    const readArtifact: ReadArtifact = relativePath => ({
      absolutePath: `/repo/${relativePath}`,
      gzipBytes: 2 * 1024 * 1024,
      relativePath,
      size: 10 * 1024 * 1024,
    });

    const getFileSize: GetFileSize = () => 10 * 1024 * 1024;

    expect(() =>
      measureBundleSizes({
        bundleArtifacts: ['dist/index.js'],
        listDistFileNames: () => ['index.js'],
        readArtifact,
        getFileSize,
      })
    ).not.toThrow();
  });

  test('formats reports without budget pass/fail language', () => {
    const report: BundleSizeReport = {
      artifacts: [
        {
          absolutePath: '/repo/dist/index.js',
          gzipBytes: 512,
          relativePath: 'dist/index.js',
          size: 1536,
        },
      ],
      totalTopLevelJavaScriptBytes: 4096,
    };

    const output = formatBundleSizeReport(report);

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

  test('reads bundle artifacts with deterministic filesystem and gzip collaborators', () => {
    const gzipInputs: string[] = [];
    const ensureFile = jest.fn(
      (relativePath: string): BundleFile => ({
        absolutePath: `/repo/${relativePath}`,
        relativePath,
        size: 2048,
      })
    );
    const readFile = jest.fn(
      (absolutePath: string): Buffer =>
        Buffer.from(`bytes from ${absolutePath}`)
    );
    const gzip = jest.fn((content: Buffer): Buffer => {
      gzipInputs.push(content.toString());
      return Buffer.alloc(7);
    });

    expect(
      readBundleArtifact('dist/index.js', {
        ensureFile,
        gzip,
        readFile,
      })
    ).toEqual({
      absolutePath: '/repo/dist/index.js',
      gzipBytes: 7,
      relativePath: 'dist/index.js',
      size: 2048,
    });
    expect(ensureFile).toHaveBeenCalledWith('dist/index.js');
    expect(readFile).toHaveBeenCalledWith('/repo/dist/index.js');
    expect(gzipInputs).toEqual(['bytes from /repo/dist/index.js']);
  });

  test('lists only top-level JavaScript dist file names', () => {
    const readDirectory = jest.fn((absolutePath: string): string[] => {
      expect(absolutePath).toBe('/repo/dist');
      return [
        'index.js',
        'index.min.js',
        'index.cjs',
        'index.d.ts',
        'nested/extra.js',
        'style.css',
      ];
    });

    expect(
      listTopLevelDistFileNames({
        readDirectory,
        resolveRepoPath: (...segments: string[]) =>
          ['/repo', ...segments].join('/'),
      })
    ).toEqual(['index.js', 'index.min.js', 'index.cjs']);
  });

  test('logs CLI failures and exits with status 1', () => {
    const errors: unknown[] = [];
    const exitCodes: number[] = [];
    const outputs: string[] = [];

    runBundleSizeReportCli({
      exit: (code: number): void => {
        exitCodes.push(code);
      },
      measure: (): BundleSizeReport => {
        throw new Error('Missing expected file: dist/index.js');
      },
      writeError: (message: unknown): void => {
        errors.push(message);
      },
      writeOutput: (message: string): void => {
        outputs.push(message);
      },
    });

    expect(outputs).toEqual([]);
    expect(errors).toEqual(['Missing expected file: dist/index.js']);
    expect(exitCodes).toEqual([1]);
  });
});
