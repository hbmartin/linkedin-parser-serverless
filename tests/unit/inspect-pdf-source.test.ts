import * as path from 'node:path';
import {
  createFailureManifestEntry,
  createItemOverlayHtml,
  normalizeUnpdfTextItem,
  resolveBundleOutputDirs,
} from '../../scripts/inspect-pdf-source.mjs';

describe('inspect PDF source overlay helpers', () => {
  test('derives inspectable text item coordinates from PDF.js transform matrices', () => {
    const rawTextItem = {
      height: 12,
      str: 'Jane Doe',
      transform: [1, 0, 0, 1, 72.25, 650.5],
      width: 42,
    };

    expect(normalizeUnpdfTextItem(rawTextItem)).toEqual({
      ...rawTextItem,
      x: 72.25,
      y: 650.5,
    });
  });

  test('renders normalized unpdf text items without NaN overlay coordinates', () => {
    const normalizedTextItem = normalizeUnpdfTextItem({
      height: 12,
      str: 'Jane Doe',
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
    expect(html).toContain('Jane Doe');
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
