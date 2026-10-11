/**
 * Redirect Sanitizer Utility.
 * Validates and sanitizes internal redirect URLs to prevent open redirect vulnerabilities.
 * @param {string} url
 * @returns {string} Safe relative path or default '/'
 */
export const sanitizeRedirectPath = (url) => {
  if (!url || typeof url !== 'string') return '/';
  const trimmed = url.trim();

  // Must begin with a single '/' and not '//' or '/\' or containing protocol '://'
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes('://') &&
    !trimmed.toLowerCase().startsWith('javascript:')
  ) {
    return trimmed;
  }

  return '/';
};

// CommonJS compatibility for test runners
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sanitizeRedirectPath };
}

export default sanitizeRedirectPath;
