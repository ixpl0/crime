export const isFailFastMode = import.meta.env.DEV;

export const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
};

export const toContextualErrorMessage = (
  context: string,
  error: unknown,
  fallback: string
): string => `${context}: ${toErrorMessage(error, fallback)}`;
