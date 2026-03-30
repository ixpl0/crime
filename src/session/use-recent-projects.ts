import { ref } from "vue";
import { normalizePathForComparison } from "../utils/path-utils";

const RECENT_PROJECTS_LIMIT = 10;

interface ReadDirectoryResponse {
  ok: boolean;
}

type ReadDirectoryFn = (path: string) => Promise<ReadDirectoryResponse>;

function parseRecentProjects(rawValue: string | null) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch (error) {
    console.error("Failed to parse recent projects from storage", error);
    return [];
  }
}

function getProjectNameFromPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((part) => part.length > 0);
  return parts[parts.length - 1] || path;
}

function createRecentProjectsOperations(
  storageKey: string,
  recentProjects: { value: string[] },
  readDirectory: ReadDirectoryFn
) {
  const { getRecentProjectsFromStorage, setRecentProjectsInStorage, loadRecentProjectsFromStorage } =
    createRecentProjectsStorage(storageKey, recentProjects);
  return {
    loadRecentProjectsFromStorage,
    addRecentProject: createAddRecentProject(recentProjects, getRecentProjectsFromStorage, setRecentProjectsInStorage),
    removeRecentProject: createRemoveRecentProject(recentProjects, getRecentProjectsFromStorage, setRecentProjectsInStorage),
    validateRecentProjects: createRecentProjectsValidator(recentProjects, getRecentProjectsFromStorage, setRecentProjectsInStorage, readDirectory)
  };
}

export function useRecentProjects(storageKey: string, readDirectory: ReadDirectoryFn) {
  const initialProjects = parseRecentProjects(window.localStorage.getItem(storageKey));
  const recentProjects = ref<string[]>(initialProjects);
  const operations = createRecentProjectsOperations(storageKey, recentProjects, readDirectory);

  return {
    recentProjects,
    getProjectNameFromPath,
    ...operations
  };
}

function createRecentProjectsStorage(storageKey: string, recentProjects: { value: string[] }) {
  function getRecentProjectsFromStorage() {
    const storedValue = window.localStorage.getItem(storageKey);
    return parseRecentProjects(storedValue);
  }

  function setRecentProjectsInStorage(paths: string[]) {
    window.localStorage.setItem(storageKey, JSON.stringify(paths));
  }

  function loadRecentProjectsFromStorage() {
    recentProjects.value = getRecentProjectsFromStorage();
  }

  return {
    getRecentProjectsFromStorage,
    setRecentProjectsInStorage,
    loadRecentProjectsFromStorage
  };
}

function createAddRecentProject(
  recentProjects: { value: string[] },
  getRecentProjectsFromStorage: () => string[],
  setRecentProjectsInStorage: (paths: string[]) => void
) {
  return function addRecentProject(path: string) {
    const existingPaths = getRecentProjectsFromStorage();
    const filteredPaths = existingPaths.filter((currentPath) =>
      normalizePathForComparison(currentPath) !== normalizePathForComparison(path)
    );
    const updatedPaths = [path, ...filteredPaths].slice(0, RECENT_PROJECTS_LIMIT);
    recentProjects.value = updatedPaths;
    setRecentProjectsInStorage(updatedPaths);
  };
}

function createRemoveRecentProject(
  recentProjects: { value: string[] },
  getRecentProjectsFromStorage: () => string[],
  setRecentProjectsInStorage: (paths: string[]) => void
) {
  return function removeRecentProject(path: string) {
    const existingPaths = getRecentProjectsFromStorage();
    const filteredPaths = existingPaths.filter((currentPath) =>
      normalizePathForComparison(currentPath) !== normalizePathForComparison(path)
    );
    if (filteredPaths.length !== existingPaths.length) {
      recentProjects.value = filteredPaths;
      setRecentProjectsInStorage(filteredPaths);
    }
  };
}

function createRecentProjectsValidator(
  recentProjects: { value: string[] },
  getRecentProjectsFromStorage: () => string[],
  setRecentProjectsInStorage: (paths: string[]) => void,
  readDirectory: ReadDirectoryFn
) {
  return async function validateRecentProjects() {
    const storedPaths = getRecentProjectsFromStorage();
    const validPaths: string[] = [];

    for (const path of storedPaths) {
      try {
        const response = await readDirectory(path);
        if (response.ok) {
          validPaths.push(path);
        }
      } catch (error) {
        console.warn(`Failed to validate project path: ${path}`, error);
      }
    }

    if (validPaths.length !== storedPaths.length) {
      recentProjects.value = validPaths;
      setRecentProjectsInStorage(validPaths);
    }
  };
}
