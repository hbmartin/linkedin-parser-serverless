import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { OutputOptions, RollupOptions } from 'rollup';
import { z } from 'zod';
import rollupConfig from '../../rollup.config.js';

const REQUIRED_EXTERNALS = ['chrono-node', 'unpdf', 'zod'] as const;
const PACKAGE_JSON_PATH = fileURLToPath(
  new URL('../../package.json', import.meta.url)
);
const ESBUILD_CONFIG_PATH = fileURLToPath(
  new URL('../../esbuild.config.js', import.meta.url)
);
const PackageJsonSchema = z.object({
  devDependencies: z.record(z.string(), z.string()),
  scripts: z.record(z.string(), z.string()),
});

function packageJson(): z.infer<typeof PackageJsonSchema> {
  return PackageJsonSchema.parse(
    JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
  );
}

function rollupOptions(): RollupOptions {
  return rollupConfig;
}

function rollupOutputOptions(): OutputOptions[] {
  const { output } = rollupOptions();

  if (Array.isArray(output)) {
    return output;
  }

  return output === undefined ? [] : [output];
}

describe('build config contract', () => {
  test('keeps runtime parser dependencies external in rollup', () => {
    expect(rollupConfig.external).toEqual(
      expect.arrayContaining([...REQUIRED_EXTERNALS])
    );
  });

  test('builds every production bundle with rollup', () => {
    const outputOptions = rollupOutputOptions();

    expect(outputOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'dist/index.js', format: 'es' }),
        expect.objectContaining({ file: 'dist/index.cjs', format: 'cjs' }),
        expect.objectContaining({ file: 'dist/index.min.js', format: 'es' }),
      ])
    );
    expect(
      outputOptions.find(output => output.file === 'dist/index.min.js')
    ).toEqual(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({ name: 'terser' }),
        ]),
      })
    );
  });

  test('does not keep esbuild in the production build path', () => {
    const manifest = packageJson();

    expect(manifest.scripts.build).toMatch(/\bpnpm run clean\b/);
    expect(manifest.scripts.build).toMatch(/\btsc --noEmit\b/);
    expect(manifest.scripts.build).toMatch(/\bpnpm run build:bundle\b/);
    expect(manifest.scripts.build).toMatch(/\bpnpm run build:types:cjs\b/);
    expect(manifest.scripts['build:bundle']).toBe('rollup -c');
    expect(manifest.scripts).not.toHaveProperty('build:minify');
    expect(manifest.devDependencies).toHaveProperty('@rollup/plugin-terser');
    expect(manifest.devDependencies).not.toHaveProperty('esbuild');
    expect(fs.existsSync(ESBUILD_CONFIG_PATH)).toBe(false);
  });
});
