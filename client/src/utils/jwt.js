/** Decode role from JWT payload (client-side; not verified). */
export function roleFromToken(token) {
  if (!token) return '';
  try {
    const b64 = token.split('.')[1];
    if (!b64) return '';
    const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return payload?.role || '';
  } catch {
    return '';
  }
}

export const ADMIN_REGISTER_SESSION_KEY = 'imms_from_admin_register';
