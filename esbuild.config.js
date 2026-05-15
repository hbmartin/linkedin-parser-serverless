import esbuild from 'esbuild';

// Build ultra-minified version
esbuild.build({
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
}).catch(() => process.exit(1));
