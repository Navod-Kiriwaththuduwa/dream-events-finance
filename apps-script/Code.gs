const DE = {
  APP: 'Dream Events Finance',
  DB_PROP: 'DREAM_EVENTS_DB_ID',
  DRIVE_PROP: 'DREAM_EVENTS_DRIVE_FOLDER_ID',
  SESSION_HOURS: 8,
  ALLOWED_ORIGIN_PROP: 'DREAM_EVENTS_FRONTEND_ORIGIN'
};

function doGet() {
  return HtmlService.createHtmlOutput('<h2>Dream Events Finance API</h2><p>API is online.</p>');
}

function doPost(e) {
  let requestId = '';
  let clientOrigin = '';
  try {
    const envelope = JSON.parse((e && e.parameter && e.parameter.payload) || '{}');
    requestId = String(envelope.requestId || '');
    clientOrigin = String(envelope.clientOrigin || '');
    validateOrigin_(clientOrigin);
    const data = routeRequest_(envelope);
    return bridgeOutput_({ source:'dream-events-api', requestId:requestId, ok:true, data:data }, clientOrigin);
  } catch (err) {
    return bridgeOutput_({ source:'dream-events-api', requestId:requestId, ok:false, error:safeError_(err) }, clientOrigin);
  }
}

function routeRequest_(req) {
  const action = String(req.action || '');
  const data = req.data || {};
  if (action === 'login') return login_(data);
  if (action === 'health') return {app:DE.APP, ok:true, now:new Date().toISOString()};
  const user = requireSession_(req.token);
  if (action === 'logout') return logout_(req.token, user);
  if (action === 'me') return publicUser_(user);
  if (action === 'dashboard') return dashboard_(user);
  if (action === 'listCustomers') return listCustomers_(user);
  if (action === 'createCustomer') return createCustomer_(user, data);
  if (action === 'listEvents') return listEvents_(user);
  if (action === 'getEvent') return getEvent_(user, data);
  if (action === 'createEvent') return createEvent_(user, data);
  if (action === 'updateEvent') return updateEvent_(user, data);
  if (action === 'getBudget') return getBudget_(user, data);
  if (action === 'listBudgetTargets') return listBudgetTargets_(user, data);
  if (action === 'createBudgetLine') return createBudgetLine_(user, data);
  if (action === 'updateBudgetLine') return updateBudgetLine_(user, data);
  if (action === 'moveBudgetLine') return moveBudgetLine_(user, data);
  if (action === 'duplicateBudgetLine') return duplicateBudgetLine_(user, data);
  if (action === 'deleteBudgetLine') return deleteBudgetLine_(user, data);
  if (action === 'quotationDraftFromBudget') return quotationDraftFromBudget_(user, data);
  if (action === 'listQuotations') return listQuotations_(user, data);
  if (action === 'getQuotation') return getQuotation_(user, data);
  if (action === 'createQuotation') return createQuotation_(user, data);
  if (action === 'updateQuotationStatus') return updateQuotationStatus_(user, data);
  if (action === 'listInvoices') return listInvoices_(user, data);
  if (action === 'getInvoice') return getInvoice_(user, data);
  if (action === 'createInvoiceFromQuotation') return createInvoiceFromQuotation_(user, data);
  if (action === 'listPaymentPlans') return listPaymentPlans_(user, data);
  if (action === 'createPaymentPlan') return createPaymentPlan_(user, data);
  if (action === 'listPayments') return listPayments_(user, data);
  if (action === 'recordPayment') return recordPayment_(user, data);
  if (action === 'listReceipts') return listReceipts_(user, data);
  if (action === 'getReceipt') return getReceipt_(user, data);
  if (action === 'listExpenses') return listExpenses_(user);
  if (action === 'createExpense') return createExpense_(user, data);
  if (action === 'approveExpense') return approveExpense_(user, data);
  if (action === 'rejectExpense') return rejectExpense_(user, data);
  if (action === 'listIncome') return listIncome_(user);
  if (action === 'createIncome') return createIncome_(user, data);
  throw new Error('Unknown action: ' + action);
}

function bridgeOutput_(payload, clientOrigin) {
  const allowed = getAllowedOrigin_();

  const target =
    (clientOrigin && (!allowed || clientOrigin === allowed))
      ? clientOrigin
      : (allowed || '*');

  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  const targetJson = JSON.stringify(target);

  const html =
    '<!doctype html>' +
    '<html>' +
    '<head><meta charset="utf-8"></head>' +
    '<body>' +
    '<script>' +
    'window.top.postMessage(' + json + ',' + targetJson + ');' +
    '</script>' +
    '</body>' +
    '</html>';

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function validateOrigin_(origin) {
  const allowed = getAllowedOrigin_();
  if (!allowed) throw new Error('Frontend origin is not configured on the server.');
  if (origin !== allowed) throw new Error('Origin is not allowed.');
}
function getAllowedOrigin_(){ return PropertiesService.getScriptProperties().getProperty(DE.ALLOWED_ORIGIN_PROP) || ''; }
function safeError_(err){ return err && err.message ? String(err.message).slice(0,500) : 'Server error.'; }
