'use strict';

const { detectLanguage } = require('./detector');

// ═══════════════════════════════════════════════════════════
//  Code Splitter
//  Splits mixed-language code into blocks grouped by detected language.
//  Preserves single-language full programs without fragmenting them,
//  and cleanly separates multi-program / multi-language mixtures.
// ═══════════════════════════════════════════════════════════

function isSameFamily(langA, langB) {
  if (langA === langB) return true;
  if ((langA === 'javascript' || langA === 'typescript') &&
      (langB === 'javascript' || langB === 'typescript')) {
    return true;
  }
  if ((langA === 'c' || langA === 'cpp') &&
      (langB === 'c' || langB === 'cpp')) {
    return true;
  }
  return false;
}

const EXTENSION_MAP = {
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.rs': 'rust',
  '.go': 'go',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript',
};

function hasExplicitMarker(code) {
  return /^\s*(?:\/\/|#|\/\*)\s*(?:stage|step|part|language|\bcode\b|──|-+)?\s*.*?(?:python|javascript|typescript|\bjs\b|\bts\b|\bc\b|c\+\+|\bcpp\b|\brust\b|\bgo\b|\bgolang\b|\bjava\b)/im.test(code);
}

function detectUnifiedLanguage(code) {
  if (hasExplicitMarker(code)) return null;

  const detected = new Set();

  // Rust
  if (/\bfn\s+main\s*\(\s*\)/.test(code) || /^\s*impl(?:\s+<[^>]+>)?\s+\w+/m.test(code) || /\bprintln!\s*\(/.test(code) || /^\s*use\s+std::/m.test(code)) {
    detected.add('rust');
  }
  // Go
  if (/^\s*package\s+main\b/m.test(code) || /\bfunc\s+main\s*\(\s*\)/.test(code)) {
    detected.add('go');
  }
  // Java
  if (/\bpublic\s+class\b/.test(code) || /\bpublic\s+static\s+void\s+main\b/.test(code) || /^\s*import\s+java\./m.test(code) || /System\.out\.(?:println|print|printf)/.test(code)) {
    detected.add('java');
  }
  // C++
  if (/#include\s*<iostream>|#include\s*<vector>|#include\s*<string>|#include\s*<algorithm>|#include\s*<map>|\busing\s+namespace\s+std\b|\bcout\s*<<|\bcin\s*>>|\bclass\s+\w+(?:\s*:\s*public\s+\w+)?\s*\{/.test(code)) {
    detected.add('cpp');
  }
  // C
  if (/#include\s*<stdio\.h>|#include\s*<stdlib\.h>|^\s*(?:int|void|signed)\s+main\s*\(/m.test(code)) {
    if (!detected.has('cpp')) detected.add('c');
  }
  // Python
  if (/^\s*def\s+\w+\s*\(|^\s*from\s+\w+\s+import|\[\s*\w+\s+for\s+\w+\s+in\s+/.test(code)) {
    detected.add('python');
  }

  // Exactly one distinct language is present in the entire file
  if (detected.size === 1) {
    return [...detected][0];
  }

  // If multiple languages are detected, it is a polyglot / multi-language mixture
  return null;
}

function splitCode(code, filename = '') {
  const lines = code.split('\n');

  // Check filename extension first
  if (filename) {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const mapped = EXTENSION_MAP[ext];
    if (mapped && !hasExplicitMarker(code)) {
      return {
        blocks: [{
          language: mapped,
          lines: lines,
          originalLineNumbers: lines.map((_, i) => i + 1)
        }],
        detectedLines: lines.map((content, i) => ({ lineNumber: i + 1, content, language: mapped, confidence: 1.0 }))
      };
    }
  }

  // Check if entire code is an unambiguous single-language program
  const unified = detectUnifiedLanguage(code);
  if (unified) {
    return {
      blocks: [{
        language: unified,
        lines: lines,
        originalLineNumbers: lines.map((_, i) => i + 1)
      }],
      detectedLines: lines.map((content, i) => {
        const d = detectLanguage(content);
        return {
          lineNumber: i + 1,
          content,
          language: d.language === 'unknown' ? unified : d.language,
          confidence: d.confidence || 0.8
        };
      })
    };
  }

  // Multi-language polyglot splitting pass
  const detectedLines = [];
  let currentLangContext = null;

  for (let i = 0; i < lines.length; i++) {
    const detection = detectLanguage(lines[i], currentLangContext);
    if (detection.language !== 'unknown') {
      currentLangContext = detection.language;
    }
    detectedLines.push({
      lineNumber: i + 1,
      content: lines[i],
      language: detection.language,
      confidence: detection.confidence,
    });
  }

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
  let braceDepth = 0;

  for (const line of detectedLines) {
    const openBraces = (line.content.match(/\{/g) || []).length;
    const closeBraces = (line.content.match(/\}/g) || []).length;

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
      braceDepth = Math.max(0, braceDepth + openBraces - closeBraces);
      continue;
    }

    const isExplicitMarker = /^\s*(?:\/\/|#|\/\*)\s*(?:stage|step|part|language|\bcode\b|──|-+)?\s*.*?(?:python|javascript|typescript|\bjs\b|\bts\b|\bc\b|c\+\+|\bcpp\b|\brust\b|\bgo\b|\bgolang\b|\bjava\b)/i.test(line.content);

    // If inside an open brace block (function, class, struct), do not switch unless explicitly marked
    if (current && braceDepth > 0 && !isExplicitMarker) {
      current.lines.push(line.content);
      current.originalLineNumbers.push(line.lineNumber);
      braceDepth = Math.max(0, braceDepth + openBraces - closeBraces);
      continue;
    }

    // Only switch if confidence is high or an explicit marker is present
    if (current && line.confidence < 0.6 && !isExplicitMarker && !isSameFamily(current.language, line.language)) {
      current.lines.push(line.content);
      current.originalLineNumbers.push(line.lineNumber);
      braceDepth = Math.max(0, braceDepth + openBraces - closeBraces);
      continue;
    }

    // If current block already matches the detected line's language or family, stay in current
    if (current && (current.language === line.language || isSameFamily(current.language, line.language))) {
      if (line.language === 'typescript') current.language = 'typescript';
      if (line.language === 'cpp') current.language = 'cpp';
      current.lines.push(line.content);
      current.originalLineNumbers.push(line.lineNumber);
      braceDepth = Math.max(0, braceDepth + openBraces - closeBraces);
      continue;
    }

    const shouldStartNew = !current || isExplicitMarker || !isSameFamily(current.language, line.language);

    if (shouldStartNew) {
      if (current) blocks.push(current);
      current = {
        language: line.language,
        lines: [line.content],
        originalLineNumbers: [line.lineNumber],
      };
    } else {
      current.lines.push(line.content);
      current.originalLineNumbers.push(line.lineNumber);
    }

    braceDepth = Math.max(0, braceDepth + openBraces - closeBraces);
  }

  if (current) blocks.push(current);

  return { blocks, detectedLines };
}

module.exports = { splitCode };
