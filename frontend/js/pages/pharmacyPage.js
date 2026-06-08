import { el, clear, debounce } from "../utils/dom.js";
import {
  DrugService,
  WarehouseService,
  SupplierService,
} from "../services/index.js";
import { renderTable } from "../components/table.js";
import { openModal, confirmDialog } from "../components/modal.js";
import { buildForm } from "../components/form.js";
import { Toast } from "../components/toast.js";
import { can } from "../permissions.js";
import { money, fmtDate } from "../utils/format.js";
import { exportButton, importButton } from "../components/importExport.js";
import { icon } from "../components/icons.js";
import { emptyState } from "../components/emptyState.js";

export function renderPharmacyPage(root) {
  const state = { search: "", lowOnly: false, loading: true, items: [] };
  root.append(
    el("div", { class: "page-head pharmacy-head" }, [
      el("h1", {}, "Аптека / препарати"),
      el("div", { class: "toolbar pharmacy-toolbar" }, [
        search(),
        el("div", { class: "pharmacy-actions" }, [
          lowToggle(),
          exportButton("/export/warehouse.csv", "warehouse.csv"),
          can("warehouse.manage")
            ? importButton("drugs", "Препарати", reload)
            : null,
          can("warehouse.manage")
            ? el(
                "button",
                {
                  class: "btn btn-primary pharmacy-add-btn",
                  onClick: () => openForm(null, reload),
                },
                [icon("plus", { size: 16 }), "Препарат"],
              )
            : null,
        ]),
      ]),
    ]),
  );
  const container = el("div");
  root.append(container);

  function search() {
    const i = el("input", {
      type: "search",
      placeholder: "Назва, штрихкод, діюча речовина…",
      class: "pharmacy-search",
    });
    i.addEventListener(
      "input",
      debounce((e) => {
        state.search = e.target.value;
        load();
      }, 300),
    );
    return i;
  }
  function lowToggle() {
    const b = el(
      "button",
      {
        class: "btn btn-ghost btn-sm",
        onClick: () => {
          state.lowOnly = !state.lowOnly;
          b.classList.toggle("btn-primary", state.lowOnly);
          load();
        },
      },
      "Малий залишок",
    );
    return b;
  }
  async function load() {
    state.loading = true;
    render();
    try {
      state.items = await DrugService.list({
        search: state.search,
        lowStock: state.lowOnly ? "true" : undefined,
      });
    } catch (e) {
      Toast.fromError(e);
    } finally {
      state.loading = false;
      render();
    }
  }
  function reload() {
    load();
  }
  function render() {
    clear(container);
    container.append(
      renderTable(
        [
          { title: "Назва", render: (d) => el("strong", {}, d.name) },
          { title: "Діюча речовина", render: (d) => d.active_substance || "—" },
          {
            title: "Залишок",
            render: (d) => {
              const low = Number(d.stock_qty) <= Number(d.min_stock);
              return el(
                "span",
                { class: `badge ${low ? "badge-red" : "badge-green"}` },
                `${Number(d.stock_qty)} ${d.unit}`,
              );
            },
          },
          {
            title: "Найближчий термін",
            render: (d) =>
              d.nearest_expiration ? fmtDate(d.nearest_expiration) : "—",
          },
          { title: "Ціна продажу", render: (d) => money(d.selling_price) },
          {
            title: "",
            width: "230px",
            render: (d) =>
              can("warehouse.manage")
                ? el("div", { class: "row-actions" }, [
                    el(
                      "button",
                      {
                        class: "btn btn-ghost btn-sm",
                        onClick: () => openIncome(d, reload),
                      },
                      [icon("plus", { size: 14 }), " Прихід"],
                    ),
                    el(
                      "button",
                      {
                        class: "btn btn-ghost btn-sm",
                        title: "Списати",
                        onClick: () => openWriteOff(d, reload),
                      },
                      [icon("trash", { size: 14 }), " Списати"],
                    ),
                    el(
                      "button",
                      {
                        class: "btn btn-ghost btn-sm",
                        title: "Редагувати",
                        onClick: () => openForm(d, reload),
                      },
                      [icon("edit", { size: 15 })],
                    ),
                  ])
                : null,
          },
        ],
        state.items,
        {
          loading: state.loading,
          emptyText: emptyState({
            icon: "pill",
            title: "Немає препаратів",
            hint: "Додайте препарат, щоб вести облік аптеки",
            action: can("warehouse.manage")
              ? { label: "+ Препарат", onClick: () => openForm(null, reload) }
              : null,
          }),
        },
      ),
    );
  }
  load();
}

