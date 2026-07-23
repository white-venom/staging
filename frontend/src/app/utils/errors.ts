// Single place every API-error / unexpected-error message gets turned into
// something a user can actually read. FastAPI's error body shape varies by
// failure type -- a plain HTTPException gives `detail` as a string, but a
// Pydantic validation (422) error gives `detail` as an array of
// {msg, loc, type} objects. Passing that array straight into `Error()` or
// `alert()` used to render literally as "[object Object]" wherever it wasn't
// specifically unwrapped -- this is the one place that unwrapping happens now.
export function extractErrorMessage(errorData: unknown): string {
  if (errorData == null) return "";
  const detail = (errorData as any)?.detail ?? errorData;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((e: any) => {
        if (typeof e === "string") return e;
        const field = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : null;
        const msg = e?.msg || e?.message;
        if (field && msg) return `${field}: ${msg}`;
        return msg || null;
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }

  if (detail && typeof detail === "object") {
    // Last resort for a shape we don't specifically recognize -- still better
    // than "[object Object]", and rare enough (custom error payloads) that a
    // readable JSON dump is an acceptable fallback rather than a dead end.
    try {
      return JSON.stringify(detail);
    } catch {
      return "An unexpected error occurred.";
    }
  }

  return "";
}

// Turns ANY thrown value (Error, string, API error body, or something a
// caller `throw`ed raw) into one clean, user-facing sentence. Use this at
// every catch site instead of reaching for `err.message` directly -- some
// values thrown across this codebase are not Error instances (e.g. a raw
// parsed JSON body from an older call site, or a string), and `err.message`
// on those is either undefined or wrong.
export function toUserMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err == null) return fallback;

  if (err instanceof Error) {
    const msg = err.message?.trim();
    return msg && msg !== "[object Object]" ? msg : fallback;
  }

  if (typeof err === "string") {
    return err.trim() || fallback;
  }

  const extracted = extractErrorMessage(err);
  return extracted || fallback;
}
