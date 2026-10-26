#!/usr/bin/env node
/*! lingua-switch — Copyright (c) 2026 Poolmaarsk.
    MIT License. See /LICENSE. */

// Runs svgo over the vendored flag SVGs in place. `--precision=1`
// (one decimal place of coordinate precision) rather than svgo's
// default: these flags render at ~20×15px (DESIGN.md §3), and a
// handful carry full coat-of-arms detail that dominates file size —
// Afghanistan's went from 222KB to ~35KB at --precision=0, ~97KB at
// --precision=1. Picked 1 as the safer middle ground: still a ~40%
// reduction across the full set, without rounding coordinates down to
// whole pixels in case these are ever reused somewhere larger than the
// picker row. Re-run this after re-fetching/re-vendoring flags (see
// src/assets/flags/SOURCE.md).
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const flagsDir = path.join(root, 'src/assets/flags');
const svgoBin = path.join(root, 'node_modules/.bin/svgo');

function totalBytes() {
  return readdirSync(flagsDir)
    .filter((filename) => filename.endsWith('.svg'))
    .reduce((sum, filename) => sum + statSync(path.join(flagsDir, filename)).size, 0);
}

const sizeBefore = totalBytes();

execFileSync(svgoBin, ['--folder', flagsDir, '--output', flagsDir, '--precision=1', '--quiet'], {
  stdio: 'inherit',
  shell: true, // needed on Windows to resolve node_modules/.bin/svgo -> svgo.cmd
});

const sizeAfter = totalBytes();
const formatKB = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;
console.log(`\nOptimized in place: ${formatKB(sizeBefore)} → ${formatKB(sizeAfter)} (${(100 - (sizeAfter * 100) / sizeBefore).toFixed(1)}% smaller)`);
