// Fast in-memory Set store to track revoked (logged out) refresh tokens
const revokedTokens = new Set();

// Adds a refresh token to the revoked set when a user logs out
function revokeToken(token) {
  if (token) {
    revokedTokens.add(token);
  }
}

// Checks if a refresh token has been revoked (returns true if found in set)
function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

module.exports = {
  revokeToken,
  isTokenRevoked,
};
