'use strict';

// ═══════════════════════════════════════════════════════════
//  Language Detection Engine
//  Supports: Python, Java, C, C++, JavaScript, TypeScript, Rust, Go
//  Full OOP, pointers, structs, generic syntax support
// ═══════════════════════════════════════════════════════════

const LANGUAGE_PATTERNS = {

  python: {
    strong: [
      /^\s*print\s*\(/,
      /^\s*def\s+\w+\s*\(/,
      /^\s*class\s+\w+(?:\([^)]*\))?\s*:\s*$/,
      /^\s*import\s+\w+/,
      /^\s*from\s+\w+\s+import/,
      /^\s*elif\s+/,
      /^\s*except(?:\s+.*)?:\s*$/,
      /^\s*finally\s*:\s*$/,
      /^\s*with\s+/,
      /^\s*yield\s/,
      /^\s*lambda\s/,
      /^\s*input\s*\(/,
      /^\s*range\s*\(/,
      /^\s*len\s*\(/,
      /\[\s*\w+\s+for\s+\w+\s+in\s+/,
      /#\s*.*python/i,
      /^\s*#[^i][^n][^c]/,
    ],
    moderate: [
      /^\s*(?:if|elif|else|for|while|try|except|finally|with|def|class|async\s+def)\b.*:\s*$/,
      /^\s*for\s+\w+\s+in\s+/,
      /^\s*return(?:\s+[^;]+)?\s*$/,
      /^\s*\w+\s*=\s*\[.*\]\s*$/,
    ],
    weak: []
  },

  rust: {
    strong: [
      /\bprintln!\s*\(/,
      /\bprint!\s*\(/,
      /\beprintln!\s*\(/,
      /\bformat!\s*\(/,
      /\bvec!\s*\[/,
      /\bfn\s+main\s*\(\s*\)/,
      /^\s*(?:pub\s+)?fn\s+\w+/,
      /^\s*let\s+mut\s+/,
      /^\s*pub\s+(?:fn|struct|enum|trait|type|const)/,
      /^\s*impl(?:\s+<[^>]+>)?\s+\w+/,
      /^\s*match\s+\w+\s*\{/,
      /\bVec::new\(\)/,
      /\bString::from\(/,
      /->\s*(?:i32|u32|i64|u64|String|bool|usize|isize|f32|f64)\b/,
      /\b(?:i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize)\b/,
      /&self\b|&mut\s+self\b/,
      /^\s*use\s+std::/,
      /\/\/\s*.*(?:\brust\b)/i,
    ],
    moderate: [
      /^\s*struct\s+\w+\s*\{/,
      /^\s*enum\s+\w+\s*\{/,
      /\bmut\s+\w+/,
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
      /^\s*import\s+(?:\(\s*)?"fmt"/,
      /^\s*func\s+main\s*\(\s*\)/,
      /^\s*func\s+(?:\([^)]+\)\s+)?\w+\s*\(/,
      /:=\s*/,
      /\bgo\s+\w+\s*\(/,
      /\bmake\s*\(\s*(chan|map|\[\])/,
      /\/\/\s*.*(?:\bgo\b|\bgolang\b)/i,
    ],
    moderate: [
      /^\s*type\s+\w+\s+struct\s*\{?/,
      /^\s*type\s+\w+\s+interface\s*\{?/,
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
      /\/\/\s*.*(?:\btypescript\b|\bts\b)/i,
    ],
    moderate: [],
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
      /^\s*class\s+\w+\s*\{/,
      /class\s+\w+\s+(?:extends|implements)\s+\w+/,
      /interface\s+\w+/,
      /@Override\b/,
      /import\s+java\./,
      /import\s+javax\./,
      /new\s+Scanner\s*\(/,
      /new\s+ArrayList/,
      /new\s+HashMap/,
      /\.println\s*\(/,
      /^\s*String\s+\w+\s*=/,
      /\bscanner\.\w+/,
      /^\s*(?:public|private|protected)\s+[A-Z]\w*(?:<[^>]+>)?\s+\w+\s*[;=]/,
      /^\s*(?:public|private|protected)\s+[A-Z]\w*\s*\([^)]*\)\s*\{/,
      /^\s*this\.\w+\s*=/,
      /\b(?:List<|Map<|Set<|ArrayList<|HashMap<)/,
      /\/\/\s*.*(?:\bjava\b)/i,
    ],
    moderate: [
      /^\s*(?:public|private|protected)\s+(?:static\s+)?(?:void|int|String|boolean|double|float|long)\s+\w+\s*\(/,
      /^\s*(?:public|private|protected)\s+class\s+/,
      /^\s*String\s+\w+/,
      /^\s*boolean\s+\w+/,
      /\.equals\s*\(/,
      /\.length\(\)/,
      /\.toString\s*\(/,
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
      /^\s*#include\s*<stdbool\.h>/,
      /^\s*(?:int|void|signed)\s+main\s*\(/,
      /\bmalloc\s*\(/,
      /\bcalloc\s*\(/,
      /\brealloc\s*\(/,
      /\bfree\s*\(/,
      /\bsizeof\s*\(/,
      /\bgets\s*\(/,
      /\bputs\s*\(/,
      /\w+->\w+/,
      /^\s*int\s+\w+\s*=\s*[^;]+;/,
      /^\s*char\s+(?:\*\s*\w+|\w+\s*\[\s*\]|\w+)\s*=/,
      /^\s*for\s*\(\s*int\s+\w+/,
      /\/\/\s*.*(?:\bC\b|clang)/i,
    ],
    moderate: [
      /^\s*#include\s*<[^i]/,
      /^\s*#define\s+/,
      /^\s*typedef\s+struct/,
      /^\s*struct\s+\w+/,
      /\*\s*\w+\s*=/,
      /(?:int|char|float|double|void)\s*\*\s*\w+/,
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
      /^\s*#include\s*<set>/,
      /^\s*#include\s*<queue>/,
      /^\s*#include\s*<stack>/,
      /^\s*using\s+namespace\s+std/,
      /\bstd::/,
      /\bendl\b/,
      /^\s*(?:public|private|protected)\s*:/,
      /^\s*class\s+\w+(?:\s*:\s*(?:public|private|protected)\s+\w+)?\s*\{?/,
      /\b(?:virtual|override|nullptr)\b/,
      /\b(?:new|delete)\s+\w+/,
      /\/\/\s*.*(?:c\+\+|cpp\b)/i,
    ],
    moderate: [
      /^\s*template\s*</,
      /^\s*namespace\s+/,
      /^\s*auto\s+\w+/,
      /\w+::\w+/,
      /\bvector\s*</,
      /\bmap\s*</,
      /\bstring\s+\w+/,
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
      /\/\/\s*.*(?:\bjavascript\b|\bjs\b)/i,
    ],
    moderate: [
      /===|!==/,
      /`[^`]*\$\{/,
    ],
    weak: [
      /;\s*$/,
    ]
  }
};

/**
 * Detect the programming language of a single line of code.
 * Returns { language, confidence } where confidence is 0–1.
 * Supports contextLang to prefer the active language in case of ties.
 */
function detectLanguage(line, contextLang = null) {
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

  // If there is a tie between the active context language and another language, preserve contextLang
  if (contextLang && scores[contextLang] === bestScore && bestScore >= 4) {
    bestLang = contextLang;
  }

  if (bestScore < 4) {
    return { language: 'unknown', confidence: 0 };
  }

  const confidence = Math.min(bestScore / 15, 1.0);
  return { language: bestLang, confidence };
}

module.exports = { detectLanguage, LANGUAGE_PATTERNS };
