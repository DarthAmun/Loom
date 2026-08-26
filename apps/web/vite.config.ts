/// <reference types="vitest" />

import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    target: ['es2020'],
  },
  resolve: {
    mainFields: ['module'],
    // Without this, Vite resolves the "loom" workspace symlink
    // (apps/web/node_modules/loom -> ../../..) to its realpath outside
    // node_modules. @analogjs/vite-plugin-angular excludes node_modules
    // from Angular's TypeScript compiler by matching "node_modules" in the
    // module id — a realpath'd id doesn't contain that substring, so
    // "loom"'s plain TS source (no Angular decorators) was getting pulled
    // into Angular's AOT compiler and failing under apps/web's stricter
    // tsconfig (noPropertyAccessFromIndexSignature), which the engine
    // package doesn't opt into. Keeping the symlinked id intact lets that
    // exclude match correctly.
    preserveSymlinks: true,
  },
  plugins: [
    analog({
      ssr: false,
      static: true,
      prerender: {
        routes: [],
      },
    }),
    tailwindcss()
  ],
}));
