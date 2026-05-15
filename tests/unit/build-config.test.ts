import esbuildConfig from '../../esbuild.config.js';
import rollupConfig from '../../rollup.config.js';

const REQUIRED_EXTERNALS = ['chrono-node', 'unpdf', 'zod'] as const;

describe('build externals contract', () => {
  test('keeps runtime parser dependencies external in esbuild', () => {
    expect(esbuildConfig.external).toEqual(
      expect.arrayContaining([...REQUIRED_EXTERNALS])
    );
  });

  test('keeps runtime parser dependencies external in rollup', () => {
    expect(rollupConfig.external).toEqual(
      expect.arrayContaining([...REQUIRED_EXTERNALS])
    );
  });
});
