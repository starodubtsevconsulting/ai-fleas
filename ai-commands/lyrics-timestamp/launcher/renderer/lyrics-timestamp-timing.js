(function attachTiming(root) {
  function secondsToMs(seconds) {
    return Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  }

  function applyTimingEdit(lines, lineIndex, field, seconds) {
    const line = lines[lineIndex];
    if (!line) return [];
    const changed = new Set([lineIndex]);
    const nextMs = secondsToMs(seconds);

    if (field === 'startMs') {
      line.startMs = Math.min(nextMs, Math.max(0, line.endMs - 1));
      const previousLine = lines[lineIndex - 1];
      if (previousLine && previousLine.endMs > line.startMs) {
        previousLine.endMs = Math.max(previousLine.startMs + 1, line.startMs);
        if (previousLine.endMs > line.startMs) {
          line.startMs = previousLine.endMs;
        }
        changed.add(lineIndex - 1);
      }
    } else if (field === 'endMs') {
      line.endMs = Math.max(nextMs, line.startMs + 1);
      const nextLine = lines[lineIndex + 1];
      if (nextLine && nextLine.startMs < line.endMs) {
        nextLine.startMs = Math.min(line.endMs, Math.max(0, nextLine.endMs - 1));
        if (nextLine.startMs < line.endMs) {
          line.endMs = nextLine.startMs;
        }
        changed.add(lineIndex + 1);
      }
    }

    return [...changed].sort((left, right) => left - right);
  }

  const api = { applyTimingEdit, secondsToMs };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LyricsTimestampTiming = api;
})(typeof window !== 'undefined' ? window : globalThis);
