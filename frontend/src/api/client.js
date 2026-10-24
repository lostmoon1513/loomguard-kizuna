
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL?.trim();

if (!baseURL) {
  console.error(
    'VITE_API_URL is missing. Add it to frontend/.env and restart Vite.',
  );
}

export const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const role = localStorage.getItem('loomguard-role') || 'creator';

  const user =
    localStorage.getItem('loomguard-user') ||
    (role === 'manager' ? 'manager' : 'creator');

  config.headers['X-Role'] = role;
  config.headers['X-User'] = user;

  return config;
});

export function getErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}
