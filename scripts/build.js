// scripts/build.js - Custom build script for browser extension
import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const browser = process.env.BROWSER || 'chrome';
const distDir = resolve(rootDir, `dist/${browser}`);
const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';

// Clean dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

console.log(`\n🔨 Building pdfed for ${browser}...\n`);

// Build entries separately as IIFE
const entries = [
  {
    name: 'content/index',
    input: resolve(rootDir, 'src/content/index.js'),
    output: resolve(distDir, 'content/index.js')
  },
  {
    name: 'background/service-worker',
    input: resolve(rootDir, 'src/background/service-worker.js'),
    output: resolve(distDir, 'background/service-worker.js')
  }
];

async function buildEntry(entry) {
  const outDir = dirname(entry.output);
  
  await build({
    configFile: false,
    build: {
      lib: {
        entry: entry.input,
        name: 'pdfed',
        formats: ['iife'],
        fileName: () => 'index.js'
      },
      outDir: outDir,
      emptyOutDir: false,
      minify: mode === 'production',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          entryFileNames: entry.name.split('/').pop() + '.js',
          // Extend window for content scripts
          extend: true
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(rootDir, 'src'),
        '@core': resolve(rootDir, 'src/core'),
        '@toolbar': resolve(rootDir, 'src/toolbar'),
        '@utils': resolve(rootDir, 'src/utils')
      }
    },
    define: {
      'process.env.BROWSER': JSON.stringify(browser)
    },
    logLevel: 'warn'
  });
  
  console.log(`  ✓ Built ${entry.name}`);
}

async function copyFiles() {
  // Copy manifest
  const manifestSrc = resolve(rootDir, `manifest/manifest.${browser}.json`);
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, resolve(distDir, 'manifest.json'));
    console.log('  ✓ Copied manifest');
  }
  
  // Copy styles
  const stylesDir = resolve(distDir, 'styles');
  if (!existsSync(stylesDir)) {
    mkdirSync(stylesDir, { recursive: true });
  }
  copyFileSync(resolve(rootDir, 'src/styles/toolbar.css'), resolve(stylesDir, 'toolbar.css'));
  console.log('  ✓ Copied styles');
  
  // Copy icons
  const iconsDir = resolve(rootDir, 'assets/icons');
  if (existsSync(iconsDir)) {
    const destIconsDir = resolve(distDir, 'assets/icons');
    if (!existsSync(destIconsDir)) {
      mkdirSync(destIconsDir, { recursive: true });
    }
    ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
      const src = resolve(iconsDir, icon);
      if (existsSync(src)) {
        copyFileSync(src, resolve(destIconsDir, icon));
      }
    });
    console.log('  ✓ Copied icons');
  }
  
  // Copy PDF.js worker
  const libDir = resolve(distDir, 'lib');
  if (!existsSync(libDir)) {
    mkdirSync(libDir, { recursive: true });
  }
  const workerSrc = resolve(rootDir, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  const workerSrcAlt = resolve(rootDir, 'node_modules/pdfjs-dist/build/pdf.worker.min.js');
  
  if (existsSync(workerSrc)) {
    copyFileSync(workerSrc, resolve(libDir, 'pdf.worker.min.js'));
    console.log('  ✓ Copied PDF.js worker');
  } else if (existsSync(workerSrcAlt)) {
    copyFileSync(workerSrcAlt, resolve(libDir, 'pdf.worker.min.js'));
    console.log('  ✓ Copied PDF.js worker');
  } else {
    console.warn('  ⚠ PDF.js worker not found in node_modules');
  }
}

async function main() {
  try {
    // Build all entries
    for (const entry of entries) {
      await buildEntry(entry);
    }
    
    // Copy static files
    await copyFiles();
    
    console.log(`\n✅ Build complete! Output: dist/${browser}/\n`);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();
