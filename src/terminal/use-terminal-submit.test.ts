import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useTerminalSubmit } from "./use-terminal-submit";
import type { UseTerminalSubmitOptions } from "./terminal-submit-types";
import type { PromptSuffixConfig } from "../types/prompt-suffix";
import { defaultProjectSettings } from "../settings/project-settings-storage";

const createMockOptions = (overrides: Partial<UseTerminalSubmitOptions> = {}): UseTerminalSubmitOptions => ({
  isTerminalReady: ref(true),
  errorMessage: ref(""),
  projectSettings: ref(defaultProjectSettings),
  promptSuffixConfig: ref<PromptSuffixConfig>({ items: [] }),
  applyPromptSuffixConfig: vi.fn(),
  terminalInputChunkSize: 4096,
  textareaSubmitActivityTimeoutCapMs: 5000,
  textareaSubmitQuietTimeoutCapMs: 5000,
  sendTerminalInputRequest: vi.fn().mockResolvedValue({ ok: true }),
  ...overrides
});

describe("useTerminalSubmit", () => {
  it("returns all expected methods", () => {
    const submit = useTerminalSubmit(createMockOptions());
    expect(typeof submit.sendTerminalInput).toBe("function");
    expect(typeof submit.attemptSubmitTerminalText).toBe("function");
    expect(typeof submit.sendAltVShortcut).toBe("function");
    expect(typeof submit.markTerminalDataReceived).toBe("function");
    expect(typeof submit.resetTerminalSessionState).toBe("function");
    expect(typeof submit.waitForTerminalQuiet).toBe("function");
    expect(typeof submit.waitForTerminalPattern).toBe("function");
  });
});

describe("sendTerminalInput", () => {
  it("sends data via IPC and returns true on success", async () => {
    const options = createMockOptions();
    const submit = useTerminalSubmit(options);
    const result = await submit.sendTerminalInput("hello", "fallback error");
    expect(options.sendTerminalInputRequest).toHaveBeenCalledWith("hello");
    expect(result).toBe(true);
  });

  it("sets errorMessage and returns false on IPC failure", async () => {
    const options = createMockOptions({
      sendTerminalInputRequest: vi.fn().mockResolvedValue({ ok: false, error: "oops" })
    });
    const submit = useTerminalSubmit(options);
    const result = await submit.sendTerminalInput("data", "fallback");
    expect(result).toBe(false);
    expect(options.errorMessage.value).toBe("oops");
  });

  it("uses fallback message when IPC error has no error text", async () => {
    const options = createMockOptions({
      sendTerminalInputRequest: vi.fn().mockResolvedValue({ ok: false })
    });
    const submit = useTerminalSubmit(options);
    await submit.sendTerminalInput("data", "fallback message");
    expect(options.errorMessage.value).toBe("fallback message");
  });

  it("handles thrown exceptions with fallback", async () => {
    const options = createMockOptions({
      sendTerminalInputRequest: vi.fn().mockRejectedValue(new Error("network fail"))
    });
    const submit = useTerminalSubmit(options);
    const result = await submit.sendTerminalInput("data", "fallback");
    expect(result).toBe(false);
    expect(options.errorMessage.value).toBe("network fail");
  });
});

