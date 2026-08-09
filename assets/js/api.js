(() => {
  const config = window.DREAM_EVENTS_CONFIG;
  const pending = new Map();
  let mockState = null;

  function uid(prefix='REQ') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }

  function bridgeRequest(action, payload = {}) {
    if (!config.API_URL) return Promise.reject(new Error('Apps Script API URL is not configured.'));
    const requestId = uid();
    const token = getSession()?.token || '';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('The server did not respond.'));
      }, 20000);
      pending.set(requestId, { resolve, reject, timer });

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = config.API_URL;
      form.target = 'apiBridge';
      form.style.display = 'none';
      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = 'payload';
      field.value = JSON.stringify({ requestId, action, token, data: payload, clientOrigin: location.origin });
      form.appendChild(field);
      document.body.appendChild(form);
      form.submit();
      setTimeout(() => form.remove(), 1000);
    });
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.source !== 'dream-events-api' || !msg.requestId) return;
    const item = pending.get(msg.requestId);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(msg.requestId);
    if (msg.ok) item.resolve(msg);
    else item.reject(new Error(msg.error || 'Request failed.'));
  });

  function getSession() {
    try { return JSON.parse(localStorage.getItem(config.SESSION_KEY) || 'null'); }
    catch { return null; }
  }
  function setSession(value) {
    if (value) localStorage.setItem(config.SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(config.SESSION_KEY);
  }

  function initMock() {
    const saved = localStorage.getItem('dream_events_demo_db_v1');
    if (saved) {
      try { mockState = JSON.parse(saved); return; } catch {}
    }
    mockState = {
      users: [
        { userId:'USR-00001', username:'finance', password:'demo123', fullName:'Finance Head', role:'FINANCE_HEAD', status:'ACTIVE' },
        { userId:'USR-00002', username:'team', password:'demo123', fullName:'Team Member', role:'TEAM_MEMBER', status:'ACTIVE' }
      ],
      customers: [
        { customerId:'DE-CUS-0001', name:'Kasun Perera', mobile:'0771234567', whatsapp:'0771234567', email:'', source:'Referral', status:'ACTIVE', createdAt:new Date().toISOString() },
        { customerId:'DE-CUS-0002', name:'Amanda Silva', mobile:'0718884433', whatsapp:'0718884433', email:'', source:'Instagram', status:'ACTIVE', createdAt:new Date().toISOString() }
      ],
      events: [
        { eventId:'DE-EVT-2026-0001', name:'Kasun & Amanda Proposal', type:'Marriage Proposal', customerId:'DE-CUS-0001', customerName:'Kasun Perera', date:'2026-09-26', venue:'Negombo', status:'CONFIRMED', confirmedValue:185000, createdAt:new Date().toISOString() },
        { eventId:'DE-EVT-2026-0002', name:'Birthday Celebration', type:'Birthday', customerId:'DE-CUS-0002', customerName:'Amanda Silva', date:'2026-08-28', venue:'Colombo', status:'PLANNING', confirmedValue:125000, createdAt:new Date().toISOString() }
      ],
      expenses:[
        { expenseId:'DE-EXP-2026-000001', eventId:'DE-EVT-2026-0001', category:'Flowers', description:'Initial flower purchase', amount:24500, paidFrom:'OWNER_PERSONAL', status:'PENDING', submittedBy:'Team Member', date:'2026-08-09' }
      ],
      income:[
        { incomeId:'DE-INC-2026-000001', eventId:'DE-EVT-2026-0001', type:'EVENT_ADVANCE', amount:50000, method:'BANK', status:'APPROVED', date:'2026-08-09' }
      ]
    };
    saveMock();
  }
  function saveMock(){ localStorage.setItem('dream_events_demo_db_v1', JSON.stringify(mockState)); }
  function nextId(kind, prefix) {
    const all = mockState[kind] || [];
    return `${prefix}${String(all.length + 1).padStart(prefix.includes('2026') ? 6 : 4,'0')}`;
  }

  async function mockRequest(action, data={}) {
    if (!mockState) initMock();
    await new Promise(r => setTimeout(r, 120));
    const session = getSession();
    const finance = session?.user?.role === 'FINANCE_HEAD';
    if (action === 'login') {
      const u = mockState.users.find(x => x.username.toLowerCase() === String(data.username||'').toLowerCase() && x.password === data.password && x.status === 'ACTIVE');
      if (!u) throw new Error('Invalid username or password.');
      const result = { token:uid('DEMO'), user:{ userId:u.userId, username:u.username, fullName:u.fullName, role:u.role } };
      setSession(result);
      return { ok:true, data:result };
    }
    if (action === 'logout') { setSession(null); return {ok:true,data:true}; }
    if (!session) throw new Error('Please sign in.');
    if (action === 'me') return {ok:true,data:session.user};
    if (action === 'dashboard') {
      const approvedExpense = mockState.expenses.filter(x=>x.status==='APPROVED').reduce((a,b)=>a+Number(b.amount||0),0);
      const revenue = mockState.income.filter(x=>x.status==='APPROVED').reduce((a,b)=>a+Number(b.amount||0),0);
      return {ok:true,data:{ activeEvents:mockState.events.filter(x=>!['COMPLETED','CANCELLED','FINANCIALLY_CLOSED'].includes(x.status)).length, revenue, expenses:approvedExpense, eventProfit:finance?revenue-approvedExpense:null, receivables:mockState.events.reduce((a,b)=>a+Number(b.confirmedValue||0),0)-revenue, supplierPayables:0, ownerPayable:mockState.expenses.filter(x=>x.status==='APPROVED'&&x.paidFrom==='OWNER_PERSONAL').reduce((a,b)=>a+Number(b.amount||0),0), teamPayable:0, pendingApprovals:mockState.expenses.filter(x=>x.status==='PENDING').length, upcomingEvents:mockState.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5) }};
    }
    if (action === 'listCustomers') return {ok:true,data:mockState.customers.slice().reverse()};
    if (action === 'createCustomer') {
      if (!finance) throw new Error('Finance Head access required.');
      const rec={ customerId:`DE-CUS-${String(mockState.customers.length+1).padStart(4,'0')}`, name:data.name, mobile:data.mobile||'', whatsapp:data.whatsapp||'', email:data.email||'', source:data.source||'', notes:data.notes||'', status:'ACTIVE', createdAt:new Date().toISOString() };
      mockState.customers.push(rec); saveMock(); return {ok:true,data:rec};
    }
    if (action === 'listEvents') return {ok:true,data:mockState.events.slice().sort((a,b)=>b.date.localeCompare(a.date))};
    if (action === 'createEvent') {
      if (!finance) throw new Error('Finance Head access required.');
      const customer=mockState.customers.find(x=>x.customerId===data.customerId);
      const rec={ eventId:`DE-EVT-2026-${String(mockState.events.length+1).padStart(4,'0')}`, name:data.name, type:data.type, customerId:data.customerId, customerName:customer?.name||'', date:data.date, venue:data.venue||'', guestCount:Number(data.guestCount||0), status:data.status||'INQUIRY', confirmedValue:Number(data.confirmedValue||0), notes:data.notes||'', createdAt:new Date().toISOString() };
      mockState.events.push(rec); saveMock(); return {ok:true,data:rec};
    }
    if (action === 'listExpenses') return {ok:true,data:mockState.expenses.slice().reverse()};
    if (action === 'createExpense') {
      const rec={ expenseId:`DE-EXP-2026-${String(mockState.expenses.length+1).padStart(6,'0')}`, eventId:data.eventId||'', category:data.category||'Other', description:data.description||'', amount:Number(data.amount||0), paidFrom:data.paidFrom||'DREAM_EVENTS_CASH', status: finance ? 'APPROVED' : 'PENDING', submittedBy:session.user.fullName, date:data.date||new Date().toISOString().slice(0,10), attachmentName:data.attachmentName||'' };
      mockState.expenses.push(rec); saveMock(); return {ok:true,data:rec};
    }
    if (action === 'approveExpense') {
      if (!finance) throw new Error('Finance Head access required.');
      const rec=mockState.expenses.find(x=>x.expenseId===data.expenseId); if(!rec) throw new Error('Expense not found.'); rec.status='APPROVED'; rec.approvedBy=session.user.fullName; saveMock(); return {ok:true,data:rec};
    }
    if (action === 'rejectExpense') {
      if (!finance) throw new Error('Finance Head access required.');
      const rec=mockState.expenses.find(x=>x.expenseId===data.expenseId); if(!rec) throw new Error('Expense not found.'); rec.status='REJECTED'; rec.rejectionReason=data.reason||''; saveMock(); return {ok:true,data:rec};
    }
    if (action === 'listIncome') return {ok:true,data:mockState.income.slice().reverse()};
    if (action === 'createIncome') {
      const rec={ incomeId:`DE-INC-2026-${String(mockState.income.length+1).padStart(6,'0')}`, eventId:data.eventId||'', type:data.type||'EVENT_PAYMENT', amount:Number(data.amount||0), method:data.method||'CASH', reference:data.reference||'', status:finance?'APPROVED':'PENDING', submittedBy:session.user.fullName, date:data.date||new Date().toISOString().slice(0,10) };
      mockState.income.push(rec); saveMock(); return {ok:true,data:rec};
    }
    throw new Error(`Demo action not implemented: ${action}`);
  }

  async function request(action, data={}) {
    const res = config.DEMO_MODE ? await mockRequest(action,data) : await bridgeRequest(action,data);
    return res.data;
  }

  window.DE_API = { request, getSession, setSession, initMock };
})();
