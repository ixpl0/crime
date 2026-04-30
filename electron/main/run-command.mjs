import { spawn } from "node:child_process";
import { buildChildProcessEnv } from "./child-process-env.mjs";

function toBufferChunk(chunk) {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}

function attachStdoutCollector(child, chunks) {
  child.stdout.on("data", (chunk) => {
    chunks.push(toBufferChunk(chunk));
  });
}

function attachStderrCollector(child, chunks) {
  child.stderr.on("data", (chunk) => {
    chunks.push(toBufferChunk(chunk));
  });
}

const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;
const DEFAULT_SHELL_COMMAND_TIMEOUT_MS = 60_000;

function collectChildProcessResult(child, description, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        rejectPromise(new Error(`Command timed out after ${timeoutMs}ms: ${description}`));
      }
    }, timeoutMs);

    const stdoutChunks = [];
    const stderrChunks = [];
    attachStdoutCollector(child, stdoutChunks);
    attachStderrCollector(child, stderrChunks);

    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        rejectPromise(error);
      }
    });

    child.on("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolvePromise({
          code: typeof code === "number" ? code : -1,
          stdout: Buffer.concat(stdoutChunks),
          stderr: Buffer.concat(stderrChunks)
        });
      }
    });
  });
}

export function createCommandRunner(ideNodeModulesBinPath) {
  return function runCommand(command, args, cwd, options) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const env = {
      ...buildChildProcessEnv(cwd, ideNodeModulesBinPath),
      ...(options?.env ?? {})
    };
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    return collectChildProcessResult(child, `${command} ${args.join(" ")}`, timeoutMs);
  };
}

export function createShellCommandRunner(ideNodeModulesBinPath) {
  return function runShellCommand(commandLine, cwd, options) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_SHELL_COMMAND_TIMEOUT_MS;
    const env = {
      ...buildChildProcessEnv(cwd, ideNodeModulesBinPath),
      ...(options?.env ?? {})
    };
    const child = spawn(commandLine, {
      cwd,
      env,
      windowsHide: true,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    return collectChildProcessResult(child, commandLine, timeoutMs);
  };
}