describe("attemptSubmitTerminalText", () => {
  let options: UseTerminalSubmitOptions;

  beforeEach(() => {
    options = createMockOptions();
  });

  it("returns 'failed' when terminal is not ready", async () => {
    options.isTerminalReady.value = false;
    const submit = useTerminalSubmit(options);
    const result = await submit.attemptSubmitTerminalText("text", {
      notReady: "Terminal not ready",
      messages: { sendSlash: "s", sendText: "t", submit: "u" },
      inputType: "command"
    });
    expect(result).toBe("failed");
    expect(options.errorMessage.value).toBe("Terminal not ready");
  });

  it("returns 'empty' for whitespace-only text", async () => {
    const submit = useTerminalSubmit(options);
    const result = await submit.attemptSubmitTerminalText("   ", {
      notReady: "n",
      messages: { sendSlash: "s", sendText: "t", submit: "u" },
      inputType: "command"
    });
    expect(result).toBe("empty");
  });

  it("submits regular text as bracket-pasted input followed by Enter", async () => {
    const submit = useTerminalSubmit(options);
    const result = await submit.attemptSubmitTerminalText("echo hello", {
      notReady: "n",
      messages: { sendSlash: "s", sendText: "t", submit: "u" },
      inputType: "command"
    });
    expect(result).toBe("submitted");
    // Should have called sendTerminalInputRequest multiple times:
    // bracket paste start, text chunks, bracket paste end, enter
    expect(vi.mocked(options.sendTerminalInputRequest).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("appends prompt suffixes for prompt inputType", async () => {
    options.promptSuffixConfig.value = {
      items: [
        { label: "Suffix", value: "be concise", mode: "always" }
      ]
    };
    const submit = useTerminalSubmit(options);
    await submit.attemptSubmitTerminalText("review code", {
      notReady: "n",
      messages: { sendSlash: "s", sendText: "t", submit: "u" },
      inputType: "prompt"
    });
    // The text should include suffix — check that sendTerminalInputRequest was called
    // with text containing "be concise"
    const allCalls = vi.mocked(options.sendTerminalInputRequest).mock.calls;
    const allData = allCalls.map(([data]) => data).join("");
    expect(allData).toContain("be concise");
  });

  it("does not append prompt suffixes for slash commands", async () => {
    options.promptSuffixConfig.value = {
      items: [{ label: "S", value: "suffix text", mode: "always" }]
    };
    const submit = useTerminalSubmit(options);
    await submit.attemptSubmitTerminalText("/help", {
      notReady: "n",
      messages: { sendSlash: "s", sendText: "t", submit: "u" },
      inputType: "prompt"
    });
    const allCalls = vi.mocked(options.sendTerminalInputRequest).mock.calls;
    const allData = allCalls.map(([data]) => data).join("");
    expect(allData).not.toContain("suffix text");
  });

  it("resets 'once' mode suffixes to 'off' after use", async () => {
    options.promptSuffixConfig.value = {
      items: [{ label: "Once", value: "once val", mode: "once" }]
    };
    const submit = useTerminalSubmit(options);
    await submit.attemptSubmitTerminalText("text", {
      notReady: "n",
      messages: { sendSlash: "s", sendText: "t", submit: "u" },
      inputType: "prompt"
    });
    expect(options.applyPromptSuffixConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ mode: "off" })]
      })
    );
  });

  it("does not call applyPromptSuffixConfig when no 'once' items", async () => {
    options.promptSuffixConfig.value = {
      items: [{ label: "Always", value: "val", mode: "always" }]
    };
    const submit = useTerminalSubmit(options);
    await submit.attemptSubmitTerminalText("text", {
      notReady: "n",
      messages: { sendSlash: "s", sendText: "t", submit: "u" },
      inputType: "prompt"
    });
    expect(options.applyPromptSuffixConfig).not.toHaveBeenCalled();
  });
});

describe("sendAltVShortcut", () => {
  it("sends Alt+V escape sequence when terminal is ready", async () => {
    const options = createMockOptions();
    const submit = useTerminalSubmit(options);
    const result = await submit.sendAltVShortcut();
    expect(result).toBe(true);
    expect(options.sendTerminalInputRequest).toHaveBeenCalledWith("\u001bv");
  });

  it("returns false and sets error when terminal not ready", async () => {
    const options = createMockOptions();
    options.isTerminalReady.value = false;
    const submit = useTerminalSubmit(options);
    const result = await submit.sendAltVShortcut();
    expect(result).toBe(false);
    expect(options.errorMessage.value.length).toBeGreaterThan(0);
  });
});

describe("markTerminalDataReceived", () => {
  it("increments data version", () => {
    const options = createMockOptions();
    const submit = useTerminalSubmit(options);

    // We can observe the version through the quiet wait behavior
    // markTerminalDataReceived should not throw
    submit.markTerminalDataReceived("some data");
    submit.markTerminalDataReceived("more data");
  });
});

describe("resetTerminalSessionState", () => {
  it("resets without errors", () => {
    const options = createMockOptions();
    const submit = useTerminalSubmit(options);
    submit.markTerminalDataReceived("data");
    submit.resetTerminalSessionState();
  });
});
