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

export function createCommandRunner(ideNodeModulesBinPath) {
  return function runCommand(command, args, cwd, options) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;

    return new Promise((resolvePromise, rejectPromise) => {
      const env = buildChildProcessEnv(cwd, ideNodeModulesBinPath);
      const child = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill();
          rejectPromise(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`));
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
  };
}
