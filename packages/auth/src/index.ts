export { hashPassword, verifyPassword } from './password.js';
export {
  createSession,
  validateSession,
  destroySession,
  destroyUserSessions,
} from './session.js';
export { csrfProtection } from './csrf.js';
export { requireAuth, requireRole } from './auth.middleware.js';
export {
  checkLoginRateLimit,
  recordFailedLogin,
  resetFailedLogins,
} from './rate-limit.js';
export {
  generateSecret,
  generateOtpauthUrl,
  generateQRCodeDataUrl,
  verifyCode,
} from './totp.service.js';
export {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  adminResetPassword,
  adminReset2FA,
  UserError,
  type UserPublic,
} from './auth.service.js';
