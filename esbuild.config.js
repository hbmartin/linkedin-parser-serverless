import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';

// Build ultra-minified version
const esbuildConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.min.js',
  format: 'esm',
  platform: 'node',
  target: 'node18',
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  sourcemap: true,
  external: ['chrono-node', 'unpdf', 'zod'],
  tsconfig: 'tsconfig.json',
  treeShaking: true,
  drop: ['console', 'debugger'],
};

export default esbuildConfig;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  esbuild.build(esbuildConfig).catch(error => {
    console.error(error);
    process.exit(1);
  });
}
