import { el } from '../utils/dom.js';
import { Auth } from '../auth.js';
import { navigate } from '../router.js';
import { Toast } from '../components/toast.js';

export function renderLoginPage(root) {
  const identifier = el('input', { type: 'text', placeholder: 'admin@vetcore.local', value: 'admin@vetcore.local', autofocus: true });
  const password = el('input', { type: 'password', placeholder: '••••••••', value: 'admin12345' });
  const errBox = el('div', { class: 'err', style: 'margin-bottom:12px' });
  const btn = el('button', { class: 'btn btn-primary', type: 'submit', style: 'width:100%' }, 'Увійти');

  const form = el('form', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Email або телефон'), identifier]),
    el('div', { class: 'field' }, [el('label', {}, 'Пароль'), password]),
    errBox,
    btn,
    el('p', { style: 'margin-top:12px;text-align:center' }, [
      el('a', { href: '/forgot-password', style: 'color:var(--c-primary);font-size:13px',
        onClick: (e) => { e.preventDefault(); navigate('/forgot-password'); } }, 'Забули пароль?'),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.textContent = '';
    btn.disabled = true; btn.textContent = 'Вхід…';
    try {
      await Auth.login(identifier.value.trim(), password.value);
      Toast.success('Вітаємо!', 'Вхід виконано');
      navigate('/dashboard');
    } catch (err) {
      errBox.textContent = err?.message || 'Не вдалося увійти';
    } finally {
      btn.disabled = false; btn.textContent = 'Увійти';
    }
  });

  root.append(el('div', { class: 'auth-shell' }, [
    el('div', { class: 'auth-card' }, [
      el('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:4px' }, [
        el('img', { src: '/assets/images/logo-vetcore.png', alt: 'VetCore', style: 'width:48px;height:48px;border-radius:11px' }),
        el('h1', {}, 'VetCore'),
      ]),
      el('p', { class: 'muted' }, 'CRM ветеринарної клініки'),
      form,
      el('p', { class: 'muted', style: 'margin-top:16px;font-size:12px' },
        'Демо: admin@vetcore.local / admin12345'),
    ]),
  ]));
}
