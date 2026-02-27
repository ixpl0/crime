import { isAbsolute, normalize, relative, resolve } from "node:path";

function toNormalizedAbsolutePath(path) {
  return normalize(resolve(path));
}

export function isPathInsideBase(base, target) {
  const normalizedBase = toNormalizedAbsolutePath(base);
  const normalizedTarget = toNormalizedAbsolutePath(target);
  const relativePath = relative(normalizedBase, normalizedTarget);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export function toRelativePathInsideBase(basePath, targetPath, options = {}) {
  const { allowCurrentDirectory = false } = options;
  const relativePath = relative(basePath, targetPath).split("\\").join("/");
  if (relativePath.length === 0 || relativePath === ".." || relativePath.startsWith("../")) {
    return null;
  }

  if (!allowCurrentDirectory && relativePath === ".") {
    return null;
  }

  return relativePath;
}
