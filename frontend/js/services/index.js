import { Api } from '../api.js';

export const OwnerService = {
  list: (params) => Api.get('/owners', params),
  get: (id) => Api.get(`/owners/${id}`),
  create: (d) => Api.post('/owners', d),
  update: (id, d) => Api.put(`/owners/${id}`, d),
  remove: (id) => Api.delete(`/owners/${id}`),
};

export const PatientService = {
  list: (params) => Api.get('/patients', params),
  get: (id) => Api.get(`/patients/${id}`),
  create: (d) => Api.post('/patients', d),
  update: (id, d) => Api.put(`/patients/${id}`, d),
  remove: (id) => Api.delete(`/patients/${id}`),
};

export const CalendarService = {
  events: (params) => Api.get('/calendar/events', params),
  get: (id) => Api.get(`/calendar/events/${id}`),
  create: (d) => Api.post('/calendar/events', d),
  update: (id, d) => Api.put(`/calendar/events/${id}`, d),
  remove: (id) => Api.delete(`/calendar/events/${id}`),
  clone: (id) => Api.post(`/calendar/events/${id}/clone`, {}),
};

export const AppointmentService = {
  list: (params) => Api.get('/appointments', params),
  get: (id) => Api.get(`/appointments/${id}`),
  create: (d) => Api.post('/appointments', d),
  update: (id, d) => Api.put(`/appointments/${id}`, d),
  start: (id) => Api.post(`/appointments/${id}/start`, {}),
  complete: (id, d) => Api.post(`/appointments/${id}/complete`, d || {}),
  cancel: (id, d) => Api.post(`/appointments/${id}/cancel`, d || {}),
  addService: (id, d) => Api.post(`/appointments/${id}/services`, d),
  removeService: (id, itemId) => Api.delete(`/appointments/${id}/services/${itemId}`),
  addDrug: (id, d) => Api.post(`/appointments/${id}/drugs`, d),
  nextVisit: (id, d) => Api.post(`/appointments/${id}/next-visit`, d),
  addDoctor: (id, d) => Api.post(`/appointments/${id}/doctors`, d),
  removeDoctor: (id, linkId) => Api.delete(`/appointments/${id}/doctors/${linkId}`),
};

export const UserService = {
  list: (params) => Api.get('/users', params),
  doctors: () => Api.get('/users/doctors'),
  create: (d) => Api.post('/users', d),
  update: (id, d) => Api.put(`/users/${id}`, d),
  remove: (id) => Api.delete(`/users/${id}`),
};

export const RoleService = { list: () => Api.get('/roles') };
export const DashboardService = { get: () => Api.get('/dashboard') };

export const PriceService = {
  list: (params) => Api.get('/services', params),
  categories: () => Api.get('/services/categories'),
  create: (d) => Api.post('/services', d),
  update: (id, d) => Api.put(`/services/${id}`, d),
  remove: (id) => Api.delete(`/services/${id}`),
};

export const DrugService = {
  list: (params) => Api.get('/drugs', params),
  categories: () => Api.get('/drugs/categories'),
  create: (d) => Api.post('/drugs', d),
  update: (id, d) => Api.put(`/drugs/${id}`, d),
  remove: (id) => Api.delete(`/drugs/${id}`),
};

export const WarehouseService = {
  stock: (params) => Api.get('/warehouse/stock', params),
  income: (d) => Api.post('/warehouse/income', d),
  writeOff: (d) => Api.post('/warehouse/write-off', d),
  correction: (d) => Api.post('/warehouse/correction', d),
  movements: (params) => Api.get('/warehouse/movements', params),
};

export const SupplierService = {
  list: () => Api.get('/suppliers'),
  create: (d) => Api.post('/suppliers', d),
  update: (id, d) => Api.put(`/suppliers/${id}`, d),
  remove: (id) => Api.delete(`/suppliers/${id}`),
};

export const InvoiceService = {
  list: (params) => Api.get('/invoices', params),
  get: (id) => Api.get(`/invoices/${id}`),
  create: (d) => Api.post('/invoices', d),
  pay: (id, d) => Api.post(`/invoices/${id}/pay`, d),
  refund: (id, d) => Api.post(`/invoices/${id}/refund`, d),
};

export const DebtService = { list: (params) => Api.get('/debts', params) };

export const ReportService = {
  revenue: (params) => Api.get('/reports/revenue', params),
  profit: (params) => Api.get('/reports/profit', params),
  doctors: (params) => Api.get('/reports/doctors', params),
  warehouse: () => Api.get('/reports/warehouse'),
  debtors: () => Api.get('/reports/debtors'),
  services: (params) => Api.get('/reports/services', params),
  drugs: (params) => Api.get('/reports/drugs', params),
  builderSchema: () => Api.get('/reports/builder/schema'),
  builderRun: (spec) => Api.post('/reports/builder/run', spec),
};

export const VaccinationService = {
  list: (params) => Api.get('/vaccinations', params),
  create: (d) => Api.post('/vaccinations', d),
  update: (id, d) => Api.put(`/vaccinations/${id}`, d),
  remove: (id) => Api.delete(`/vaccinations/${id}`),
};

export const ReminderService = {
  list: (params) => Api.get('/reminders', params),
  create: (d) => Api.post('/reminders', d),
  send: (id) => Api.post(`/reminders/${id}/send`, {}),
  cancel: (id) => Api.post(`/reminders/${id}/cancel`, {}),
};

export const SalaryService = {
  rules: () => Api.get('/salary/rules'),
  saveRule: (d) => Api.post('/salary/rules', d),
  calculate: (d) => Api.post('/salary/calculate', d),
  pay: (d) => Api.post('/salary/payments', d),
  payments: () => Api.get('/salary/payments'),
};

export const SettingsService = {
  get: () => Api.get('/settings'),
  update: (d) => Api.put('/settings', d),
};

export const FileService = {
  list: (params) => Api.get('/files', params),
  upload: (formData) => Api.upload('/files/upload', formData),
  remove: (id) => Api.delete(`/files/${id}`),
};

export const TemplateService = {
  list: (params) => Api.get('/templates', params),
  create: (d) => Api.post('/templates', d),
  update: (id, d) => Api.put(`/templates/${id}`, d),
  remove: (id) => Api.delete(`/templates/${id}`),
};

export const PermissionService = { list: () => Api.get('/permissions') };
export const RoleAdminService = {
  create: (d) => Api.post('/roles', d),
  update: (id, d) => Api.put(`/roles/${id}`, d),
};
