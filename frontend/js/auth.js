import { Api, setTokens, clearTokens, getToken } from './api.js';
import { Store } from './store.js';

export const Auth = {
  isAuthenticated() { return !!getToken(); },

  async login(identifier, password) {
    const data = await Api.post('/auth/login', { identifier, password });
    setTokens(data);
    Store.set('user', data.user);
    return data.user;
  },

  async loadMe() {
    const user = await Api.get('/auth/me');
    Store.set('user', user);
    return user;
  },

  async logout() {
    try { await Api.post('/auth/logout', {}); } catch { /* ignore */ }
    clearTokens();
    Store.set('user', null);
  },

  forgotPassword(email) { return Api.post('/auth/forgot-password', { email }); },
  resetPassword(token, newPassword) { return Api.post('/auth/reset-password', { token, newPassword }); },
};
