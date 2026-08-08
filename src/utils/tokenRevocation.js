// In-memory revoked refresh token store.
// Choice rationale: For a single-instance REST API server, an in-memory Set provides 
// sub-millisecond lookup times for token revocation without adding database query overhead.
const revokedTokens = new Set();

/**
 * Revokes a refresh token by adding it to the in-memory revoked tokens set.
 * @param {string} token - Refresh token to revoke
 */
function revokeToken(token) {
  if (token) {
    revokedTokens.add(token);
  }
}

/**
 * Checks if a refresh token has been revoked.
 * @param {string} token - Refresh token to check
 * @returns {boolean} True if revoked
 */
function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

module.exports = {
  revokeToken,
  isTokenRevoked,
};
