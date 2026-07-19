import { clearSession, getToken } from "@/lib/auth/session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

// An expired/invalid token means every request will keep failing —
// clear the session and return to login. Auth endpoints are exempt so
// a wrong password shows an error instead of a redirect loop.
function handleUnauthorized(path: string): void {
  if (typeof window === "undefined" || path.startsWith("/auth/")) return;
  clearSession();
  window.location.href = "/login";
}

export function getFileUrl(relativePath: string): string {
  return `${API_ORIGIN}/${relativePath}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface PydanticValidationError {
  loc: (string | number)[];
  msg: string;
}

// FastAPI returns `detail` as a plain string for our own HTTPExceptions,
// but as an array of {loc, msg} for Pydantic request-validation failures
// (422s) — collapse either shape into one readable line.
function parseErrorDetail(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null || !("detail" in body)) return fallback;
  const detail = (body as { detail: unknown }).detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((err: PydanticValidationError) => {
        const field = err.loc?.filter((part) => part !== "body").join(".") ?? "";
        return field ? `${field}: ${err.msg}` : err.msg;
      })
      .join("; ");
  }

  return fallback;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query } = options;

  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();
  const response = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized(path);
    const body = await response.json().catch(() => ({}));
    const fallback = `Request failed with ${response.status}`;
    throw new ApiError(response.status, parseErrorDetail(body, fallback));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized(path);
    const body = await response.json().catch(() => ({}));
    const fallback = `Request failed with ${response.status}`;
    throw new ApiError(response.status, parseErrorDetail(body, fallback));
  }

  return (await response.json()) as T;
}
