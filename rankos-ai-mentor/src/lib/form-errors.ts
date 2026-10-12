/**
 * Bridge server-side field errors (`ApiError.fields`) into react-hook-form.
 */
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Apply `{ field: message }` validation errors returned by the API onto a form.
 * Returns `true` if at least one field error was applied, so callers can decide
 * whether to also show a generic toast.
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fields: Record<string, string> | undefined,
): boolean {
  if (!fields) return false;
  let applied = false;
  for (const [name, message] of Object.entries(fields)) {
    setError(name as Path<T>, { type: "server", message });
    applied = true;
  }
  return applied;
}
