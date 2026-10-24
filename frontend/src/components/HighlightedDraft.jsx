
export default function HighlightedDraft({
  text = '',
  issues = [],
}) {
  // Separate valid issues from ones with out-of-bounds offsets.
  const [matches, skipped] = issues.reduce(
    ([ok, skip], issue) => {
      const valid =
        Number.isInteger(issue.start) &&
        Number.isInteger(issue.end) &&
        issue.start >= 0 &&
        issue.end > issue.start &&
        issue.end <= text.length;
      return valid ? [[...ok, issue], skip] : [ok, [...skip, issue]];
    },
    [[], []],
  );

  // Sort by position (longest match wins on tie so it is never skipped by a subset).
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  // Collect issue IDs that are overlapped and therefore not highlighted.
  const skippedIds = new Set(skipped.map((i) => i.id));
  let cur2 = 0;
  for (const issue of matches) {
    if (issue.start < cur2) {
      skippedIds.add(issue.id);
    } else {
      cur2 = issue.end;
    }
  }
  const highlightable = matches.filter((i) => !skippedIds.has(i.id));

  const segments = [];
  let cursor = 0;

  for (const issue of highlightable) {

    if (issue.start > cursor) {
      segments.push({
        text: text.slice(cursor, issue.start),
        key: `plain-${cursor}`,
      });
    }

    segments.push({
      text: text.slice(issue.start, issue.end),
      issue,
      key: issue.id,
    });

    cursor = issue.end;
  }

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      key: `plain-${cursor}`,
    });
  }

  return (
    <>
      <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
        {segments.map((segment) =>
          segment.issue ? (
            <mark
              key={segment.key}
              className="issue-mark"
              title={`${segment.issue.category}: ${segment.issue.reason}`}
            >
              {segment.text}
            </mark>
          ) : (
            <span key={segment.key}>{segment.text}</span>
          ),
        )}
      </div>
      {skippedIds.size > 0 && (
        <p className="mt-2 text-xs text-slate-400 italic">
          {skippedIds.size} finding{skippedIds.size === 1 ? '' : 's'} not highlighted (overlapping spans — see the issue cards).
        </p>
      )}
    </>
  );
}
