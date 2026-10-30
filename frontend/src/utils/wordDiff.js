/**
 * Lightweight client-side word-level diff utility matching contract_v2:
 * {
 *   ops: [{ op: "equal" | "insert" | "delete", text }],
 *   stats: { added_words, removed_words, unchanged_words }
 * }
 */
export function computeWordDiff(oldText = '', newText = '') {
  // Tokenize preserving whitespace and words
  const tokenize = (str) => str.match(/\S+|\s+/g) || [];

  const a = tokenize(oldText);
  const b = tokenize(newText);

  const n = a.length;
  const m = b.length;

  // Build simple LCS matrix
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (a[i] === b[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to extract ops
  let i = n;
  let j = m;
  const rawOps = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      rawOps.push({ op: 'equal', text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawOps.push({ op: 'insert', text: b[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawOps.push({ op: 'delete', text: a[i - 1] });
      i--;
    }
  }

  rawOps.reverse();

  // Merge contiguous ops of the same type for cleaner rendering
  const mergedOps = [];
  for (const item of rawOps) {
    if (mergedOps.length > 0 && mergedOps[mergedOps.length - 1].op === item.op) {
      mergedOps[mergedOps.length - 1].text += item.text;
    } else {
      mergedOps.push({ op: item.op, text: item.text });
    }
  }

  // Calculate word stats
  let addedWords = 0;
  let removedWords = 0;
  let unchangedWords = 0;

  for (const item of mergedOps) {
    const wordCount = (item.text.match(/\S+/g) || []).length;
    if (item.op === 'insert') addedWords += wordCount;
    else if (item.op === 'delete') removedWords += wordCount;
    else unchangedWords += wordCount;
  }

  return {
    ops: mergedOps,
    stats: {
      added_words: addedWords,
      removed_words: removedWords,
      unchanged_words: unchangedWords,
    },
  };
}
