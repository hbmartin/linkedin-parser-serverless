import * as path from 'node:path';
import {
  createFailureManifestEntry,
  createItemOverlayHtml,
  normalizeUnpdfTextItem,
  resolvePdfPaths,
  resolveBundleOutputDirs,
} from '../../scripts/inspect-pdf-source.mjs';

interface ReadSortedPdfFileNamesCall {
  emptyMessage: string;
  samplesDir: string;
}

function fakePdfDirectory(fileNames: string[]): {
  calls: ReadSortedPdfFileNamesCall[];
  dependencies: {
    readSortedPdfFileNames: (
      samplesDir: string,
      emptyMessage: string
    ) => Promise<string[]>;
  };
} {
  const calls: ReadSortedPdfFileNamesCall[] = [];

  return {
    calls,
    dependencies: {
      async readSortedPdfFileNames(samplesDir, emptyMessage) {
        calls.push({ emptyMessage, samplesDir });

        return fileNames;
      },
    },
  };
}

describe('inspect PDF source overlay helpers', () => {
  test('derives inspectable text item coordinates from PDF.js transform matrices', () => {
    const rawTextItem = {
      height: 12,
      str: 'Cassandra Troy',
      transform: [1, 0, 0, 1, 72.25, 650.5],
      width: 42,
    };

    expect(normalizeUnpdfTextItem(rawTextItem)).toEqual({
      ...rawTextItem,
      x: 72.25,
      y: 650.5,
    });
  });

  test('normalizes nullish unpdf text items to an overlay-safe blank item', () => {
    const blankTextItem = {
      height: 0,
      str: '',
      width: 0,
      x: 0,
      y: 0,
    };

    expect(normalizeUnpdfTextItem(null)).toEqual(blankTextItem);
    expect(normalizeUnpdfTextItem(undefined)).toEqual(blankTextItem);
  });

  test('renders normalized unpdf text items without NaN overlay coordinates', () => {
    const normalizedTextItem = normalizeUnpdfTextItem({
      height: 12,
      str: 'Cassandra Troy',
      transform: [1, 0, 0, 1, 72.25, 650.5],
      width: 42,
    });

    const html = createItemOverlayHtml({
      height: 792,
      item: normalizedTextItem,
      parserLayout: undefined,
    });

    expect(html).toContain('x="144.50"');
    expect(html).toContain('y="259.00"');
    expect(html).toContain('Cassandra Troy');
    expect(html).not.toContain('NaN');
  });

  test('keeps multi-file bundle directories distinct for duplicate PDF stems', () => {
    const outputDirs = resolveBundleOutputDirs({
      outputOption: '.debug/source-inspect',
      pdfPaths: [
        path.join(process.cwd(), 'samples/team-a/Profile.pdf'),
        path.join(process.cwd(), 'samples/team-b/Profile.pdf'),
      ],
    });

    expect(new Set(outputDirs).size).toBe(2);
    expect(outputDirs).toEqual([
      expect.stringMatching(/Profile-[a-f0-9]{8}$/),
      expect.stringMatching(/Profile-[a-f0-9]{8}$/),
    ]);
  });

  test('preserves explicit output directory for a single PDF bundle', () => {
    expect(
      resolveBundleOutputDirs({
        outputOption: '.debug/exact-output',
        pdfPaths: [path.join(process.cwd(), 'samples/Profile.pdf')],
      })
    ).toEqual([path.join(process.cwd(), '.debug/exact-output')]);
  });

  test('defaults to inspecting PDFs from the samples directory', async () => {
    const { calls, dependencies } = fakePdfDirectory([
      'Alpha Profile.pdf',
      'Beta Profile.pdf',
    ]);

    await expect(
      resolvePdfPaths({
        dependencies,
        positionalPdfPaths: [],
      })
    ).resolves.toEqual([
      path.join(process.cwd(), 'samples/Alpha Profile.pdf'),
      path.join(process.cwd(), 'samples/Beta Profile.pdf'),
    ]);
    expect(calls).toEqual([
      {
        emptyMessage: expect.stringContaining('No PDF files found'),
        samplesDir: path.join(process.cwd(), 'samples'),
      },
    ]);
  });

  test('uses explicit positional PDFs instead of the default samples directory', async () => {
    const { calls, dependencies } = fakePdfDirectory(['Unused.pdf']);

    await expect(
      resolvePdfPaths({
        dependencies,
        positionalPdfPaths: ['custom/Profile.pdf'],
      })
    ).resolves.toEqual([path.join(process.cwd(), 'custom/Profile.pdf')]);
    expect(calls).toEqual([]);
  });

  test('keeps the explicit samples directory option when provided', async () => {
    const { calls, dependencies } = fakePdfDirectory(['Profile.pdf']);

    await expect(
      resolvePdfPaths({
        dependencies,
        positionalPdfPaths: [],
        samplesOption: 'fixtures/pdfs',
      })
    ).resolves.toEqual([path.join(process.cwd(), 'fixtures/pdfs/Profile.pdf')]);
    expect(calls).toEqual([
      {
        emptyMessage: expect.stringContaining('No PDF files found'),
        samplesDir: path.join(process.cwd(), 'fixtures/pdfs'),
      },
    ]);
  });

  test('rejects simultaneous samples option and positional PDFs', async () => {
    const { calls, dependencies } = fakePdfDirectory(['Unused.pdf']);

    await expect(
      resolvePdfPaths({
        dependencies,
        positionalPdfPaths: ['custom/Profile.pdf'],
        samplesOption: 'fixtures/pdfs',
      })
    ).rejects.toThrow(
      'Cannot specify both --samples and positional PDF paths.'
    );
    expect(calls).toEqual([]);
  });

  test('includes failure detail artifact paths in manifest entries', () => {
    expect(
      createFailureManifestEntry({
        artifact: 'pdfinfo.txt',
        message: 'command failed',
        relativePath: 'pdfinfo.error.txt',
      })
    ).toEqual({
      artifact: 'pdfinfo.txt',
      message: 'command failed',
      relativePath: 'pdfinfo.error.txt',
    });
  });
});
