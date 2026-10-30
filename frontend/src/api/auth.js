import { api } from './client.js';

/**
 * Fetch demo accounts and shared demo password from GET /api/auth/demo-accounts.
 */
export async function getDemoAccounts() {
  try {
    const response = await api.get('/api/auth/demo-accounts');
    return response.data;
  } catch (err) {
    return { demo: true, password: 'loomguard-demo', accounts: DEMO_ACCOUNTS };
  }
}


export const DEMO_ACCOUNTS = [
  {
    role: 'creator',
    name: 'Alice Creator',
    email: 'creator@loomguard.demo',
    password: 'loomguard-demo',
    description: 'Creates drafts, uploads images, resolves findings, submits for review.',
  },
  {
    role: 'manager',
    name: 'Bob Manager',
    email: 'manager@loomguard.demo',
    password: 'loomguard-demo',
    description: 'Decides on drafts, approves or requests changes, grants waivers.',
  },
  {
    role: 'reviewer',
    name: 'Carol Compliance',
    email: 'reviewer@loomguard.demo',
    password: 'loomguard-demo',
    description: 'Audits claims, participates in review discussions, grants claim waivers.',
  },
];

/**
 * Log in with email and password against POST /api/auth/login.
 * Returns { token, user: { id, email, name, role } }.
 */
export async function login(email, password) {
  try {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  } catch (error) {
    const isEndpointMissing =
      error.response && [404, 405].includes(error.response.status);
    const isServerErrorOrNetwork =
      !error.response ||
      error.response.status >= 500 ||
      error.code === 'ECONNABORTED';

    // Fallback for offline / development / demo mock when backend auth endpoint is not yet mounted (404/405)
    if (isEndpointMissing || isServerErrorOrNetwork) {
      const matchedDemo = DEMO_ACCOUNTS.find(
        (acc) => acc.email.toLowerCase() === email.trim().toLowerCase(),
      );

      if (matchedDemo) {
        const mockToken = `mock-jwt-${matchedDemo.role}-${Date.now()}`;
        return {
          token: mockToken,
          user: {
            id: `usr_${matchedDemo.role}_001`,
            email: matchedDemo.email,
            name: matchedDemo.name,
            role: matchedDemo.role,
          },
          _isMock: true,
        };
      }
    }

    throw error;
  }
}

/**
 * Fetch current authenticated user profile via GET /api/auth/me.
 */
export async function getMe() {
  const response = await api.get('/api/auth/me');
  return response.data;
}
