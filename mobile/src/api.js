// API base: set VITE_API_BASE at build/dev time to point at the backend.
// Empty => same origin (when the PWA is served behind the same host as the API).
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
export const API = BASE + "/api";

async function req(path, options) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (res.status === 204) return null;
  let body = null;
  try { body = await res.json(); } catch { /* none */ }
  if (!res.ok) {
    throw new Error((body && (body.details ? body.details.join("; ") : body.error)) || ("HTTP " + res.status));
  }
  return body;
}

export const getPermits = () => req("/permits");
export const getTras = () => req("/tras");
export const getMeta = () => req("/meta");
