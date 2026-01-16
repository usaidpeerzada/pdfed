import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { build } from 'vite';

const browser = process.env.BROWSER || 'chrome';

// Shared plugin for copying files
const copyFilesPlugin = {
  name: 'copy-extension-files',
  closeBundle() {

    const distDir = `dist/${browser}`;
    
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    
    // Copy manifest
    const manifestSrc = `manifest/manifest.${browser}.json`;
    if (existsSync(manifestSrc)) {
      copyFileSync(manifestSrc, `${distDir}/manifest.json`);
      console.log(`✓ Copied manifest for ${browser}`);
    }
    
    // Copy styles
    const stylesDir = `${distDir}/styles`;
    if (!existsSync(stylesDir)) {
      mkdirSync(stylesDir, { recursive: true });
    }
    copyFileSync('src/styles/toolbar.css', `${stylesDir}/toolbar.css`);
    console.log('✓ Copied styles');
    
    // Copy icons
    const iconsDir = 'assets/icons';
    if (existsSync(iconsDir)) {
      const destIconsDir = `${distDir}/assets/icons`;
      if (!existsSync(destIconsDir)) {
        mkdirSync(destIconsDir, { recursive: true });
      }
      ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
        const src = `${iconsDir}/${icon}`;
        if (existsSync(src)) {
          copyFileSync(src, `${destIconsDir}/${icon}`);
        }
      });
      console.log('✓ Copied icons');
    }
  }
};

export default defineConfig(({ mode }) => {
  return {
    build: {
      outDir: `dist/${browser}`,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          'background/service-worker': resolve(__dirname, 'src/background/service-worker.js'),
          'content/index': resolve(__dirname, 'src/content/index.js'),
        },
        output: {
          // ES format works, we just need to ensure everything is bundled
          format: 'es',
          entryFileNames: '[name].js',
          // Bundle all dependencies into entry files
          chunkFileNames: 'chunks/[name]-[hash].js',
        }
      },
      minify: mode === 'production',
      sourcemap: mode === 'development'
    },
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@core': resolve(__dirname, 'src/core'),
        '@toolbar': resolve(__dirname, 'src/toolbar'),
        '@utils': resolve(__dirname, 'src/utils')
      }
    },
    
    define: {
      'process.env.BROWSER': JSON.stringify(browser)
    },
    
    plugins: [copyFilesPlugin]
  };
});
