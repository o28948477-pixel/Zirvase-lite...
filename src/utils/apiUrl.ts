const PROXY_BASE_STORAGE_KEY = "jarvis_proxy_base_url";

export function getProxyBaseUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(PROXY_BASE_STORAGE_KEY) || "";
    return raw.trim().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function setProxyBaseUrl(url: string): string {
  const clean = url.trim().replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    try {
      if (clean) {
        window.localStorage.setItem(PROXY_BASE_STORAGE_KEY, clean);
      } else {
        window.localStorage.removeItem(PROXY_BASE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures
    }
  }
  return clean;
}

export function resolveApiUrl(apiPath: string): string {
  const base = getProxyBaseUrl();
  if (!base) return apiPath;
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${base}${normalizedPath}`;
}
