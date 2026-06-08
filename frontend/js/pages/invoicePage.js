import { el, clear } from '../utils/dom.js';
import { InvoiceService } from '../services/index.js';
import { openModal } from '../components/modal.js';
import { buildForm } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { can } from '../permissions.js';
import { navigate } from '../router.js';
import { fullName, money, fmtDateTime } from '../utils/format.js';
import { downloadFile } from '../api.js';
import { icon } from '../components/icons.js';

const INV_STATUS = {
  draft: ['Чернетка', 'badge-gray'], unpaid: ['Не оплачено', 'badge-red'],
  partial: ['Частково', 'badge-amber'], paid: ['Оплачено', 'badge-green'],
};
const METHODS = { cash: 'Готівка', card: 'Картка', transfer: 'Переказ', bonus: 'Бонуси' };

export async function renderInvoicePage(root, id) {
  root.append(el('div', { class: 'spinner' }));
  let inv;
  try { inv = await InvoiceService.get(id); }
  catch (e) { Toast.fromError(e); clear(root); root.append(el('p', { class: 'muted' }, 'Рахунок не знайдено')); return; }
  const reload = () => renderInvoicePage(root, id);
  clear(root);

  const [label, cls] = INV_STATUS[inv.status] || [inv.status, 'badge-gray'];
  const debt = Number(inv.debt_amount);

  root.append(
    el('div', { class: 'page-head' }, [
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => navigate('/invoices') }, [icon('back', { size: 15 }), ' Назад']),
      el('div', { class: 'toolbar' }, [
        el('button', { class: 'btn btn-ghost btn-sm', onClick: async () => {
          try { await downloadFile(`/export/invoice/${inv.id}.pdf`, `invoice-${inv.id.slice(0, 8)}.pdf`); }
          catch (e) { Toast.fromError(e); }
        } }, [icon('download', { size: 15 }), ' PDF']),
        (Number(inv.paid_amount) > 0 && can('finance.manage'))
          ? el('button', { class: 'btn btn-ghost btn-sm', onClick: () => openRefund(inv, reload) }, 'Повернення')
          : null,
        (debt > 0 && can('finance.manage'))
          ? el('button', { class: 'btn btn-primary', onClick: () => openPay(inv, reload) }, 'Прийняти оплату')
          : null,
      ]),
    ]),
    el('div', { class: 'card card-pad' }, [
      el('h1', { style: 'font-size:20px' }, ['Рахунок  ', el('span', { class: `badge ${cls}` }, label)]),
      el('div', { class: 'muted', style: 'margin:6px 0 16px' },
        `${fullName({ first_name: inv.owner_first_name, last_name: inv.owner_last_name })} · ${inv.owner_phone || ''} · ${fmtDateTime(inv.created_at)}`),
      itemsTable(inv),
      el('dl', { class: 'kv', style: 'margin-top:16px;max-width:320px;margin-left:auto' }, [
        kv('Підсумок', money(inv.subtotal)), kv('Знижка', money(inv.discount)),
        kv('Разом', el('strong', {}, money(inv.total))),
        kv('Сплачено', money(inv.paid_amount)), kv('Борг', money(inv.debt_amount)),
      ]),
    ]),
    paymentsBlock(inv),
  );
}

function itemsTable(inv) {
  const rows = inv.items.map((it) => el('tr', {}, [
    el('td', {}, it.name),
    el('td', {}, it.type === 'service' ? 'Послуга' : 'Препарат'),
    el('td', {}, String(Number(it.quantity))),
    el('td', {}, money(it.unit_price)),
    el('td', {}, money(it.total)),
  ]));
  return el('div', { class: 'table-wrap' }, [el('table', { class: 'data-table' }, [
    el('thead', {}, [el('tr', {}, ['Позиція', 'Тип', 'К-сть', 'Ціна', 'Сума'].map((h) => el('th', {}, h)))]),
    el('tbody', {}, rows.length ? rows : [el('tr', {}, [el('td', { colspan: 5 }, [el('div', { class: 'table-state' }, 'Немає позицій')])])]),
  ])]);
}

function paymentsBlock(inv) {
  const block = el('div', { class: 'card card-pad', style: 'margin-top:16px' }, [el('h2', { style: 'font-size:16px;margin-bottom:10px' }, 'Платежі')]);
  if (!inv.payments.length) { block.append(el('p', { class: 'muted' }, 'Платежів ще не було')); return block; }
  inv.payments.forEach((p) => block.append(el('div', { class: 'list-line', style: 'display:flex;justify-content:space-between' }, [
    el('span', {}, `${fmtDateTime(p.created_at)} · ${METHODS[p.method] || p.method}${p.status === 'refunded' ? ' (повернення)' : ''}`),
    el('strong', {}, money(p.amount)),
  ])));
  return block;
}

function openPay(inv, onSaved) {
  const remaining = Number(inv.debt_amount);
  const { form } = buildForm([
    { name: 'amount', label: `Сума (борг ${money(remaining)})`, type: 'number', min: 0, required: true, value: remaining },
    { name: 'method', label: 'Спосіб', type: 'select', value: 'cash',
      options: Object.entries(METHODS).map(([v, l]) => ({ value: v, label: l })) },
    { name: 'comment', label: 'Коментар', value: '', full: true },
  ], {
    submitText: 'Прийняти', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { const r = await InvoiceService.pay(inv.id, v); Toast.success('Оплату прийнято', `Борг: ${money(r.debt)}`); ctrl.close(); onSaved?.(); }
      catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: 'Прийняти оплату', body: form });
}

function openRefund(inv, onSaved) {
  const paid = Number(inv.paid_amount);
  const { form } = buildForm([
    { name: 'amount', label: `Сума повернення (сплачено ${money(paid)})`, type: 'number', min: 0, required: true, value: paid },
    { name: 'comment', label: 'Причина', value: '', full: true },
  ], {
    submitText: 'Оформити повернення', onCancel: () => ctrl.close(),
    onSubmit: async (v) => {
      try { await InvoiceService.refund(inv.id, v); Toast.success('Повернення оформлено'); ctrl.close(); onSaved?.(); }
      catch (e) { if (e?.fields) throw e; Toast.fromError(e); }
    },
  });
  const ctrl = openModal({ title: 'Повернення коштів', body: form });
}

function kv(label, value) {
  return el('div', { style: 'display:contents' }, [el('dt', {}, label), el('dd', { style: 'text-align:right' }, value)]);
}
