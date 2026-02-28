function normalizePathForComparison(path: string) {
  const normalizedPath = path.replace(/[\\/]+/g, "/");
  if (normalizedPath === "/") {
    return normalizedPath;
  }

  const withoutTrailingSlash = normalizedPath.replace(/\/+$/, "");
  const stablePath = withoutTrailingSlash.length > 0 ? withoutTrailingSlash : normalizedPath;
  return /^[A-Za-z]:\//.test(stablePath) ? stablePath.toLowerCase() : stablePath;
}

export function isPathInsideBase(basePath: string, targetPath: string) {
  const normalizedBasePath = normalizePathForComparison(basePath);
  const normalizedTargetPath = normalizePathForComparison(targetPath);

  if (normalizedTargetPath === normalizedBasePath) {
    return true;
  }

  if (normalizedBasePath === "/") {
    return normalizedTargetPath.startsWith("/");
  }

  return normalizedTargetPath.startsWith(`${normalizedBasePath}/`);
}

export function isSamePath(leftPath: string, rightPath: string) {
  return normalizePathForComparison(leftPath) === normalizePathForComparison(rightPath);
}
