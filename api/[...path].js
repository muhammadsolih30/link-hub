import health from '../server/routes/health.js';
import categories from '../server/routes/categories.js';
import deleteCategory from '../server/routes/categories/delete.js';
import links from '../server/routes/links.js';
import updateLink from '../server/routes/links/update.js';
import deleteLink from '../server/routes/links/delete.js';
import register from '../server/routes/auth/register.js';
import login from '../server/routes/auth/login.js';
import me from '../server/routes/auth/me.js';
import changePassword from '../server/routes/auth/change-password.js';
import recoveryRequest from '../server/routes/auth/recovery-request.js';
import recoveryStatus from '../server/routes/auth/recovery-status.js';
import verifyRecoveryCode from '../server/routes/auth/verify-recovery-code.js';
import recoverWithCode from '../server/routes/auth/recover-with-code.js';
import resetPassword from '../server/routes/auth/reset-password.js';
import adminSummary from '../server/routes/admin/summary.js';
import adminUsers from '../server/routes/admin/users.js';
import adminUser from '../server/routes/admin/user.js';
import adminResetLink from '../server/routes/admin/reset-link.js';
import adminRecoveryRequests from '../server/routes/admin/recovery-requests.js';
import adminRecoveryRequestsSeen from '../server/routes/admin/recovery-requests/seen.js';
import adminRecoveryCode from '../server/routes/admin/recovery-code.js';

const handlers = {
  health,
  categories,
  'categories/delete': deleteCategory,
  links,
  'links/update': updateLink,
  'links/delete': deleteLink,
  'auth/register': register,
  'auth/login': login,
  'auth/me': me,
  'auth/change-password': changePassword,
  'auth/recovery-request': recoveryRequest,
  'auth/recovery-status': recoveryStatus,
  'auth/verify-recovery-code': verifyRecoveryCode,
  'auth/recover-with-code': recoverWithCode,
  'auth/reset-password': resetPassword,
  'admin/summary': adminSummary,
  'admin/users': adminUsers,
  'admin/user': adminUser,
  'admin/reset-link': adminResetLink,
  'admin/recovery-requests': adminRecoveryRequests,
  'admin/recovery-requests/seen': adminRecoveryRequestsSeen,
  'admin/recovery-code': adminRecoveryCode,
};

export default function handler(req, res) {
  const route = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : String(req.query?.path || '').replace(/^\/+|\/+$/g, '');
  const apiHandler = handlers[route];
  if (!apiHandler) return res.status(404).json({ error: 'API manzili topilmadi.' });
  return apiHandler(req, res);
}
