export function toErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallbackMessage;
}

export function toIpcErrorResponse(error, fallbackMessage) {
  const message = toErrorMessage(error, fallbackMessage);
  return { ok: false, error: message };
}
