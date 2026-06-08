import { el } from '../utils/dom.js';
import { Auth } from '../auth.js';
import { navigate } from '../router.js';

export function renderForgotPasswordPage(root) {
  const email = el('input', { type: 'email', placeholder: 'admin@vetcore.local', autofocus: true });
  const msg = el('div', { style: 'margin-bottom:12px' });
  const btn = el('button', { class: 'btn btn-primary', type: 'submit', style: 'width:100%' }, 'Надіслати інструкції');

  const form = el('form', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Email'), email]),
    msg, btn,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = ''; btn.disabled = true; btn.textContent = 'Надсилання…';
    try {
      const r = await Auth.forgotPassword(email.value.trim());
      msg.className = 'muted';
      msg.textContent = 'Якщо обліковий запис існує — інструкції надіслано.';
      // dev: одразу даємо перейти до скидання за токеном
      if (r && r.resetToken) {
        msg.append(el('div', { style: 'margin-top:8px' }, [
          el('a', { href: `/reset-password?token=${encodeURIComponent(r.resetToken)}`, style: 'color:var(--c-primary)',
            onClick: (ev) => { ev.preventDefault(); navigate(`/reset-password?token=${encodeURIComponent(r.resetToken)}`); } },
            'Демо: перейти до скидання пароля →'),
        ]));
      }
    } catch (err) {
      msg.className = 'err'; msg.textContent = err?.message || 'Помилка';
    } finally { btn.disabled = false; btn.textContent = 'Надіслати інструкції'; }
  });

  root.append(el('div', { class: 'auth-shell' }, [
    el('div', { class: 'auth-card' }, [
      el('h1', {}, 'Відновлення пароля'),
      el('p', { class: 'muted' }, 'Вкажіть email облікового запису'),
      form,
      el('p', { style: 'margin-top:16px' }, [
        el('a', { href: '/login', style: 'color:var(--c-primary)', onClick: (e) => { e.preventDefault(); navigate('/login'); } }, '← Назад до входу'),
      ]),
    ]),
  ]));
}
