(() => {
  const API = window.DE_API;
  const CFG = window.DREAM_EVENTS_CONFIG;
  if (!API || !CFG) return;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const escapeHtml = s => String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
  const money = v => `${CFG.CURRENCY || 'LKR'} ${Number(v || 0).toLocaleString('en-LK', {maximumFractionDigits:2})}`;
  const displayStatus = s => String(s || '').replaceAll('_',' ');
  const statusClass = s => `status ${String(s || '').toLowerCase().replaceAll('_','-').replaceAll(' ','-')}`;
  const today = () => new Date().toLocaleDateString('en-CA');
  const isFinance = () => API.getSession()?.user?.role === 'FINANCE_HEAD';

  let supplierCache = null;
  let payableBundle = null;
  let inventoryBundle = null;

  function toast(message, type='ok') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${type}`;
    setTimeout(() => el.className = 'toast', 2800);
  }

  function openModal(title, html) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modal').classList.remove('hidden');
    $$('[data-ops-close]').forEach(b => b.onclick = closeModal);
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
  }

  function setRouteUI(route, title) {
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));
    $('#pageEyebrow').textContent = 'DREAM EVENTS';
    $('#pageTitle').textContent = title;
    document.body.classList.remove('nav-open');
  }

  function ensureSupplierNav() {
    const nav = $('#mainNav');
    if (!nav || nav.querySelector('[data-route="suppliers"]')) return;
    const inventory = nav.querySelector('[data-route="inventory"]');
    const btn = document.createElement('button');
    btn.dataset.route = 'suppliers';
    btn.className = 'nav-item finance-only';
    btn.textContent = 'Suppliers';
    if (!isFinance()) btn.classList.add('hidden');
    if (inventory) nav.insertBefore(btn, inventory);
    else nav.appendChild(btn);
  }

  async function openOpsRoute(route) {
    if (!isFinance()) return;
    const titles = {suppliers:'Suppliers', payables:'Payables & Reimbursements', inventory:'Inventory'};
    setRouteUI(route, titles[route] || route);
    $('#content').innerHTML = '<div class="loading">Loading…</div>';
    try {
      if (route === 'suppliers') return renderSuppliers();
      if (route === 'payables') return renderPayables();
      if (route === 'inventory') return renderInventory();
    } catch (err) {
      $('#content').innerHTML = `<div class="empty error-box"><h3>Unable to load</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function installRouteInterception() {
    const nav = $('#mainNav');
    if (!nav) return;
    nav.addEventListener('click', e => {
      const btn = e.target.closest('[data-route]');
      if (!btn || !['suppliers','payables','inventory'].includes(btn.dataset.route)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openOpsRoute(btn.dataset.route);
    }, true);
  }

  async function loadSuppliers(force=false) {
    if (!force && supplierCache) return supplierCache;
    supplierCache = await API.request('listSuppliers');
    return supplierCache;
  }

  function supplierRows(items) {
    if (!items.length) return '<tr><td colspan="6" class="empty">No suppliers found.</td></tr>';
    return items.map(s => `<tr>
      <td><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.supplierId)}</small></td>
      <td>${escapeHtml(s.category || '—')}</td>
      <td>${escapeHtml(s.contactPerson || '—')}</td>
      <td>${escapeHtml(s.phone || s.whatsapp || '—')}</td>
      <td><span class="${statusClass(s.status)}">${escapeHtml(displayStatus(s.status))}</span></td>
      <td><button class="btn btn-xs btn-secondary" data-supplier-edit="${escapeHtml(s.supplierId)}">Edit</button></td>
    </tr>`).join('');
  }

  async function renderSuppliers() {
    const suppliers = await loadSuppliers(true);
    $('#content').innerHTML = `
      <div class="toolbar">
        <input id="supplierSearch" class="search" placeholder="Search supplier, category, contact or phone">
        <button id="newSupplierBtn" class="btn btn-primary">+ New Supplier</button>
      </div>
      <section class="panel table-panel">
        <table>
          <thead><tr><th>Supplier</th><th>Category</th><th>Contact</th><th>Phone</th><th>Status</th><th></th></tr></thead>
          <tbody id="supplierRows">${supplierRows(suppliers)}</tbody>
        </table>
      </section>`;
    bindSupplierRows(suppliers);
    $('#newSupplierBtn').onclick = () => supplierModal();
    $('#supplierSearch').oninput = e => {
      const q = e.target.value.toLowerCase();
      const filtered = suppliers.filter(x => Object.values(x).join(' ').toLowerCase().includes(q));
      $('#supplierRows').innerHTML = supplierRows(filtered);
      bindSupplierRows(suppliers);
    };
  }

  function bindSupplierRows(all) {
    $$('[data-supplier-edit]').forEach(b => {
      b.onclick = () => {
        const item = all.find(x => x.supplierId === b.dataset.supplierEdit);
        if (item) supplierModal(item);
      };
    });
  }

  function supplierModal(existing=null) {
    openModal(existing ? 'Edit Supplier' : 'New Supplier', `
      <form id="supplierForm" class="form-grid">
        <label class="span-2">Supplier name<input name="name" required value="${escapeHtml(existing?.name || '')}"></label>
        <label>Category<input name="category" value="${escapeHtml(existing?.category || '')}" placeholder="Flowers / Lighting / Catering"></label>
        <label>Contact person<input name="contactPerson" value="${escapeHtml(existing?.contactPerson || '')}"></label>
        <label>Phone<input name="phone" value="${escapeHtml(existing?.phone || '')}"></label>
        <label>WhatsApp<input name="whatsapp" value="${escapeHtml(existing?.whatsapp || '')}"></label>
        <label>Email<input type="email" name="email" value="${escapeHtml(existing?.email || '')}"></label>
        <label>Status<select name="status">
          <option value="ACTIVE" ${existing?.status !== 'INACTIVE' ? 'selected' : ''}>Active</option>
          <option value="INACTIVE" ${existing?.status === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
        </select></label>
        <label class="span-2">Address<input name="address" value="${escapeHtml(existing?.address || '')}"></label>
        <label>Bank name<input name="bankName" value="${escapeHtml(existing?.bankName || '')}"></label>
        <label>Account name<input name="accountName" value="${escapeHtml(existing?.accountName || '')}"></label>
        <label class="span-2">Account number<input name="accountNumber" value="${escapeHtml(existing?.accountNumber || '')}"></label>
        <label class="span-2">Notes<textarea name="notes">${escapeHtml(existing?.notes || '')}</textarea></label>
        <div class="form-actions span-2">
          <button type="button" class="btn btn-ghost" data-ops-close>Cancel</button>
          <button id="supplierSaveBtn" class="btn btn-primary">${existing ? 'Save Changes' : 'Create Supplier'}</button>
        </div>
      </form>`);
    const form = $('#supplierForm');
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = $('#supplierSaveBtn');
      btn.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      if (existing) data.supplierId = existing.supplierId;
      try {
        await API.request(existing ? 'updateSupplier' : 'createSupplier', data);
        supplierCache = null;
        closeModal();
        toast(existing ? 'Supplier updated.' : 'Supplier created.');
        renderSuppliers();
      } catch (err) {
        btn.disabled = false;
        toast(err.message, 'error');
      }
    };
  }

  function payableSummaryCards(s) {
    return `<div class="metric-grid">
      <article class="metric-card"><span>Total Outstanding</span><strong>${money(s.totalOutstanding)}</strong></article>
      <article class="metric-card"><span>Supplier Payables</span><strong>${money(s.supplierOutstanding)}</strong></article>
      <article class="metric-card"><span>Owner Reimbursements</span><strong>${money(s.ownerOutstanding)}</strong></article>
      <article class="metric-card"><span>Team Reimbursements</span><strong>${money(s.teamOutstanding)}</strong></article>
    </div>`;
  }

  function payableRows(items) {
    if (!items.length) return '<tr><td colspan="9" class="empty">No payables found.</td></tr>';
    return items.map(p => `<tr>
      <td><b>${escapeHtml(p.partyName || '—')}</b><small>${escapeHtml(p.payableId)}</small></td>
      <td>${escapeHtml(displayStatus(p.type))}</td>
      <td>${escapeHtml(p.eventName || p.eventId || 'Business')}</td>
      <td class="money">${money(p.originalAmount)}</td>
      <td class="money">${money(p.paidAmount)}</td>
      <td class="money"><b>${money(p.outstanding)}</b></td>
      <td>${escapeHtml(p.dueDate || '—')} <button class="text-btn" data-payable-due="${escapeHtml(p.payableId)}">Edit</button></td>
      <td><span class="${statusClass(p.status)}">${escapeHtml(displayStatus(p.status))}</span></td>
      <td>${p.outstanding > 0 ? `<button class="btn btn-xs btn-primary" data-payable-pay="${escapeHtml(p.payableId)}">Settle</button>` : ''}</td>
    </tr>`).join('');
  }

  function reimbursementRows(items) {
    if (!items.length) return '<tr><td colspan="6" class="empty">No settlements recorded.</td></tr>';
    return items.map(r => `<tr>
      <td><b>${escapeHtml(r.reimbursementId)}</b><small>${escapeHtml(r.payableId)}</small></td>
      <td>${escapeHtml(r.partyName || r.partyId || '—')}</td>
      <td class="money">${money(r.amount)}</td>
      <td>${escapeHtml(displayStatus(r.method))}</td>
      <td>${escapeHtml(r.date || '—')}</td>
      <td>${escapeHtml(r.reference || '—')}</td>
    </tr>`).join('');
  }

  async function renderPayables() {
    payableBundle = await API.request('getPayablesBundle');
    $('#content').innerHTML = `
      ${payableSummaryCards(payableBundle.summary)}
      <div class="toolbar"><input id="payableSearch" class="search" placeholder="Search party, event, payable or type"></div>
      <section class="panel table-panel">
        <div class="panel-head"><div><p class="eyebrow">OUTSTANDING & SETTLED</p><h3>Payables</h3></div></div>
        <table><thead><tr><th>Party</th><th>Type</th><th>Event</th><th>Original</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Status</th><th></th></tr></thead>
        <tbody id="payableRows">${payableRows(payableBundle.payables)}</tbody></table>
      </section>
      <section class="panel table-panel">
        <div class="panel-head"><div><p class="eyebrow">PAYMENT HISTORY</p><h3>Settlements & Reimbursements</h3></div></div>
        <table><thead><tr><th>Record</th><th>Party</th><th>Amount</th><th>Method</th><th>Date</th><th>Reference</th></tr></thead>
        <tbody>${reimbursementRows(payableBundle.reimbursements)}</tbody></table>
      </section>`;
    bindPayables();
    $('#payableSearch').oninput = e => {
      const q = e.target.value.toLowerCase();
      const filtered = payableBundle.payables.filter(x => Object.values(x).join(' ').toLowerCase().includes(q));
      $('#payableRows').innerHTML = payableRows(filtered);
      bindPayables();
    };
  }

  function bindPayables() {
    $$('[data-payable-pay]').forEach(b => b.onclick = () => {
      const p = payableBundle.payables.find(x => x.payableId === b.dataset.payablePay);
      if (p) payablePaymentModal(p);
    });
    $$('[data-payable-due]').forEach(b => b.onclick = () => {
      const p = payableBundle.payables.find(x => x.payableId === b.dataset.payableDue);
      if (p) payableDueModal(p);
    });
  }

  function payablePaymentModal(p) {
    openModal('Record Payable Settlement', `
      <form id="payablePaymentForm" class="form-grid">
        <div class="span-2 summary-strip">
          <div><span>Party</span><strong>${escapeHtml(p.partyName || '—')}</strong></div>
          <div><span>Outstanding</span><strong>${money(p.outstanding)}</strong></div>
        </div>
        <label>Amount (LKR)<input type="number" name="amount" min="0.01" max="${Number(p.outstanding)}" step="0.01" value="${Number(p.outstanding)}" required></label>
        <label>Method<select name="method"><option>BANK</option><option>CASH</option><option>CARD</option><option>OTHER</option></select></label>
        <label>Date<input type="date" name="date" value="${today()}" required></label>
        <label>Reference<input name="reference" placeholder="Bank transfer/reference"></label>
        <div class="form-actions span-2">
          <button type="button" class="btn btn-ghost" data-ops-close>Cancel</button>
          <button id="payablePaymentBtn" class="btn btn-primary">Record Settlement</button>
        </div>
      </form>`);
    $('#payablePaymentForm').onsubmit = async e => {
      e.preventDefault();
      const btn = $('#payablePaymentBtn');
      btn.disabled = true;
      const data = Object.fromEntries(new FormData(e.target));
      data.payableId = p.payableId;
      try {
        await API.request('recordPayablePayment', data);
        closeModal();
        toast('Payable settlement recorded.');
        renderPayables();
      } catch (err) {
        btn.disabled = false;
        toast(err.message, 'error');
      }
    };
  }

  function payableDueModal(p) {
    openModal('Update Payable Due Date', `
      <form id="payableDueForm" class="form-grid">
        <label class="span-2">Due date<input type="date" name="dueDate" value="${escapeHtml(p.dueDate || '')}"></label>
        <div class="form-actions span-2">
          <button type="button" class="btn btn-ghost" data-ops-close>Cancel</button>
          <button class="btn btn-primary">Save Due Date</button>
        </div>
      </form>`);
    $('#payableDueForm').onsubmit = async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      data.payableId = p.payableId;
      try {
        await API.request('updatePayableDueDate', data);
        closeModal();
        toast('Due date updated.');
        renderPayables();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  }

  function inventoryRows(items) {
    if (!items.length) return '<tr><td colspan="8" class="empty">No inventory items found.</td></tr>';
    return items.map(i => `<tr>
      <td><b>${escapeHtml(i.itemName)}</b><small>${escapeHtml(i.inventoryCode || i.inventoryId)}</small></td>
      <td>${escapeHtml(i.mainCategory || '—')}${i.subCategory ? `<small>${escapeHtml(i.subCategory)}</small>` : ''}</td>
      <td>${Number(i.qtyOwned)}</td>
      <td><b>${Number(i.qtyAvailable)}</b></td>
      <td class="money">${money(i.internalCostPerUse)}</td>
      <td class="money">${money(i.defaultCustomerCharge)}</td>
      <td>${escapeHtml(i.condition || '—')}<small>${escapeHtml(displayStatus(i.status))}</small></td>
      <td><div class="row-actions">
        ${i.status === 'ACTIVE' && Number(i.qtyAvailable) > 0 ? `<button class="btn btn-xs btn-primary" data-inventory-allocate="${escapeHtml(i.inventoryId)}">Allocate</button>` : ''}
        <button class="btn btn-xs btn-secondary" data-inventory-edit="${escapeHtml(i.inventoryId)}">Edit</button>
      </div></td>
    </tr>`).join('');
  }

  function allocationRows(items) {
    if (!items.length) return '<tr><td colspan="8" class="empty">No inventory allocations.</td></tr>';
    return items.map(a => `<tr>
      <td><b>${escapeHtml(a.itemName || a.inventoryId)}</b><small>${escapeHtml(a.allocationId)}</small></td>
      <td>${escapeHtml(a.eventName || a.eventId)}</td>
      <td>${Number(a.qty)}</td>
      <td>${escapeHtml(a.fromDate || '—')}</td>
      <td>${escapeHtml(a.toDate || '—')}</td>
      <td class="money">${money(a.internalCost)}</td>
      <td class="money">${money(a.customerCharge)}</td>
      <td>${a.status === 'ALLOCATED' ? `<button class="btn btn-xs btn-secondary" data-inventory-return="${escapeHtml(a.allocationId)}">Mark Returned</button>` : `<span class="${statusClass(a.status)}">${escapeHtml(displayStatus(a.status))}</span>`}</td>
    </tr>`).join('');
  }

  async function renderInventory() {
    inventoryBundle = await API.request('getInventoryBundle');
    const s = inventoryBundle.summary;
    $('#content').innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Inventory Items</span><strong>${Number(s.itemCount)}</strong></article>
        <article class="metric-card"><span>Units Owned</span><strong>${Number(s.unitsOwned)}</strong></article>
        <article class="metric-card"><span>Units Available</span><strong>${Number(s.unitsAvailable)}</strong></article>
        <article class="metric-card"><span>Units Allocated</span><strong>${Number(s.unitsAllocated)}</strong></article>
      </div>
      <div class="toolbar">
        <input id="inventorySearch" class="search" placeholder="Search item, code or category">
        <button id="newInventoryBtn" class="btn btn-primary">+ New Inventory Item</button>
      </div>
      <section class="panel table-panel">
        <div class="panel-head"><div><p class="eyebrow">REUSABLE ASSETS</p><h3>Inventory</h3></div></div>
        <table><thead><tr><th>Item</th><th>Category</th><th>Owned</th><th>Available</th><th>Cost / Use</th><th>Customer Charge</th><th>Condition</th><th></th></tr></thead>
        <tbody id="inventoryRows">${inventoryRows(inventoryBundle.items)}</tbody></table>
      </section>
      <section class="panel table-panel">
        <div class="panel-head"><div><p class="eyebrow">EVENT USE</p><h3>Allocations</h3></div></div>
        <table><thead><tr><th>Item</th><th>Event</th><th>Qty</th><th>From</th><th>To</th><th>Internal Cost</th><th>Customer Charge</th><th>Status</th></tr></thead>
        <tbody>${allocationRows(inventoryBundle.allocations)}</tbody></table>
      </section>`;
    bindInventory();
    $('#newInventoryBtn').onclick = () => inventoryItemModal();
    $('#inventorySearch').oninput = e => {
      const q = e.target.value.toLowerCase();
      const filtered = inventoryBundle.items.filter(x => Object.values(x).join(' ').toLowerCase().includes(q));
      $('#inventoryRows').innerHTML = inventoryRows(filtered);
      bindInventory();
    };
  }

  function bindInventory() {
    $$('[data-inventory-edit]').forEach(b => b.onclick = () => {
      const item = inventoryBundle.items.find(x => x.inventoryId === b.dataset.inventoryEdit);
      if (item) inventoryItemModal(item);
    });
    $$('[data-inventory-allocate]').forEach(b => b.onclick = () => {
      const item = inventoryBundle.items.find(x => x.inventoryId === b.dataset.inventoryAllocate);
      if (item) inventoryAllocateModal(item);
    });
    $$('[data-inventory-return]').forEach(b => b.onclick = async () => {
      const allocationId = b.dataset.inventoryReturn;
      if (!window.confirm('Mark this inventory allocation as returned?')) return;
      try {
        await API.request('returnInventoryAllocation', {allocationId});
        toast('Inventory returned.');
        renderInventory();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  function inventoryItemModal(existing=null) {
    openModal(existing ? 'Edit Inventory Item' : 'New Inventory Item', `
      <form id="inventoryItemForm" class="form-grid">
        <label class="span-2">Item name<input name="itemName" required value="${escapeHtml(existing?.itemName || '')}"></label>
        <label>Inventory code<input name="inventoryCode" value="${escapeHtml(existing?.inventoryCode || '')}" placeholder="e.g. DE-UMB-001"></label>
        <label>Main category<input name="mainCategory" value="${escapeHtml(existing?.mainCategory || '')}" placeholder="Decoration"></label>
        <label>Sub category<input name="subCategory" value="${escapeHtml(existing?.subCategory || '')}" placeholder="Umbrella"></label>
        <label>Quantity owned<input type="number" min="0" step="1" name="qtyOwned" required value="${Number(existing?.qtyOwned ?? 1)}"></label>
        <label>Internal cost per event/use (LKR)<input type="number" min="0" step="0.01" name="internalCostPerUse" value="${Number(existing?.internalCostPerUse || 0)}"></label>
        <label>Default customer charge / use (LKR)<input type="number" min="0" step="0.01" name="defaultCustomerCharge" value="${Number(existing?.defaultCustomerCharge || 0)}"></label>
        <label>Condition<select name="condition">
          ${['EXCELLENT','GOOD','FAIR','REPAIR_NEEDED'].map(v => `<option value="${v}" ${v === (existing?.condition || 'GOOD') ? 'selected' : ''}>${displayStatus(v)}</option>`).join('')}
        </select></label>
        <label>Status<select name="status">
          <option value="ACTIVE" ${existing?.status !== 'INACTIVE' ? 'selected' : ''}>Active</option>
          <option value="INACTIVE" ${existing?.status === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
        </select></label>
        <label>Storage location<input name="storageLocation" value="${escapeHtml(existing?.storageLocation || '')}"></label>
        <label>Purchase date<input type="date" name="purchaseDate" value="${escapeHtml(existing?.purchaseDate || '')}"></label>
        <label>Purchase cost (LKR)<input type="number" min="0" step="0.01" name="purchaseCost" value="${Number(existing?.purchaseCost || 0)}"></label>
        <div class="form-actions span-2">
          <button type="button" class="btn btn-ghost" data-ops-close>Cancel</button>
          <button id="inventoryItemSaveBtn" class="btn btn-primary">${existing ? 'Save Changes' : 'Create Item'}</button>
        </div>
      </form>`);
    $('#inventoryItemForm').onsubmit = async e => {
      e.preventDefault();
      const btn = $('#inventoryItemSaveBtn');
      btn.disabled = true;
      const data = Object.fromEntries(new FormData(e.target));
      if (existing) data.inventoryId = existing.inventoryId;
      try {
        await API.request(existing ? 'updateInventoryItem' : 'createInventoryItem', data);
        closeModal();
        toast(existing ? 'Inventory item updated.' : 'Inventory item created.');
        renderInventory();
      } catch (err) {
        btn.disabled = false;
        toast(err.message, 'error');
      }
    };
  }

  async function inventoryAllocateModal(item) {
    let events;
    try { events = await API.request('listEvents'); }
    catch (err) { toast(err.message, 'error'); return; }
    const options = events.filter(e => !['CANCELLED','FINANCIALLY_CLOSED'].includes(e.status))
      .map(e => `<option value="${escapeHtml(e.eventId)}">${escapeHtml(e.eventId)} — ${escapeHtml(e.name)} — ${escapeHtml(e.date || '')}</option>`).join('');
    openModal('Allocate Inventory to Event', `
      <form id="inventoryAllocateForm" class="form-grid">
        <div class="span-2 summary-strip">
          <div><span>Item</span><strong>${escapeHtml(item.itemName)}</strong></div>
          <div><span>Available</span><strong>${Number(item.qtyAvailable)}</strong></div>
        </div>
        <label class="span-2">Event<select name="eventId" required><option value="">Select event</option>${options}</select></label>
        <label>Quantity<input type="number" min="1" max="${Number(item.qtyAvailable)}" step="1" name="qty" value="1" required></label>
        <label>Internal cost (LKR)<input type="number" min="0" step="0.01" name="internalCost" value="${Number(item.internalCostPerUse || 0)}"></label>
        <label>From date<input type="date" name="fromDate"></label>
        <label>To date<input type="date" name="toDate"></label>
        <label class="span-2">Customer charge (LKR)<input type="number" min="0" step="0.01" name="customerCharge" value="${Number(item.defaultCustomerCharge || 0)}"></label>
        <div class="form-actions span-2">
          <button type="button" class="btn btn-ghost" data-ops-close>Cancel</button>
          <button id="inventoryAllocateBtn" class="btn btn-primary">Allocate</button>
        </div>
      </form>`);
    const form = $('#inventoryAllocateForm');
    const qty = form.elements.qty;
    const internalCost = form.elements.internalCost;
    const customerCharge = form.elements.customerCharge;
    qty.oninput = () => {
      const q = Number(qty.value || 0);
      internalCost.value = (q * Number(item.internalCostPerUse || 0)).toFixed(2);
      customerCharge.value = (q * Number(item.defaultCustomerCharge || 0)).toFixed(2);
    };
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = $('#inventoryAllocateBtn');
      btn.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      data.inventoryId = item.inventoryId;
      try {
        await API.request('allocateInventory', data);
        closeModal();
        toast('Inventory allocated to event.');
        renderInventory();
      } catch (err) {
        btn.disabled = false;
        toast(err.message, 'error');
      }
    };
  }

  async function enhanceExpenseSupplier(form) {
    if (!form || form.dataset.supplierEnhanced === '1') return;
    form.dataset.supplierEnhanced = '1';

    const paidFrom = form.querySelector('[name="paidFrom"]');
    if (!paidFrom) return;

    const label = document.createElement('label');
    label.id = 'expenseSupplierField';
    label.className = 'hidden';
    label.innerHTML = `Supplier
      <select name="supplierId"><option value="">Select supplier</option></select>
      <small>Required when Credit / Pay Later is selected.</small>`;
    paidFrom.closest('label')?.insertAdjacentElement('afterend', label);

    const select = label.querySelector('select');
    try {
      const suppliers = (await loadSuppliers()).filter(s => s.status === 'ACTIVE');
      suppliers.forEach(s => {
        const o = document.createElement('option');
        o.value = s.supplierId;
        o.textContent = `${s.name}${s.category ? ' — ' + s.category : ''}`;
        select.appendChild(o);
      });
    } catch (_) {}

    const sync = () => {
      const credit = paidFrom.value === 'CREDIT_PAY_LATER';
      label.classList.toggle('hidden', !credit);
      select.disabled = !credit;
      select.required = credit;
    };
    paidFrom.addEventListener('change', sync);
    sync();
  }

  function installExpenseObserver() {
    const modalBody = $('#modalBody');
    if (!modalBody) return;
    const observer = new MutationObserver(() => {
      const form = $('#expenseForm');
      if (form) enhanceExpenseSupplier(form);
    });
    observer.observe(modalBody, {childList:true, subtree:true});
  }

  ensureSupplierNav();
  installRouteInterception();
  installExpenseObserver();
})();