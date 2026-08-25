#!/usr/bin/env node
'use strict';

/**
 * check-chrome - the nav and footer must not drift between pages.
 *
 * There is no build step here, so the header and footer are copy-pasted
 * into all four HTML files. That is a reasonable choice for four pages,
 * but it has one failure mode and this repo already hit it: every footer
 * had quietly diverged, each one dropping the link to its own page, and
 * none of them linked home. Nobody edits four files and forgets on
 * purpose - it drifts one hurried change at a time, and a diff of a
 * single file never shows it.
 *
 * So the parity is checked rather than trusted. Blocks are compared after
 * normalising whitespace and after stripping aria-current, which is the
 * one attribute that is SUPPOSED to differ per page.
 *
 * Same shape as check-encoding.js: exit 1 on any finding, run from the
 * pre-commit hook, bypassable with --no-verify.
 */

const fs = require('fs');
const path = require('path');

const PAGES = ['index.html', 'programs.html', 'about.html', 'connect.html'];

const BLOCKS = [
  { name: 'nav',    re: /<nav>[\s\S]*?<\/nav>/ },
  { name: 'footer', re: /<footer>[\s\S]*?<\/footer>/ }
];

/* aria-current is the sanctioned per-page difference; everything else
   in these blocks must match byte for byte once whitespace is even. */
function normalise(block) {
  return block
    .replace(/\s+aria-current="page"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return n;
}

function main() {
  const root = path.resolve(__dirname, '..');
  let failures = 0;

  for (const { name, re } of BLOCKS) {
    const found = [];

    for (const page of PAGES) {
      const file = path.join(root, page);
      if (!fs.existsSync(file)) {
        console.error(`check-chrome: ${page} not found`);
        failures++;
        continue;
      }
      const match = fs.readFileSync(file, 'utf8').match(re);
      if (!match) {
        console.error(`check-chrome: ${page} has no <${name}> block`);
        failures++;
        continue;
      }
      found.push({ page, text: normalise(match[0]) });
    }

    if (found.length < 2) continue;

    const [reference, ...rest] = found;
    for (const other of rest) {
      if (other.text === reference.text) continue;

      failures++;
      const at = firstDifference(reference.text, other.text);
      const window = 70;
      const from = Math.max(0, at - 25);
      console.error(
        `\ncheck-chrome: <${name}> in ${other.page} differs from ${reference.page}\n` +
        `  at character ${at}:\n` +
        `    ${reference.page.padEnd(14)} ...${reference.text.slice(from, from + window)}...\n` +
        `    ${other.page.padEnd(14)} ...${other.text.slice(from, from + window)}...\n` +
        `  Fix by copying the block, not by editing one side.\n` +
        `  aria-current="page" is ignored by this check and may differ.`
      );
    }
  }

  if (failures) {
    console.error(`\ncheck-chrome: ${failures} problem(s). Commit blocked.`);
    return 1;
  }
  console.log(`check-chrome: nav and footer match across ${PAGES.length} pages`);
  return 0;
}

process.exit(main());