function openForm(drug, onSaved) {
  const isEdit = !!drug;
  const { form } = buildForm(
    [
      {
        name: "name",
        label: "Назва",
        required: true,
        value: drug?.name,
        full: true,
      },
      {
        name: "unit",
        label: "Одиниця",
        required: true,
        value: drug?.unit || "шт",
      },
      {
        name: "activeSubstance",
        label: "Діюча речовина",
        value: drug?.active_substance,
      },
      { name: "manufacturer", label: "Виробник", value: drug?.manufacturer },
      { name: "barcode", label: "Штрихкод", value: drug?.barcode },
      {
        name: "sellingPrice",
        label: "Ціна продажу",
        type: "number",
        min: 0,
        value: drug ? Number(drug.selling_price) : 0,
      },
      {
        name: "purchasePrice",
        label: "Закупівельна",
        type: "number",
        min: 0,
        value: drug ? Number(drug.purchase_price) : 0,
      },
      {
        name: "minStock",
        label: "Мін. залишок",
        type: "number",
        min: 0,
        value: drug ? Number(drug.min_stock) : 0,
      },
    ],
    {
      submitText: isEdit ? "Зберегти" : "Створити",
      onCancel: () => ctrl.close(),
      onSubmit: async (v) => {
        try {
          if (isEdit) await DrugService.update(drug.id, v);
          else await DrugService.create(v);
          Toast.success("Збережено");
          ctrl.close();
          onSaved?.();
        } catch (e) {
          if (e?.fields) throw e;
          Toast.fromError(e);
        }
      },
    },
  );
  const ctrl = openModal({
    title: isEdit ? "Редагувати препарат" : "Новий препарат",
    body: form,
  });
}

async function openIncome(drug, onSaved) {
  let suppliers = [];
  try {
    suppliers = (await SupplierService.list()) || [];
  } catch {
    /* без постачальників форма теж працює */
  }
  const { form } = buildForm(
    [
      {
        name: "quantity",
        label: `Кількість (${drug.unit})`,
        type: "number",
        min: 0,
        required: true,
        value: 1,
      },
      {
        name: "purchasePrice",
        label: "Закупівельна ціна",
        type: "number",
        min: 0,
        value: Number(drug.purchase_price),
      },
      {
        name: "sellingPrice",
        label: "Ціна продажу",
        type: "number",
        min: 0,
        value: Number(drug.selling_price),
      },
      {
        name: "supplierId",
        label: "Постачальник",
        type: "select",
        full: true,
        options: [
          { value: "", label: "— не вказано —" },
          ...suppliers.map((s) => ({ value: s.id, label: s.name })),
        ],
      },
      { name: "batchNumber", label: "Номер партії", value: "" },
      {
        name: "expirationDate",
        label: "Термін придатності",
        type: "date",
        value: "",
      },
    ],
    {
      submitText: "Оприбуткувати",
      onCancel: () => ctrl.close(),
      onSubmit: async (v) => {
        try {
          await WarehouseService.income({
            ...v,
            drugId: drug.id,
            supplierId: v.supplierId || null,
            expirationDate: v.expirationDate || null,
          });
          Toast.success("Прихід оформлено");
          ctrl.close();
          onSaved?.();
        } catch (e) {
          if (e?.fields) throw e;
          Toast.fromError(e);
        }
      },
    },
  );
  const ctrl = openModal({ title: `Прихід: ${drug.name}`, body: form });
}

// Ручне списання зі складу (FEFO на бекенді) — ТЗ §4.5/§6.8/§13.4
function openWriteOff(drug, onSaved) {
  const inStock = Number(drug.stock_qty || 0);
  const { form } = buildForm(
    [
      {
        name: "quantity",
        label: `Кількість (${drug.unit})`,
        type: "number",
        min: 0,
        required: true,
        value: 1,
        placeholder: `На складі: ${inStock} ${drug.unit}`,
      },
      {
        name: "reason",
        label: "Причина списання",
        type: "textarea",
        full: true,
        placeholder: "Псування, бій, прострочення…",
      },
      {
        name: "allowExpired",
        label: "Дозволити списання простроченого",
        type: "checkbox",
        value: false,
        full: true,
      },
    ],
    {
      submitText: "Списати",
      onCancel: () => ctrl.close(),
      onSubmit: async (v) => {
        try {
          await WarehouseService.writeOff({
            ...v,
            drugId: drug.id,
            reason: v.reason || "Ручне списання",
          });
          Toast.success("Списано", `${v.quantity} ${drug.unit}`);
          ctrl.close();
          onSaved?.();
        } catch (e) {
          if (e?.fields) throw e;
          Toast.fromError(e);
        }
      },
    },
  );
  const ctrl = openModal({ title: `Списання: ${drug.name}`, body: form });
}
