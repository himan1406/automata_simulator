import { defineConfig } from 'vite';

// Relative base + a single classic script, so the built site works from any URL path
// (GitHub Pages sub-folders, Netlify, S3, a USB stick) and scripts/inline.mjs can fold it into one file.
export default defineConfig({
  base: './',
  build: {
    outDir: 'website', // the finished site lives in the project folder: website/index.html
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
