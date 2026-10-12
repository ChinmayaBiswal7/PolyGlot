'use strict';

// ═══════════════════════════════════════════════════════════
//  Language Detection Engine
//  Supports: Python, Java, C, C++, JavaScript, TypeScript, Rust, Go
// ═══════════════════════════════════════════════════════════

const LANGUAGE_PATTERNS = {

  python: {
    strong: [
      /^\s*print\s*\(/,
      /^\s*def\s+\w+\s*\(/,
      /^\s*class\s+\w+\s*.*:/,
      /^\s*import\s+\w+/,
      /^\s*from\s+\w+\s+import/,
      /^\s*elif\s+/,
      /^\s*except\s*/,
      /^\s*finally\s*:/,
      /^\s*with\s+/,
      /^\s*yield\s/,
      /^\s*lambda\s/,
      /^\s*input\s*\(/,
      /^\s*range\s*\(/,
      /^\s*len\s*\(/,
      /\[\s*\w+\s+for\s+\w+\s+in\s+/,
      /^\s*#[^i][^n][^c]/,
    ],
    moderate: [
      /:\s*$/,
      /^\s*if\s+.*:\s*$/,
      /^\s*for\s+\w+\s+in\s+/,
      /^\s*while\s+.*:\s*$/,
      /^\s*return\s+/,
      /^\s*\w+\s*=\s*\[.*\]\s*$/,
    ],
    weak: []
  },

  rust: {
    strong: [
      /\bprintln!\s*\(/,
      /\bprint!\s*\(/,
      /\beprintln!\s*\(/,
      /\bfn\s+main\s*\(\s*\)/,
      /^\s*let\s+mut\s+/,
      /^\s*pub\s+fn\s+/,
      /^\s*impl\s+/,
      /^\s*match\s+\w+\s*\{/,
      /\bVec::new\(\)/,
      /\bString::from\(/,
      /->\s*(i32|u32|i64|u64|String|bool|usize)\b/,
    ],
    moderate: [
      /^\s*fn\s+\w+\s*\(/,
      /\bmut\s+\w+/,
      /\/\/\s*.*Rust/i,
    ],
    weak: [
      /;\s*$/,
    ]
  },

  go: {
    strong: [
      /\bfmt\.Println\s*\(/,
      /\bfmt\.Printf\s*\(/,
      /\bfmt\.Print\s*\(/,
      /^\s*package\s+main\b/,
      /^\s*import\s+"fmt"/,
      /^\s*func\s+main\s*\(\s*\)/,
      /^\s*func\s+\w+\s*\(/,
      /:=\s*/,
      /\bgo\s+\w+\s*\(/,
      /\bmake\s*\(\s*(chan|map|\[\])/,
    ],
    moderate: [
      /^\s*type\s+\w+\s+struct/,
      /\/\/\s*.*Go\b/i,
    ],
    weak: []
  },

  typescript: {
    strong: [
      /:\s*(string|number|boolean|any|unknown|never|void)\b\s*[=;,)]/,
      /^\s*interface\s+\w+/,
      /^\s*type\s+\w+\s*=/,
      /as\s+(string|number|boolean|any)/,
      /<\s*T\s*>/,
    ],
    moderate: [
      /\/\/\s*.*TypeScript/i,
      /\/\/\s*.*TS\b/i,
    ],
    weak: []
  },

  java: {
    strong: [
      /System\.out\.println\s*\(/,
      /System\.out\.print\s*\(/,
      /System\.out\.printf\s*\(/,
      /public\s+static\s+void\s+main/,
      /public\s+class\s+/,
      /private\s+class\s+/,
      /import\s+java\./,
      /import\s+javax\./,
      /new\s+Scanner\s*\(/,
      /new\s+ArrayList/,
      /new\s+HashMap/,
      /\.println\s*\(/,
    ],
    moderate: [
      /^\s*(public|private|protected)\s+/,
      /^\s*String\s+\w+/,
      /^\s*boolean\s+\w+/,
      /\.equals\s*\(/,
      /\.length\(\)/,
      /\.toString\s*\(/,
      /\/\/\s*.*Java\b/i,
    ],
    weak: [
      /;\s*$/,
    ]
  },

  c: {
    strong: [
      /^\s*printf\s*\(/,
      /^\s*scanf\s*\(/,
      /^\s*#include\s*<stdio\.h>/,
      /^\s*#include\s*<stdlib\.h>/,
      /^\s*#include\s*<string\.h>/,
      /^\s*#include\s*<math\.h>/,
      /^\s*int\s+main\s*\(\s*(void)?\s*\)/,
      /\bmalloc\s*\(/,
      /\bfree\s*\(/,
      /\bsizeof\s*\(/,
      /\bgets\s*\(/,
      /\bputs\s*\(/,
      /^\s*int\s+\w+\s*=\s*[^;]+;/,
      /^\s*for\s*\(\s*int\s+\w+/,
    ],
    moderate: [
      /^\s*#include\s*<[^i]/,
      /^\s*#define\s+/,
      /^\s*typedef\s+/,
      /^\s*struct\s+\w+/,
      /\*\s*\w+\s*=/,
      /\/\/\s*Step\s*\d*.*C\b/i,
    ],
    weak: [
      /;\s*$/,
    ]
  },

  cpp: {
    strong: [
      /\bcout\s*<</,
      /\bcin\s*>>/,
      /\bcerr\s*<</,
      /^\s*#include\s*<iostream>/,
      /^\s*#include\s*<string>/,
      /^\s*#include\s*<vector>/,
      /^\s*#include\s*<algorithm>/,
      /^\s*#include\s*<map>/,
      /^\s*using\s+namespace\s+std/,
      /\bstd::/,
      /\bendl\b/,
    ],
    moderate: [
      /^\s*template\s*</,
      /^\s*namespace\s+/,
      /^\s*auto\s+\w+/,
      /\w+::\w+/,
      /\/\/\s*Step\s*\d*.*C\+\+/i,
    ],
    weak: [
      /;\s*$/,
    ]
  },

  javascript: {
    strong: [
      /\bconsole\.log\s*\(/,
      /\bconsole\.error\s*\(/,
      /\bconsole\.warn\s*\(/,
      /\bdocument\.\w+/,
      /\bwindow\.\w+/,
      /^\s*const\s+\w+\s*=/,
      /^\s*let\s+\w+\s*=/,
      /^\s*var\s+\w+\s*=/,
      /=>\s*[{\w]/,
      /^\s*function\s+\w+\s*\(/,
      /\brequire\s*\(/,
      /\bmodule\.exports/,
      /^\s*async\s+/,
      /\bawait\s+/,
      /\.forEach\s*\(/,
      /\.map\s*\(/,
      /\.filter\s*\(/,
      /\.then\s*\(/,
      /\.catch\s*\(/,
      /\bPromise\./,
    ],
    moderate: [
      /===|!==/,
      /`[^`]*\$\{/,
      /\/\/\s*Step\s*\d*.*JavaScript/i,
      /\/\/\s*Step\s*\d*.*JS/i,
    ],
    weak: [
      /;\s*$/,
    ]
  }
};

/**
 * Detect the programming language of a single line of code.
 * Returns { language, confidence } where confidence is 0–1.
 */
function detectLanguage(line) {
  const trimmed = line.trim();

  // Skip empty lines, lone braces, and pure whitespace
  if (!trimmed || /^[{}()\[\]]*$/.test(trimmed)) {
    return { language: 'unknown', confidence: 0 };
  }

  const scores = {};

  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    let score = 0;

    for (const re of patterns.strong) {
      if (re.test(trimmed)) score += 10;
    }
    for (const re of patterns.moderate) {
      if (re.test(trimmed)) score += 4;
    }
    for (const re of patterns.weak) {
      if (re.test(trimmed)) score += 1;
    }

    scores[lang] = score;
  }

  let bestLang = 'unknown';
  let bestScore = 0;

  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  if (bestScore < 4) {
    return { language: 'unknown', confidence: 0 };
  }

  return {
    language: bestLang,
    confidence: Math.min(bestScore / 15, 1),
  };
}

module.exports = { detectLanguage, LANGUAGE_PATTERNS };
