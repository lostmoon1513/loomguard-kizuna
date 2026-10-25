import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL?.trim();

if (!baseURL) {
  console.warn(
    'VITE_API_URL is missing. Add it to frontend/.env or Vercel environment variables.',
  );
}

export const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 120000, // 120 seconds to allow Render free tier cold-start (45-55s)
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

// Automatic retry for GET requests when backend is spinning up on Render free tier
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || config.method?.toLowerCase() !== 'get') {
      return Promise.reject(error);
    }
    config.__retryCount = config.__retryCount || 0;
    const isColdStart =
      error.code === 'ECONNABORTED' ||
      !error.response ||
      [502, 503, 504].includes(error.response?.status);

    if (isColdStart && config.__retryCount < 2) {
      config.__retryCount += 1;
      // Wait 3 seconds before retrying
      await new Promise((res) => setTimeout(res, 3000));
      return api(config);
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error) {
  if (
    error?.code === 'ECONNABORTED' ||
    error?.message?.toLowerCase().includes('timeout')
  ) {
    return 'The backend server is waking up from Render free-tier cold sleep (takes ~45-50s on initial cold start). Please wait a moment and try again.';
  }
  if (!error?.response && error?.message?.toLowerCase().includes('network')) {
    return 'Cannot connect to backend server. It may be spinning up from sleep on Render. Please wait a few seconds and refresh.';
  }
  if ([502, 503, 504].includes(error?.response?.status)) {
    return 'The backend server is currently starting up (Render free tier). Please wait a moment and try again.';
  }
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}
