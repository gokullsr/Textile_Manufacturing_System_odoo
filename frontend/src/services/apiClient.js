/**
 * Base HTTP Client for LoomIQ API.
 * Dynamically resolves API URL matching host environment for cross-device & mobile QR access.
 */
const getBaseUrl = () => {
  // If explicitly configured with an absolute custom URL, respect it
  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }

  // When running in the browser (on online public tunnel, LAN, or local dev)
  // Relative requests routed via Vite proxy or reverse proxy ensure zero CORS / port issues
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }

  // Fallback for node scripts / testing
  return 'http://127.0.0.1:5000';
};

export const request = async (endpoint, options = {}) => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      const errorCode = data?.error?.code || 'REQUEST_FAILED';
      const error = new Error(errorMessage);
      error.code = errorCode;
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (!err.status) {
      // Network failure / connection refused / CORS blocked
      const networkError = new Error(err.message || 'Unable to connect to backend service. Please check server status.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw err;
  }
};

export default { request };
