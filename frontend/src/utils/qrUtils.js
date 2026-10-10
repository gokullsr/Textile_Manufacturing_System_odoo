/**
 * Utility module for generating Fabric Passport URLs for QR codes.
 * Supports Online Public HTTPS tunnels, LAN network addresses, and custom domains.
 */

// Fallback Online Tunnel and LAN IP
export const DEFAULT_ONLINE_URL = 'https://approximate-nor-detailed-costa.trycloudflare.com';
export const DEFAULT_LAN_IP = '172.17.51.121';

/**
 * Builds the canonical public URL for a given fabric roll QR passport.
 * @param {string} rollId - The unique roll identifier (e.g. 'FR-2026-000001')
 * @param {string} [customBaseUrl] - Optional base URL override
 * @returns {string} Fully qualified URL string
 */
export const buildRollUrl = (rollId, customBaseUrl) => {
  if (!rollId || typeof rollId !== 'string') {
    return '';
  }

  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_APP_URL;
  const origin = typeof window !== 'undefined' ? window.location?.origin : '';

  let base = (customBaseUrl || envUrl || DEFAULT_ONLINE_URL || origin).trim();
  
  // If base is empty or loopback and we want cross-device scannability online
  if (!base || base.includes('localhost') || base.includes('127.0.0.1')) {
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      base = envUrl;
    } else {
      base = DEFAULT_ONLINE_URL;
    }
  }

  const cleanBase = base.replace(/\/+$/, '');
  const normalizedRollId = rollId.trim().toUpperCase();
  return `${cleanBase}/rolls/${encodeURIComponent(normalizedRollId)}`;
};

/**
 * Checks if the current URL origin is a local loopback address (useful for dev QR warning)
 */
export const isLocalhostOrigin = (urlStr) => {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
};
