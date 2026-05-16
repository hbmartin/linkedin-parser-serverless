import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/index.min.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
      plugins: [
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
          format: {
            comments: false,
          },
        }),
      ],
    },
  ],
  external: ['chrono-node', 'unpdf', 'zod'],
  plugins: [
    resolve({
      preferBuiltins: true,
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      rootDir: 'src',
    }),
  ],
});
