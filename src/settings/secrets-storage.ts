import { toContextualErrorMessage } from "../utils/fail-fast";

export const SECRETS_FILENAME = ".env";

export const defaultSecretsContent = "GLM_API_KEY=";

export const loadSecrets = async (projectPath: string): Promise<string> => {
  try {
    const response = await window.projectApi.settings.read(projectPath, SECRETS_FILENAME);
    if (!response.ok) {
      // If file doesn't exist, we might get an error or empty content depending on implementation.
      // Usually, if it's a new project, we want to return the default.
      return defaultSecretsContent;
    }
    return response.content ?? defaultSecretsContent;
  } catch (error) {
    console.error(toContextualErrorMessage("Failed to load secrets", error, "Unable to read .env file."));
    return defaultSecretsContent;
  }
};

export const saveSecrets = async (projectPath: string, content: string): Promise<void> => {
  try {
    const response = await window.projectApi.settings.write(projectPath, SECRETS_FILENAME, content);
    if (!response.ok) {
      throw new Error(String(response.error));
    }
  } catch (error) {
    const message = toContextualErrorMessage("Failed to save secrets", error, "Failed to save .env file.");
    console.error(message);
    throw new Error(message);
  }
};
