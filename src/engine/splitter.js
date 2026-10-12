'use strict';

const { detectLanguage } = require('./detector');

// ═══════════════════════════════════════════
//  Code Splitter
//  Splits mixed-language code into blocks
//  grouped by detected language.
//  Note: TypeScript and JavaScript belong to the same Node/TS family
// ═══════════════════════════════════════════

function isSameFamily(langA, langB) {
  if (langA === langB) return true;
  if ((langA === 'javascript' || langA === 'typescript') &&
      (langB === 'javascript' || langB === 'typescript')) {
    return true;
  }
  return false;
}

function splitCode(code) {
  const lines = code.split('\n');
  const detectedLines = [];

  // ── Pass 1: detect each line ──
  for (let i = 0; i < lines.length; i++) {
    const detection = detectLanguage(lines[i]);
    detectedLines.push({
      lineNumber: i + 1,
      content: lines[i],
      language: detection.language,
      confidence: detection.confidence,
    });
  }

  // ── Pass 2: group consecutive lines of the same language/family ──
  let firstKnownLang = null;
  for (const line of detectedLines) {
    if (line.language !== 'unknown') {
      firstKnownLang = line.language;
      break;
    }
  }
  if (!firstKnownLang) firstKnownLang = 'python';

  const blocks = [];
  let current = null;

  for (const line of detectedLines) {
    if (line.language === 'unknown') {
      if (!current) {
        current = {
          language: firstKnownLang,
          lines: [line.content],
          originalLineNumbers: [line.lineNumber],
        };
      } else {
        current.lines.push(line.content);
        current.originalLineNumbers.push(line.lineNumber);
      }
      continue;
    }

    if (!current || !isSameFamily(current.language, line.language)) {
      if (current) blocks.push(current);
      current = {
        language: line.language,
        lines: [line.content],
        originalLineNumbers: [line.lineNumber],
      };
    } else {
      // If either line in block is TypeScript, elevate block to TypeScript
      if (line.language === 'typescript') {
        current.language = 'typescript';
      }
      current.lines.push(line.content);
      current.originalLineNumbers.push(line.lineNumber);
    }
  }

  if (current) blocks.push(current);

  return { blocks, detectedLines };
}

module.exports = { splitCode };
