import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export function authHeaders(token = sessionStorage.getItem('token')) {
  return { Authorization: `Bearer ${token}` };
}
