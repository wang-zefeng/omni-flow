export function withAdminToken(headers: Record<string, string> = {}) {
  return {
    ...headers,
    "X-Requested-With": "OmniFlow",
  };
}
