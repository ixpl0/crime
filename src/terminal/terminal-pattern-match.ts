const ANSI_ESCAPE_REGEX = /\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07]*\x07|[^[\]])/g;
const PATTERN_MATCH_BUFFER_LIMIT = 4096;

const stripAnsiEscapes = (text: string) => text.replace(ANSI_ESCAPE_REGEX, "");

export const waitForTerminalPattern = (
  listeners: Set<(data: string) => void>,
  pattern: string,
  timeoutMs: number
): Promise<boolean> => new Promise((resolve) => {
  let buffer = "";

  const cleanup = () => {
    clearTimeout(timeoutId);
    listeners.delete(listener);
  };

  const listener = (data: string) => {
    buffer += data;
    if (buffer.length > PATTERN_MATCH_BUFFER_LIMIT) {
      buffer = buffer.slice(-PATTERN_MATCH_BUFFER_LIMIT);
    }
    if (stripAnsiEscapes(buffer).includes(pattern)) {
      cleanup();
      resolve(true);
    }
  };

  const timeoutId = setTimeout(() => {
    cleanup();
    resolve(false);
  }, timeoutMs);

  listeners.add(listener);
});
