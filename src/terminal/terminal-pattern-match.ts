const ANSI_ESCAPE_REGEX = /\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07]*\x07|[^[\]])/g;
const PATTERN_MATCH_BUFFER_LIMIT = 4096;

const stripAnsiEscapes = (text: string) => text.replace(ANSI_ESCAPE_REGEX, "");

const createPatternMatcher = (
  pattern: string,
  finish: (matched: boolean) => void
) => {
  let buffer = "";
  return (data: string) => {
    buffer += data;
    if (buffer.length > PATTERN_MATCH_BUFFER_LIMIT) {
      buffer = buffer.slice(-PATTERN_MATCH_BUFFER_LIMIT);
    }
    if (stripAnsiEscapes(buffer).includes(pattern)) {
      finish(true);
    }
  };
};

export const waitForTerminalPattern = (
  listeners: Set<(data: string) => void>,
  cancellers: Set<() => void>,
  pattern: string,
  timeoutMs: number
): Promise<boolean> => new Promise((resolve) => {
  let isFinished = false;
  const finish = (matched: boolean) => {
    if (isFinished) {
      return;
    }

    isFinished = true;
    clearTimeout(timeoutId);
    listeners.delete(listener);
    cancellers.delete(cancel);
    resolve(matched);
  };

  const listener = createPatternMatcher(pattern, finish);
  const cancel = () => { finish(false); };
  const timeoutId = setTimeout(() => { finish(false); }, timeoutMs);

  listeners.add(listener);
  cancellers.add(cancel);
});
