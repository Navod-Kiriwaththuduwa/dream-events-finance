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
  if (action === 'createEvent') return createEvent_(user, data);
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
  const target = (clientOrigin && (!allowed || clientOrigin === allowed)) ? clientOrigin : (allowed || '*');
  const json = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const targetJson = JSON.stringify(target);
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.parent.postMessage(' + json + ',' + targetJson + ');<\/script></body></html>');
}

function validateOrigin_(origin) {
  const allowed = getAllowedOrigin_();
  if (!allowed) throw new Error('Frontend origin is not configured on the server.');
  if (origin !== allowed) throw new Error('Origin is not allowed.');
}
function getAllowedOrigin_(){ return PropertiesService.getScriptProperties().getProperty(DE.ALLOWED_ORIGIN_PROP) || ''; }
function safeError_(err){ return err && err.message ? String(err.message).slice(0,500) : 'Server error.'; }
