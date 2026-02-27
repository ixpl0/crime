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

export function createCommandRunner(ideNodeModulesBinPath) {
  return function runCommand(command, args, cwd) {
    return new Promise((resolvePromise, rejectPromise) => {
      const env = buildChildProcessEnv(cwd, ideNodeModulesBinPath);
      const child = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });

      const stdoutChunks = [];
      const stderrChunks = [];
      attachStdoutCollector(child, stdoutChunks);
      attachStderrCollector(child, stderrChunks);

      child.on("error", (error) => {
        rejectPromise(error);
      });

      child.on("close", (code) => {
        resolvePromise({
          code: typeof code === "number" ? code : -1,
          stdout: Buffer.concat(stdoutChunks),
          stderr: Buffer.concat(stderrChunks)
        });
      });
    });
  };
}
