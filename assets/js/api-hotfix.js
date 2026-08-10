(() => {
  const API = window.DE_API;
  const CFG = window.DREAM_EVENTS_CONFIG;
  if (!API || !CFG || CFG.DEMO_MODE) return;

  const pending = new Map();
  const paymentWorkspaceCache = new Map();
  const PAYMENT_SLICES = {
    listInvoices: 'invoices',
    listPaymentPlans: 'paymentPlans',
    listPayments: 'payments',
    listReceipts: 'receipts'
  };
  const MUTATING_ACTIONS = new Set([
    'createInvoiceFromQuotation',
    'createPaymentPlan',
    'recordPayment',
    'updateQuotationStatus',
    'createExpense',
    'approveExpense',
    'rejectExpense',
    'createIncome',
    'createEvent',
    'updateEvent'
  ]);

  function uid(prefix = 'REQ') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function cleanup(requestId) {
    const item = pending.get(requestId);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(requestId);
    try { item.form?.remove(); } catch (_) {}
    try { item.iframe?.remove(); } catch (_) {}
  }

  function bridgeRequest(action, payload = {}) {
    if (!CFG.API_URL) return Promise.reject(new Error('Apps Script API URL is not configured.'));

    const requestId = uid();
    const frameName = `apiBridge_${requestId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const token = API.getSession()?.token || '';

    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.title = 'API request';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.position = 'fixed';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = '0';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = CFG.API_URL;
      form.target = frameName;
      form.style.display = 'none';

      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = 'payload';
      field.value = JSON.stringify({
        requestId,
        action,
        token,
        data: payload,
        clientOrigin: location.origin
      });
      form.appendChild(field);

      const timer = setTimeout(() => {
        cleanup(requestId);
        reject(new Error('The server did not respond in time.'));
      }, 30000);

      pending.set(requestId, { resolve, reject, timer, iframe, form });
      document.body.appendChild(iframe);
      document.body.appendChild(form);

      try {
        form.submit();
      } catch (err) {
        cleanup(requestId);
        reject(err);
      }
    });
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    if (!msg || msg.source !== 'dream-events-api' || !msg.requestId) return;
    const item = pending.get(msg.requestId);
    if (!item) return;

    const { resolve, reject } = item;
    cleanup(msg.requestId);
    if (msg.ok) resolve(msg);
    else reject(new Error(msg.error || 'Request failed.'));
  });

  function clearPaymentWorkspaceCache() {
    paymentWorkspaceCache.clear();
  }

  async function getPaymentWorkspace(eventId) {
    const key = String(eventId || '');
    if (!key) throw new Error('Event is required.');

    const existing = paymentWorkspaceCache.get(key);
    if (existing && Date.now() - existing.createdAt < 2000) return existing.promise;

    const entry = {
      createdAt: Date.now(),
      promise: bridgeRequest('listInvoices', { eventId: key, workspace: true })
        .then(res => res.data)
    };
    paymentWorkspaceCache.set(key, entry);

    entry.promise.catch(() => {
      if (paymentWorkspaceCache.get(key) === entry) paymentWorkspaceCache.delete(key);
    });

    setTimeout(() => {
      if (paymentWorkspaceCache.get(key) === entry) paymentWorkspaceCache.delete(key);
    }, 2500);

    return entry.promise;
  }

  API.request = async function request(action, data = {}) {
    const slice = PAYMENT_SLICES[action];
    if (slice && data && data.eventId && !data.invoiceId) {
      const workspace = await getPaymentWorkspace(data.eventId);
      return workspace[slice] || [];
    }

    const res = await bridgeRequest(action, data);
    if (MUTATING_ACTIONS.has(action)) clearPaymentWorkspaceCache();
    return res.data;
  };
})();
