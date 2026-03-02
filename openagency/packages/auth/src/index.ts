export { signToken, verifyToken, decodeToken } from './jwt.js';
export {
  generateApiKey,
  hashApiKey,
  extractPrefix,
  isTestKey,
  createApiKeyRecord,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  DEV_KEY,
} from './api-keys.js';
export {
  registerM2MClient,
  clientCredentialsGrant,
  getM2MClient,
  listM2MClients,
} from './m2m-oauth2.js';
export {
  hasScope,
  getDefaultScopes,
  engineSkillScope,
  roleHasPermission,
} from './rbac.js';
export { authMiddleware } from './middleware/hono-auth.js';
