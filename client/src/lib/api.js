const API = import.meta.env.VITE_API_URL || 'http://8.229.50.65';
export function getToken() { return localStorage.getItem('token'); }
export function setToken(token) { localStorage.setItem('token', token); }
export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}`, ...(options.headers || {}) },
    credentials: 'include'
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}
export { API };
