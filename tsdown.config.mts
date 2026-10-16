import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'browser',
  target: 'es2020',
  fixedExtension: true,
  dts: true,
  publint: true,
  // Next.js App Router treats files without it as server components, where
  // the boundary's class state and hooks are not allowed.
  outputOptions: { banner: "'use client';" }
});
