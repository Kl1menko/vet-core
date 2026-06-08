import { el } from '../utils/dom.js';
import { Auth } from '../auth.js';
import { navigate } from '../router.js';
import { Toast } from '../components/toast.js';

export function renderResetPasswordPage(root) {
  const token = new URLSearchParams(location.search).get('token') || '';
  const pass = el('input', { type: 'password', placeholder: '••••••••', autofocus: true });
  const pass2 = el('input', { type: 'password', placeholder: '••••••••' });
  const errBox = el('div', { class: 'err', style: 'margin-bottom:12px' });
  const btn = el('button', { class: 'btn btn-primary', type: 'submit', style: 'width:100%' }, 'Змінити пароль');

  const form = el('form', {}, [
    el('div', { class: 'field' }, [el('label', {}, 'Новий пароль'), pass]),
    el('div', { class: 'field' }, [el('label', {}, 'Повторіть пароль'), pass2]),
    errBox, btn,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.textContent = '';
    if (!token) { errBox.textContent = 'Відсутній або недійсний токен'; return; }
    if (pass.value.length < 6) { errBox.textContent = 'Пароль мінімум 6 символів'; return; }
    if (pass.value !== pass2.value) { errBox.textContent = 'Паролі не збігаються'; return; }
    btn.disabled = true; btn.textContent = 'Збереження…';
    try {
      await Auth.resetPassword(token, pass.value);
      Toast.success('Пароль змінено', 'Тепер можна увійти');
      navigate('/login');
    } catch (err) { errBox.textContent = err?.message || 'Помилка'; }
    finally { btn.disabled = false; btn.textContent = 'Змінити пароль'; }
  });

  root.append(el('div', { class: 'auth-shell' }, [
    el('div', { class: 'auth-card' }, [
      el('h1', {}, 'Новий пароль'),
      el('p', { class: 'muted' }, 'Введіть новий пароль для входу'),
      form,
    ]),
  ]));
}
