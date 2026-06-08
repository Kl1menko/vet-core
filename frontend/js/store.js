// Глобальний стан + Custom Events (ТЗ §11.2).
export const Store = {
  state: {
    user: null,
    clinic: null,
    selectedDate: new Date(),
  },

  set(key, value) {
    this.state[key] = value;
    document.dispatchEvent(new CustomEvent('state:update', { detail: { key, value } }));
  },

  get(key) { return this.state[key]; },

  on(key, handler) {
    const listener = (e) => { if (e.detail.key === key) handler(e.detail.value); };
    document.addEventListener('state:update', listener);
    return () => document.removeEventListener('state:update', listener);
  },
};
