import { readFileSync } from 'node:fs';
import { z } from 'zod';

const PackageScriptsSchema = z.object({
  scripts: z.object({
    write: z.string(),
  }),
});

describe('package scripts', () => {
  test('defaults write to the samples JSON writer', () => {
    const manifest = PackageScriptsSchema.parse(
      JSON.parse(
        readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
      )
    );

    expect(manifest.scripts.write).toBe(
      'pnpm run build && node bin/cli.js write-json samples'
    );
  });
});
