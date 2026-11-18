import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the companion page for a claude.ai Artifact: chat and mic use
// claude.ai's built-in features instead of the Worker and the browser
// recogniser. scripts/inline-artifact.mjs then folds it into one file.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, './src') },
      { find: /^\.\/useCompanionChat$/, replacement: path.resolve(import.meta.dirname, './src/artifact/useArtifactChat.ts') },
      { find: /^\.\/useSpeechInput$/, replacement: path.resolve(import.meta.dirname, './src/artifact/useArtifactSpeech.ts') },
    ],
  },
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: path.resolve(import.meta.dirname, 'artifact.html') },
  },
})
