/**
 * LoomIQ API Service Client.
 * Handles HTTP requests to the backend with standard error extraction.
 */

// Read backend URL from environment variables, defaulting to localhost:5000 in dev
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Fetches current health status from the backend.
 * Returns parsed payload and handles HTTP 200, HTTP 503, and network errors.
 */
export const checkHealth = async () => {
  const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/api/health`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // 503 degraded state or other HTTP error responses with JSON body
      return {
        ok: false,
        status: response.status,
        data: data || {
          status: 'degraded',
          service: 'loomiq-backend',
          database: { status: 'disconnected' },
        },
        error: data?.error?.message || `HTTP ${response.status} ${response.statusText}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err.message || 'Unable to connect to backend service (Network error or CORS issue)',
    };
  }
};

export default {
  checkHealth,
};
