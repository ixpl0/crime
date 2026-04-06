import { describe, it, expect } from "vitest";
import { getGitUnavailableMessage } from "./context-menu-utils";

describe("getGitUnavailableMessage", () => {
  it("returns git-not-installed message for that reason", () => {
    const message = getGitUnavailableMessage("git-not-installed");
    expect(message.length).toBeGreaterThan(0);
    expect(message.toLowerCase()).toContain("git");
  });

  it("returns not-a-repo message for not-git-repository reason", () => {
    const message = getGitUnavailableMessage("not-a-repository");
    expect(message.length).toBeGreaterThan(0);
  });

  it("returns not-a-repo message when reason is undefined", () => {
    const message = getGitUnavailableMessage(undefined);
    expect(message.length).toBeGreaterThan(0);
  });

  it("returns different messages for different reasons", () => {
    const notInstalled = getGitUnavailableMessage("git-not-installed");
    const notRepo = getGitUnavailableMessage("not-a-repository");
    expect(notInstalled).not.toBe(notRepo);
  });
});
