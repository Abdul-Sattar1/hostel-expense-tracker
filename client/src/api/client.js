export class ApiError extends Error {
  constructor(status, message, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

// Same-origin '/api' by default (Vite proxies it in dev; Express serves it in production).
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api';

export const apiUrl = (path) => BASE + path;

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function send(path, init) {
  let res;
  try {
    res = await fetch(BASE + path, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/auth/login') onUnauthorized();
    throw new ApiError(res.status, data.message ?? 'Something went wrong. Please try again.', data.errors);
  }
  return res;
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await send(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body && JSON.stringify(body) });
  return res.json().catch(() => ({}));
}

// Sends a File as the raw request body (the server detects the image type from the bytes).
export async function upload(path, file) {
  const res = await send(path, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  return res.json().catch(() => ({}));
}

// Fetches a file from an authenticated endpoint and saves it through the browser.
export async function download(path, fallbackName) {
  const res = await send(path);
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
