(() => {
  const API = window.DE_API;
  const CFG = window.DREAM_EVENTS_CONFIG;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let session = API.getSession();
  let state = { route:'dashboard', customers:[], events:[], expenses:[], income:[] };

  const money = v => `${CFG.CURRENCY} ${Number(v||0).toLocaleString('en-LK')}`;
  const escapeHtml = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const statusClass = s => `status ${String(s||'').toLowerCase().replaceAll('_','-')}`;

  function toast(message, type='ok') {
    const el=$('#toast'); el.textContent=message; el.className=`toast show ${type}`; setTimeout(()=>el.className='toast',2600);
  }
  function showModal(title, html) { $('#modalTitle').textContent=title; $('#modalBody').innerHTML=html; $('#modal').classList.remove('hidden'); }
  function closeModal(){ $('#modal').classList.add('hidden'); }

  function syncRoleUI(){
    const role=session?.user?.role;
    $$('.finance-only').forEach(el=>el.classList.toggle('hidden', role!=='FINANCE_HEAD'));
    $('#userMini').innerHTML=session?`<strong>${escapeHtml(session.user.fullName)}</strong><span>${role==='FINANCE_HEAD'?'Finance Head':'Team Member'}</span>`:'';
  }

  async function login(e){
    e.preventDefault();
    try {
      const data=await API.request('login',{ username:$('#username').value.trim(), password:$('#password').value });
      session={token:data.token,user:data.user}; API.setSession(session); boot();
    } catch(err){ toast(err.message,'error'); }
  }
  async function logout(){ try{await API.request('logout');}catch{} API.setSession(null); session=null; $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); $('#password').value=''; }

  async function boot(){
    if(!session){ $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); return; }
    $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); syncRoleUI(); await navigate('dashboard');
  }

  async function navigate(route){
    if(session?.user?.role!=='FINANCE_HEAD' && ['approvals','sales','inventory','payables','reports','admin'].includes(route)) route='dashboard';
    state.route=route; $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===route));
    const titles={dashboard:'Dashboard',events:'Events',customers:'Customers',expenses:'Expenses',income:'Income',approvals:'Approval Queue',sales:'Sales Documents',inventory:'Inventory',payables:'Payables',reports:'Reports',admin:'Administration'};
    $('#pageTitle').textContent=titles[route]||route;
    $('#content').innerHTML='<div class="loading">Loading…</div>';
    try {
      if(route==='dashboard') return renderDashboard(await API.request('dashboard'));
      if(route==='customers') { state.customers=await API.request('listCustomers'); return renderCustomers(); }
      if(route==='events') { state.events=await API.request('listEvents'); state.customers=await API.request('listCustomers'); return renderEvents(); }
      if(route==='expenses'||route==='approvals') { state.expenses=await API.request('listExpenses'); state.events=await API.request('listEvents'); return renderExpenses(route==='approvals'); }
      if(route==='income') { state.income=await API.request('listIncome'); state.events=await API.request('listEvents'); return renderIncome(); }
      renderComingSoon(titles[route]);
    } catch(err){ $('#content').innerHTML=`<div class="empty error-box"><h3>Unable to load</h3><p>${escapeHtml(err.message)}</p></div>`; }
  }

  function card(label,value,sub='') { return `<article class="metric-card"><span>${label}</span><strong>${value}</strong>${sub?`<small>${sub}</small>`:''}</article>`; }
  function renderDashboard(d){
    $('#approvalBadge').textContent=d.pendingApprovals||0;
    const finance=session.user.role==='FINANCE_HEAD';
    $('#content').innerHTML=`
      <div class="hero-card"><div><p class="eyebrow">FINANCIAL CONTROL CENTER</p><h3>${finance?'Business overview':'Team workspace'}</h3><p>${finance?'Monitor events, cash, approvals and liabilities.':'Record event money accurately. Profit and margin information is restricted.'}</p></div><button class="btn btn-light" data-go="events">View events</button></div>
      <div class="metric-grid">
        ${card('Active Events',d.activeEvents)}
        ${card(finance?'Revenue':'Approved Income',money(d.revenue))}
        ${card('Approved Expenses',money(d.expenses))}
        ${finance?card('Event Profit',money(d.eventProfit)):card('Pending Approvals',d.pendingApprovals)}
        ${finance?card('Receivables',money(d.receivables)):''}
        ${finance?card('Owner Payable',money(d.ownerPayable)):''}
        ${finance?card('Supplier Payables',money(d.supplierPayables)):''}
        ${finance?card('Team Payables',money(d.teamPayable)):''}
      </div>
      <div class="section-grid">
        <section class="panel"><div class="panel-head"><div><p class="eyebrow">UPCOMING</p><h3>Events</h3></div><button class="text-btn" data-go="events">All events</button></div>${eventMiniList(d.upcomingEvents||[])}</section>
        <section class="panel"><div class="panel-head"><div><p class="eyebrow">ACTION</p><h3>Needs attention</h3></div></div>
          <div class="attention-list"><div><span class="dot amber"></span><b>${d.pendingApprovals||0}</b> transaction(s) awaiting approval</div>${finance?`<div><span class="dot red"></span><b>${money(d.receivables)}</b> customer receivables</div><div><span class="dot blue"></span><b>${money((d.ownerPayable||0)+(d.teamPayable||0))}</b> personal funds to reimburse</div>`:''}</div>
        </section>
      </div>`;
    bindRouteLinks();
  }
  function eventMiniList(items){ if(!items.length)return '<div class="empty">No upcoming events.</div>'; return `<div class="mini-list">${items.map(e=>`<div class="mini-row"><div><strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(e.customerName||'')}</span></div><div class="right"><strong>${escapeHtml(e.date)}</strong><span class="${statusClass(e.status)}">${escapeHtml(e.status)}</span></div></div>`).join('')}</div>`; }

  function renderCustomers(){
    const finance=session.user.role==='FINANCE_HEAD';
    $('#content').innerHTML=`<div class="toolbar"><input id="customerSearch" class="search" placeholder="Search customer, phone or email"><div>${finance?'<button id="newCustomerBtn" class="btn btn-primary">+ New Customer</button>':''}</div></div><section class="panel table-panel"><table><thead><tr><th>Customer</th><th>Mobile</th><th>WhatsApp</th><th>Source</th><th>Status</th></tr></thead><tbody id="customerRows"></tbody></table></section>`;
    drawCustomerRows(state.customers); $('#customerSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();drawCustomerRows(state.customers.filter(c=>[c.name,c.mobile,c.email,c.customerId].join(' ').toLowerCase().includes(q)));});
    $('#newCustomerBtn')?.addEventListener('click',newCustomerModal);
  }
  function drawCustomerRows(items){ $('#customerRows').innerHTML=items.length?items.map(c=>`<tr><td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.customerId)}</small></td><td>${escapeHtml(c.mobile)}</td><td>${escapeHtml(c.whatsapp||'—')}</td><td>${escapeHtml(c.source||'—')}</td><td><span class="${statusClass(c.status)}">${escapeHtml(c.status)}</span></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No customers found.</td></tr>'; }
  function newCustomerModal(){ showModal('New Customer',`<form id="customerForm" class="form-grid"><label class="span-2">Customer name<input name="name" required></label><label>Mobile<input name="mobile" required></label><label>WhatsApp<input name="whatsapp"></label><label>Email<input type="email" name="email"></label><label>Source<select name="source"><option>Referral</option><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>Website</option><option>Walk-in</option><option>Other</option></select></label><label class="span-2">Notes<textarea name="notes"></textarea></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Create Customer</button></div></form>`); $('#customerForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await API.request('createCustomer',data);closeModal();toast('Customer created.');navigate('customers');}catch(err){toast(err.message,'error')}}); bindModalCloseButtons(); }

  function renderEvents(){
    const finance=session.user.role==='FINANCE_HEAD';
    $('#content').innerHTML=`<div class="toolbar"><input id="eventSearch" class="search" placeholder="Search event, customer, venue, status">${finance?'<button id="newEventBtn" class="btn btn-primary">+ New Event</button>':''}</div><div class="event-cards" id="eventCards"></div>`;
    drawEventCards(state.events); $('#eventSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();drawEventCards(state.events.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q)));}); $('#newEventBtn')?.addEventListener('click',newEventModal);
  }
  function drawEventCards(items){ $('#eventCards').innerHTML=items.length?items.map(e=>`<article class="event-card"><div class="event-card-top"><span class="${statusClass(e.status)}">${escapeHtml(e.status)}</span><small>${escapeHtml(e.eventId)}</small></div><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.customerName||'')} · ${escapeHtml(e.type||'Event')}</p><div class="event-meta"><span>📅 ${escapeHtml(e.date)}</span><span>📍 ${escapeHtml(e.venue||'TBC')}</span></div>${session.user.role==='FINANCE_HEAD'?`<div class="event-value"><span>Confirmed value</span><strong>${money(e.confirmedValue)}</strong></div>`:''}</article>`).join(''):'<div class="empty panel">No events found.</div>'; }
  function newEventModal(){ const opts=state.customers.map(c=>`<option value="${escapeHtml(c.customerId)}">${escapeHtml(c.name)} — ${escapeHtml(c.mobile)}</option>`).join(''); showModal('Create Event',`<form id="eventForm" class="form-grid"><label class="span-2">Event name<input name="name" required placeholder="e.g. Kasun & Amanda Proposal"></label><label>Event type<select name="type"><option>Marriage Proposal</option><option>Wedding</option><option>Birthday</option><option>Anniversary</option><option>Corporate Event</option><option>Other</option></select></label><label>Customer<select name="customerId" required><option value="">Select customer</option>${opts}</select></label><label>Event date<input type="date" name="date" required></label><label>Venue<input name="venue"></label><label>Guest count<input type="number" min="0" name="guestCount"></label><label>Status<select name="status"><option>INQUIRY</option><option>PLANNING</option><option>QUOTATION</option><option>CONFIRMED</option><option>PREPARATION</option></select></label><label>Confirmed value<input type="number" min="0" name="confirmedValue"></label><label class="span-2">Notes<textarea name="notes"></textarea></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Create Event</button></div></form>`); $('#eventForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await API.request('createEvent',data);closeModal();toast('Event created.');navigate('events');}catch(err){toast(err.message,'error')}});bindModalCloseButtons(); }

  function renderExpenses(approvalsOnly=false){ const items=approvalsOnly?state.expenses.filter(x=>x.status==='PENDING'):state.expenses; $('#content').innerHTML=`<div class="toolbar"><input id="expenseSearch" class="search" placeholder="Search expense, event or category"><button id="addExpenseBtn" class="btn btn-primary">+ Add Expense</button></div><section class="panel table-panel"><table><thead><tr><th>Expense</th><th>Event</th><th>Category</th><th>Paid From</th><th>Amount</th><th>Status</th>${approvalsOnly?'<th>Action</th>':''}</tr></thead><tbody id="expenseRows"></tbody></table></section>`; drawExpenseRows(items,approvalsOnly); $('#addExpenseBtn').addEventListener('click',expenseModal); $('#expenseSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();drawExpenseRows(items.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q)),approvalsOnly)}); }
  function drawExpenseRows(items,approvalsOnly){ $('#expenseRows').innerHTML=items.length?items.map(x=>`<tr><td><b>${escapeHtml(x.description||x.expenseId)}</b><small>${escapeHtml(x.expenseId)} · ${escapeHtml(x.date)}</small></td><td>${escapeHtml(x.eventId||'Business')}</td><td>${escapeHtml(x.category)}</td><td>${escapeHtml(String(x.paidFrom).replaceAll('_',' '))}</td><td class="money">${money(x.amount)}</td><td><span class="${statusClass(x.status)}">${escapeHtml(x.status)}</span></td>${approvalsOnly?`<td><div class="row-actions"><button class="btn btn-xs btn-success" data-approve="${x.expenseId}">Approve</button><button class="btn btn-xs btn-danger" data-reject="${x.expenseId}">Reject</button></div></td>`:''}</tr>`).join(''):`<tr><td colspan="${approvalsOnly?7:6}" class="empty">No expenses found.</td></tr>`; if(approvalsOnly){$$('[data-approve]').forEach(b=>b.onclick=()=>approveExpense(b.dataset.approve));$$('[data-reject]').forEach(b=>b.onclick=()=>rejectExpense(b.dataset.reject));} }
  function expenseModal(){ const opts=state.events.map(e=>`<option value="${escapeHtml(e.eventId)}">${escapeHtml(e.eventId)} — ${escapeHtml(e.name)}</option>`).join(''); showModal('Add Expense',`<form id="expenseForm" class="form-grid"><label class="span-2">Event<select name="eventId"><option value="">General Business Expense</option>${opts}</select></label><label>Category<select name="category"><option>Flowers</option><option>Lighting</option><option>Backdrop</option><option>Transport</option><option>Catering</option><option>Printing</option><option>Supplier Labour</option><option>Advertising</option><option>Fuel</option><option>Software</option><option>Inventory Purchase</option><option>Other</option></select></label><label>Amount (LKR)<input type="number" min="0.01" step="0.01" name="amount" required></label><label>Paid From<select name="paidFrom"><option value="DREAM_EVENTS_CASH">Dream Events Cash</option><option value="DREAM_EVENTS_BANK">Dream Events Bank</option><option value="OWNER_PERSONAL">Owner Personal Funds</option><option value="TEAM_MEMBER_PERSONAL">Team Member Personal Funds</option><option value="CREDIT_PAY_LATER">Credit / Pay Later</option></select></label><label>Date<input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="span-2">Description<input name="description" required></label><label class="span-2">Receipt / bill<input type="file" name="attachment" accept="image/*,.pdf"><small>File upload is wired into the backend phase; demo mode stores the filename only.</small></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Submit Expense</button></div></form>`); $('#expenseForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target);const file=fd.get('attachment');const data=Object.fromEntries(fd);delete data.attachment;data.attachmentName=file?.name||'';try{await API.request('createExpense',data);closeModal();toast(session.user.role==='FINANCE_HEAD'?'Expense approved and recorded.':'Expense submitted for approval.');navigate(state.route==='approvals'?'approvals':'expenses');}catch(err){toast(err.message,'error')}});bindModalCloseButtons(); }
  async function approveExpense(id){try{await API.request('approveExpense',{expenseId:id});toast('Expense approved.');navigate('approvals');}catch(err){toast(err.message,'error')}}
  function rejectExpense(id){showModal('Reject Expense',`<form id="rejectForm" class="stack"><label>Reason<textarea name="reason" required></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger">Reject</button></div></form>`);$('#rejectForm').onsubmit=async e=>{e.preventDefault();try{await API.request('rejectExpense',{expenseId:id,reason:new FormData(e.target).get('reason')});closeModal();toast('Expense rejected.');navigate('approvals');}catch(err){toast(err.message,'error')}};bindModalCloseButtons();}

  function renderIncome(){ $('#content').innerHTML=`<div class="toolbar"><input id="incomeSearch" class="search" placeholder="Search income or event"><button id="addIncomeBtn" class="btn btn-primary">+ Add Income</button></div><section class="panel table-panel"><table><thead><tr><th>Income</th><th>Event</th><th>Type</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody id="incomeRows"></tbody></table></section>`;drawIncomeRows(state.income);$('#addIncomeBtn').onclick=incomeModal;$('#incomeSearch').oninput=e=>{const q=e.target.value.toLowerCase();drawIncomeRows(state.income.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q)))}; }
  function drawIncomeRows(items){$('#incomeRows').innerHTML=items.length?items.map(x=>`<tr><td><b>${escapeHtml(x.incomeId)}</b><small>${escapeHtml(x.date)}${x.reference?' · '+escapeHtml(x.reference):''}</small></td><td>${escapeHtml(x.eventId||'Business')}</td><td>${escapeHtml(String(x.type).replaceAll('_',' '))}</td><td>${escapeHtml(x.method)}</td><td class="money">${money(x.amount)}</td><td><span class="${statusClass(x.status)}">${escapeHtml(x.status)}</span></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No income found.</td></tr>';}
  function incomeModal(){const opts=state.events.map(e=>`<option value="${escapeHtml(e.eventId)}">${escapeHtml(e.eventId)} — ${escapeHtml(e.name)}</option>`).join('');showModal('Add Income',`<form id="incomeForm" class="form-grid"><label class="span-2">Event<select name="eventId"><option value="">General Business Income</option>${opts}</select></label><label>Income type<select name="type"><option value="EVENT_ADVANCE">Event Advance</option><option value="EVENT_PAYMENT">Event Payment</option><option value="FINAL_SETTLEMENT">Final Settlement</option><option value="EQUIPMENT_RENTAL">Equipment Rental</option><option value="OTHER_EVENT_INCOME">Other Event Income</option><option value="OTHER_BUSINESS_INCOME">Other Business Income</option></select></label><label>Amount (LKR)<input type="number" min="0.01" step="0.01" name="amount" required></label><label>Payment method<select name="method"><option>CASH</option><option>BANK</option><option>CARD</option><option>OTHER</option></select></label><label>Date<input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="span-2">Reference<input name="reference"></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Submit Income</button></div></form>`);$('#incomeForm').onsubmit=async e=>{e.preventDefault();try{await API.request('createIncome',Object.fromEntries(new FormData(e.target)));closeModal();toast(session.user.role==='FINANCE_HEAD'?'Income approved and recorded.':'Income submitted for approval.');navigate('income');}catch(err){toast(err.message,'error')}};bindModalCloseButtons();}

  function renderComingSoon(title){ $('#content').innerHTML=`<section class="panel empty big-empty"><div class="coming-icon">✦</div><h3>${escapeHtml(title)}</h3><p>The database structure is already reserved for this module. It will be connected after the foundation is deployed and tested.</p></section>`; }
  function bindRouteLinks(){ $$('[data-go]').forEach(x=>x.onclick=()=>navigate(x.dataset.go)); }
  function bindModalCloseButtons(){ $$('[data-close]').forEach(x=>x.onclick=closeModal); }

  $('#loginForm').addEventListener('submit',login); $('#logoutBtn').addEventListener('click',logout); $('#modalClose').addEventListener('click',closeModal); $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()}); $('#mainNav').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b){navigate(b.dataset.route);document.body.classList.remove('nav-open')}}); $('#menuBtn').onclick=()=>document.body.classList.toggle('nav-open'); $('#quickExpenseBtn').onclick=async()=>{state.events=await API.request('listEvents');expenseModal()}; $('#quickIncomeBtn').onclick=async()=>{state.events=await API.request('listEvents');incomeModal()};
  $('#demoHint').textContent=CFG.DEMO_MODE?'Demo login: finance / demo123  |  team / demo123':'Connected to Dream Events backend';
  if(CFG.DEMO_MODE) API.initMock();
  boot();
})();
