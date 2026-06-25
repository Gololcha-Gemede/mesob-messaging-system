export function authHeaders(token = sessionStorage.getItem('token')) {
  return { Authorization: `Bearer ${token}` };
}
