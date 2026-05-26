import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractLinkedInPDFSourceDebug } from '../../src/index.js';

describe('PDF source debug artifacts', () => {
  test('extracts parser structural evidence from a PDF buffer', async () => {
    const profilePdfPath = fileURLToPath(
      new URL('../fixtures/Profile.pdf', import.meta.url)
    );
    const artifacts = await extractLinkedInPDFSourceDebug(
      fs.readFileSync(profilePdfPath)
    );

    expect(artifacts.rawText).toEqual(expect.stringContaining('Harold Martin'));
    expect(artifacts.textItems.length).toBeGreaterThan(0);
    expect(artifacts.structuralLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('Harold Martin'),
        }),
      ])
    );
    expect(artifacts.layout).toEqual(
      expect.objectContaining({
        type: expect.stringMatching(/^(single|two)-column$/),
      })
    );
  });
});
