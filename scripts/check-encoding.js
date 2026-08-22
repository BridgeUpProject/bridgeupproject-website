#!/usr/bin/env node
'use strict';

/*
 * check-encoding - catches invisible character corruption in source files.
 *
 * Why this exists: the programs page shipped a broken bullet. site.css held
 * U+0082 - an invisible C1 control character - where a bullet belonged. A CSS
 * hex escape (backslash-2022) had been re-read by some tool as a C-style OCTAL
 * escape, where backslash-202 means 0x82, leaving the trailing "2" behind as a
 * literal. Browsers have no glyph for a control codepoint, so every lesson topic
 * rendered a .notdef box followed by a stray "2".
 *
 * The reason it survived review: opening the file showed content:"2". The
 * corruption is invisible in an editor and in a diff. Only a byte-level check
 * finds it, which is what this script is.
 *
 * Usage:
 *   node scripts/check-encoding.js            # every tracked text file
 *   node scripts/check-encoding.js --staged   # only files staged for commit
 *   node scripts/check-encoding.js a.css b.js # specific paths
 *
 * Exits non-zero when anything is found.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/* Files whose bytes are not text. Reading a PNG as text reports thousands of
 * NUL bytes and bogus codepoints, so these are skipped before any decoding. */
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tgz', '.mp4', '.webm', '.mp3', '.wav',
]);

/* Third-party bundles. We don't author them and can't fix them upstream, so a
 * finding here would be noise we could only silence. */
const SKIP_PREFIXES = ['vendor/', 'node_modules/'];

/* UTF-8 bytes re-read as Latin-1/CP1252 and re-encoded. U+00E2 U+20AC ("a-hat
 * euro") is the signature of the E2 80 xx family - em dash, curly quotes,
 * ellipsis - going through that round trip. Written as escapes so this file
 * stays pure ASCII and cannot corrupt itself. */
const MOJIBAKE = /\u00E2\u20AC/;

/* Everything invisible we refuse to ship. Escapes only, never literals. */
const SUSPECT = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g;

function describe(cp) {
  const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  if (cp === 0xFFFD) {
    return hex + ' REPLACEMENT CHARACTER - text was already decoded lossily upstream';
  }
  if (cp >= 0x80 && cp <= 0x9F) {
    return hex + ' C1 control character - invisible in editors, renders as a .notdef box';
  }
  if (cp === 0x7F) return hex + ' DELETE control character';
  return hex + ' C0 control character';
}

function looksBinary(buf) {
  // The same heuristic git uses: a NUL byte in the first 8k means binary.
  return buf.subarray(0, 8000).includes(0x00);
}

function scan(file) {
  const found = [];
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return found; // deleted or unreadable; nothing to check
  }
  if (buf.length === 0 || looksBinary(buf)) return found;

  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    found.push({ file, line: 1, col: 1, msg: 'UTF-8 BOM - leaks into output and breaks the first CSS rule' });
  }

  let text;
  try {
    // fatal:true so invalid bytes throw instead of silently becoming U+FFFD.
    // That keeps "invalid UTF-8" and "a real U+FFFD in the source" distinct.
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    found.push({ file, line: 1, col: 1, msg: 'not valid UTF-8 - mis-encoded or truncated mid-character' });
    return found;
  }

  text.split('\n').forEach((lineText, i) => {
    let m;
    SUSPECT.lastIndex = 0;
    while ((m = SUSPECT.exec(lineText)) !== null) {
      found.push({
        file, line: i + 1, col: m.index + 1,
        msg: describe(m[0].codePointAt(0)), context: lineText,
      });
    }
    if (MOJIBAKE.test(lineText)) {
      found.push({
        file, line: i + 1, col: lineText.search(MOJIBAKE) + 1,
        msg: 'mojibake - UTF-8 bytes were re-read as Latin-1/CP1252 somewhere',
        context: lineText,
      });
    }
  });

  return found;
}

function gitList(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
}

function selectFiles(argv) {
  const explicit = argv.filter((a) => !a.startsWith('--'));
  if (explicit.length) return explicit;
  return argv.includes('--staged')
    ? gitList(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    : gitList(['ls-files']);
}

function main() {
  const argv = process.argv.slice(2);
  const files = selectFiles(argv).filter((f) => {
    if (SKIP_PREFIXES.some((p) => f.startsWith(p))) return false;
    return !BINARY_EXT.has(path.extname(f).toLowerCase());
  });

  const found = files.flatMap(scan);

  if (found.length === 0) {
    console.log('check-encoding: ' + files.length + ' file(s) clean');
    return 0;
  }

  console.error('\ncheck-encoding: invisible character corruption found\n');
  for (const p of found) {
    console.error('  ' + p.file + ':' + p.line + ':' + p.col + '  ' + p.msg);
    if (p.context) {
      // Reprint the line with the invisible characters spelled out.
      const visible = p.context.replace(SUSPECT, (c) =>
        '<U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') + '>');
      console.error('      ' + visible.trim());
    }
  }
  console.error('\nThese characters are invisible in an editor and in a diff.');
  console.error('Type the intended character directly rather than using a backslash escape.\n');
  return 1;
}

process.exit(main());
