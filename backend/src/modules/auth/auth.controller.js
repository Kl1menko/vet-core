import * as authService from './auth.service.js';
import { ok } from '../../utils/response.js';
import { validate } from '../../utils/validate.js';
import { writeAudit, auditCtx } from '../../utils/auditLog.js';

export async function login(req, res) {
  const { identifier, password } = validate(req.body, {
    identifier: { required: true },
    password: { required: true },
  });
  const result = await authService.login(identifier, password);
  await writeAudit({ ...auditCtx(req), userId: result.user.id, clinicId: result.user.clinicId,
    action: 'login', entityType: 'user', entityId: result.user.id });
  ok(res, result, 'Вхід виконано');
}

export async function logout(_req, res) {
  // stateless JWT — фактичний інвалідейт на клієнті. Тут лише підтвердження.
  ok(res, {}, 'Вихід виконано');
}

export async function refresh(req, res) {
  const { refreshToken } = validate(req.body, { refreshToken: { required: true } });
  const result = await authService.refresh(refreshToken);
  ok(res, result, 'Токен оновлено');
}

export async function me(req, res) {
  ok(res, await authService.me(req.user.id));
}

export async function changePassword(req, res) {
  const { oldPassword, newPassword } = validate(req.body, {
    oldPassword: { required: true },
    newPassword: { required: true, min: 6 },
  });
  await authService.changePassword(req.user.id, oldPassword, newPassword);
  await writeAudit({ ...auditCtx(req), action: 'change_password', entityType: 'user', entityId: req.user.id });
  ok(res, {}, 'Пароль змінено');
}

// Відновлення пароля (ТЗ §10.1)
export async function forgotPassword(req, res) {
  const { email } = validate(req.body, { email: { required: true, email: true } });
  const token = await authService.requestPasswordReset(email);
  // У dev повертаємо токен (немає email-каналу). У проді — лише повідомлення.
  const extra = (process.env.NODE_ENV !== 'production' && token) ? { resetToken: token } : {};
  ok(res, extra, 'Якщо обліковий запис існує — інструкції з відновлення надіслано');
}

export async function resetPassword(req, res) {
  const { token, newPassword } = validate(req.body, {
    token: { required: true },
    newPassword: { required: true, min: 6 },
  });
  await authService.resetPassword(token, newPassword);
  await writeAudit({ ...auditCtx(req), action: 'reset_password', entityType: 'user' });
  ok(res, {}, 'Пароль змінено. Тепер можна увійти.');
}
