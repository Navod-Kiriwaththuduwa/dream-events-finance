(() => {
  const API = window.DE_API;
  const CFG = window.DREAM_EVENTS_CONFIG;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let session = API.getSession();
  let state = { route:'dashboard', customers:[], events:[], expenses:[], income:[], quotations:[], invoices:[], payments:[], receipts:[], paymentPlans:[], currentEvent:null, currentEventTab:'overview', budget:null, budgetCollapsed:new Set(), currentQuotation:null, currentInvoice:null, currentReceipt:null };

  const roundMoney = v => Math.round((Number(v||0) + Number.EPSILON) * 100) / 100;
  const money = v => { const n=roundMoney(v); return `${CFG.CURRENCY} ${n.toLocaleString('en-LK', {minimumFractionDigits:Number.isInteger(n)?0:2, maximumFractionDigits:2})}`; };
  const quoteMoney = v => `${CFG.CURRENCY} ${Math.round(Number(v||0)).toLocaleString('en-LK')}`;
  const pct = v => `${Number(v||0).toFixed(1)}%`;
  const escapeHtml = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const statusClass = s => `status ${String(s||'').toLowerCase().replaceAll('_','-').replaceAll(' ','-')}`;
  const displayStatus = s => String(s||'').replaceAll('_',' ');
  const today = () => new Date().toLocaleDateString('en-CA');

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
    state.route=route; state.currentEvent=null;
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===route));
    const titles={dashboard:'Dashboard',events:'Events',customers:'Customers',expenses:'Expenses',income:'Income',approvals:'Approval Queue',sales:'Sales Documents',inventory:'Inventory',payables:'Payables',reports:'Reports',admin:'Administration'};
    $('#pageEyebrow').textContent='DREAM EVENTS';
    $('#pageTitle').textContent=titles[route]||route;
    $('#content').innerHTML='<div class="loading">Loading…</div>';
    try {
      if(route==='dashboard') return renderDashboard(await API.request('dashboard'));
      if(route==='customers') { state.customers=await API.request('listCustomers'); return renderCustomers(); }
      if(route==='events') { state.events=await API.request('listEvents'); state.customers=await API.request('listCustomers'); return renderEvents(); }
      if(route==='expenses'||route==='approvals') { state.expenses=await API.request('listExpenses'); state.events=await API.request('listEvents'); return renderExpenses(route==='approvals'); }
      if(route==='income') { state.income=await API.request('listIncome'); state.events=await API.request('listEvents'); return renderIncome(); }
      if(route==='sales') { [state.quotations,state.invoices,state.receipts,state.events]=await Promise.all([API.request('listQuotations'),API.request('listInvoices'),API.request('listReceipts'),API.request('listEvents')]); return renderSalesDocuments(); }
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
  function eventMiniList(items){ if(!items.length)return '<div class="empty">No upcoming events.</div>'; return `<div class="mini-list">${items.map(e=>`<button class="mini-row mini-row-button" data-open-event="${escapeHtml(e.eventId)}"><div><strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(e.customerName||'')}</span></div><div class="right"><strong>${escapeHtml(e.date)}</strong><span class="${statusClass(e.status)}">${escapeHtml(displayStatus(e.status))}</span></div></button>`).join('')}</div>`; }

  function renderCustomers(){
    $('#content').innerHTML=`<div class="toolbar"><input id="customerSearch" class="search" placeholder="Search customer name, mobile, email or source"><button id="newCustomerBtn" class="btn btn-primary finance-only">+ New Customer</button></div><section class="panel table-panel"><table><thead><tr><th>Customer</th><th>Mobile</th><th>WhatsApp</th><th>Source</th><th>Status</th></tr></thead><tbody id="customerRows"></tbody></table></section>`;
    syncRoleUI(); drawCustomerRows(state.customers); $('#newCustomerBtn')?.addEventListener('click',newCustomerModal); $('#customerSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();drawCustomerRows(state.customers.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q)))});
  }
  function drawCustomerRows(items){ $('#customerRows').innerHTML=items.length?items.map(c=>`<tr><td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.customerId)}</small></td><td>${escapeHtml(c.mobile)}</td><td>${escapeHtml(c.whatsapp||'—')}</td><td>${escapeHtml(c.source||'—')}</td><td><span class="${statusClass(c.status)}">${escapeHtml(c.status)}</span></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No customers found.</td></tr>'; }
  function newCustomerModal(){
    showModal('New Customer',`<form id="customerForm" class="form-grid"><label class="span-2">Customer name<input name="name" required></label><label>Mobile<input name="mobile" required></label><label>WhatsApp<input name="whatsapp"></label><label>Email<input type="email" name="email"></label><label>Source<select name="source"><option>Referral</option><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>Website</option><option>Walk-in</option><option>Other</option></select></label><label class="span-2">Address<input name="address"></label><label class="span-2">Notes<textarea name="notes"></textarea></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Create Customer</button></div></form>`);
    $('#customerForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await API.request('createCustomer',data);closeModal();toast('Customer created.');navigate('customers');}catch(err){toast(err.message,'error')}}); bindModalCloseButtons();
  }

  function renderEvents(){
    $('#content').innerHTML=`<div class="toolbar"><input id="eventSearch" class="search" placeholder="Search event, customer, venue, date or status"><button id="newEventBtn" class="btn btn-primary finance-only">+ Create Event</button></div><div id="eventCards" class="event-cards"></div>`;
    syncRoleUI(); drawEventCards(state.events); $('#newEventBtn')?.addEventListener('click',newEventModal); $('#eventSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();drawEventCards(state.events.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q)))});
  }
  function drawEventCards(items){
    $('#eventCards').innerHTML=items.length?items.map(e=>`<article class="event-card"><div class="event-card-top"><span class="${statusClass(e.status)}">${escapeHtml(displayStatus(e.status))}</span><small>${escapeHtml(e.eventId)}</small></div><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.customerName||'')} · ${escapeHtml(e.type||'Event')}</p><div class="event-meta"><span>📅 ${escapeHtml(e.date)}</span><span>📍 ${escapeHtml(e.venue||'TBC')}</span></div>${session.user.role==='FINANCE_HEAD'?`<div class="event-value"><span>Confirmed value</span><strong>${money(e.confirmedValue)}</strong></div>`:''}<div class="card-actions"><button class="btn btn-ghost full" data-open-event="${escapeHtml(e.eventId)}">Open Event</button></div></article>`).join(''):'<div class="empty panel">No events found.</div>';
    bindOpenEventButtons();
  }
  function eventStatusOptions(selected='INQUIRY'){
    return ['INQUIRY','PLANNING','QUOTATION','CONFIRMED','PREPARATION','EVENT_IN_PROGRESS','COMPLETED','FINANCIALLY_CLOSED','ON_HOLD','CANCELLED'].map(s=>`<option value="${s}" ${s===selected?'selected':''}>${displayStatus(s)}</option>`).join('');
  }
  function eventFormHtml(e={}){
    const opts=state.customers.map(c=>`<option value="${escapeHtml(c.customerId)}" ${c.customerId===e.customerId?'selected':''}>${escapeHtml(c.name)} — ${escapeHtml(c.mobile)}</option>`).join('');
    return `<form id="eventForm" class="form-grid">
      <label class="span-2">Event name<input name="name" required value="${escapeHtml(e.name||'')}" placeholder="e.g. Kasun & Amanda Proposal"></label>
      <label>Event type<select name="type">${['Marriage Proposal','Wedding','Birthday','Anniversary','Corporate Event','Other'].map(t=>`<option ${t===(e.type||'Marriage Proposal')?'selected':''}>${t}</option>`).join('')}</select></label>
      <label>Customer<select name="customerId" required><option value="">Select customer</option>${opts}</select></label>
      <label>Event date<input type="date" name="date" required value="${escapeHtml(e.date||'')}"></label>
      <label>Venue<input name="venue" value="${escapeHtml(e.venue||'')}"></label>
      <label>Start time<input type="time" name="startTime" value="${escapeHtml(e.startTime||'')}"></label>
      <label>End time<input type="time" name="endTime" value="${escapeHtml(e.endTime||'')}"></label>
      <label>Guest count<input type="number" min="0" name="guestCount" value="${escapeHtml(e.guestCount||'')}"></label>
      <label>Coordinator<input name="coordinator" value="${escapeHtml(e.coordinator||'')}"></label>
      <label>Status<select name="status">${eventStatusOptions(e.status||'INQUIRY')}</select></label>
      <label>Confirmed value (LKR)<input type="number" min="0" name="confirmedValue" value="${escapeHtml(e.confirmedValue||0)}"></label>
      <label class="span-2">Notes<textarea name="notes">${escapeHtml(e.notes||'')}</textarea></label>
      <div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">${e.eventId?'Save Changes':'Create Event'}</button></div>
    </form>`;
  }
  function newEventModal(){ showModal('Create Event',eventFormHtml()); $('#eventForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{const rec=await API.request('createEvent',data);closeModal();toast('Event created.');openEvent(rec.eventId);}catch(err){toast(err.message,'error')}});bindModalCloseButtons(); }
  function editEventModal(event){
    showModal('Edit Event',eventFormHtml(event));
    $('#eventForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.eventId=event.eventId;try{await API.request('updateEvent',data);closeModal();toast('Event updated.');openEvent(event.eventId,state.currentEventTab);}catch(err){toast(err.message,'error')}});bindModalCloseButtons();
  }

  async function openEvent(eventId, tab='overview'){
    try{
      state.route='eventDetail'; state.currentEventTab=tab;
      $$('.nav-item').forEach(b=>b.classList.remove('active'));
      $('#content').innerHTML='<div class="loading">Loading event…</div>';
      if(!state.customers.length) state.customers=await API.request('listCustomers');
      const event=await API.request('getEvent',{eventId}); state.currentEvent=event;
      $('#pageEyebrow').textContent=event.eventId;
      $('#pageTitle').textContent=event.name;
      renderEventShell(event,tab);
    }catch(err){toast(err.message,'error');navigate('events')}
  }
  function renderEventShell(event,tab){
    const finance=session.user.role==='FINANCE_HEAD';
    const tabs=[['overview','Overview'],...(finance?[['budget','Budget'],['quotation','Quotation'],['payments','Payments']]:[]),['expenses','Expenses'],['income','Income']];
    $('#content').innerHTML=`
      <div class="event-detail-head panel">
        <div><button class="text-btn back-link" data-go="events">← All Events</button><div class="event-detail-title"><span class="${statusClass(event.status)}">${escapeHtml(displayStatus(event.status))}</span><h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(event.customer?.name||event.customerName||'')} · ${escapeHtml(event.type||'Event')}</p></div></div>
        <div class="event-head-actions">${finance?'<button id="editEventBtn" class="btn btn-secondary">Edit Event</button>':''}</div>
      </div>
      <div class="event-tabs">${tabs.map(([id,label])=>`<button class="event-tab ${tab===id?'active':''}" data-event-tab="${id}">${label}</button>`).join('')}</div>
      <div id="eventTabBody"></div>`;
    bindRouteLinks();
    $('#editEventBtn')?.addEventListener('click',()=>editEventModal(event));
    $$('[data-event-tab]').forEach(b=>b.onclick=()=>switchEventTab(b.dataset.eventTab));
    switchEventTab(tab,false);
  }
  async function switchEventTab(tab, updateActive=true){
    state.currentEventTab=tab;
    if(updateActive) $$('.event-tab').forEach(b=>b.classList.toggle('active',b.dataset.eventTab===tab));
    const body=$('#eventTabBody'); if(!body)return;
    body.innerHTML='<div class="loading">Loading…</div>';
    try{
      if(tab==='overview') return renderEventOverview();
      if(tab==='budget') return await renderEventBudget();
      if(tab==='expenses') return await renderEventExpenses();
      if(tab==='income') return await renderEventIncome();
      if(tab==='quotation') return await renderEventQuotation();
      if(tab==='payments') return await renderEventPayments();
    }catch(err){body.innerHTML=`<div class="empty error-box">${escapeHtml(err.message)}</div>`}
  }
  function renderEventOverview(){
    const e=state.currentEvent, finance=session.user.role==='FINANCE_HEAD';
    const outstanding=finance?Number(e.customerOutstanding ?? Math.max(0,Number(e.confirmedValue||0)-Number(e.approvedIncome||0))):0;
    $('#eventTabBody').innerHTML=`
      <div class="metric-grid event-metrics">
        ${finance?card('Confirmed Value',money(e.confirmedValue)):''}
        ${card('Approved Income',money(e.approvedIncome))}
        ${card('Approved Expenses',money(e.approvedExpenses))}
        ${finance?card('Customer Outstanding',money(outstanding)):''}
      </div>
      <div class="section-grid">
        <section class="panel"><div class="panel-head"><div><p class="eyebrow">EVENT DETAILS</p><h3>Overview</h3></div></div><div class="detail-grid">
          <div><span>Date</span><strong>${escapeHtml(e.date||'TBC')}</strong></div><div><span>Time</span><strong>${escapeHtml([e.startTime,e.endTime].filter(Boolean).join(' – ')||'TBC')}</strong></div>
          <div><span>Venue</span><strong>${escapeHtml(e.venue||'TBC')}</strong></div><div><span>Guests</span><strong>${escapeHtml(e.guestCount||0)}</strong></div>
          <div><span>Coordinator</span><strong>${escapeHtml(e.coordinator||'Not assigned')}</strong></div><div><span>Status</span><strong>${escapeHtml(displayStatus(e.status))}</strong></div>
        </div>${e.notes?`<div class="note-box"><span>Notes</span><p>${escapeHtml(e.notes)}</p></div>`:''}</section>
        <section class="panel"><div class="panel-head"><div><p class="eyebrow">CUSTOMER</p><h3>${escapeHtml(e.customer?.name||'Customer')}</h3></div></div><div class="detail-list"><div><span>Mobile</span><strong>${escapeHtml(e.customer?.mobile||'—')}</strong></div><div><span>WhatsApp</span><strong>${escapeHtml(e.customer?.whatsapp||'—')}</strong></div><div><span>Email</span><strong>${escapeHtml(e.customer?.email||'—')}</strong></div></div></section>
      </div>`;
  }

  async function renderEventBudget(){
    if(session.user.role!=='FINANCE_HEAD') throw new Error('Finance Head access required.');
    state.budget=await API.request('getBudget',{eventId:state.currentEvent.eventId});
    const b=state.budget, s=b.summary;
    const variance=Number(s.actualCost||0)-Number(s.estimatedCost||0);
    const varianceValue=variance===0?'On budget':money(Math.abs(variance));
    const varianceSub=variance>0?'Over budget to date':variance<0?'Under budget to date':'No cost variance';
    $('#eventTabBody').innerHTML=`
      <div class="budget-intro"><div><p class="eyebrow">INTERNAL BUDGET · VERSION ${escapeHtml(b.header.version||1)}</p><h3>Event Budget Planning</h3><p class="muted">Build the budget as Main Item → Sub Item → Detailed Item. Internal costs and margins remain Finance Head-only.</p></div><button id="addMainItemBtn" class="btn btn-primary">+ Main Item</button></div>
      <div class="metric-grid budget-metrics">
        ${card('Estimated Revenue',money(s.estimatedRevenue))}${card('Estimated Cost',money(s.estimatedCost))}${card('Expected Profit',money(s.estimatedProfit),pct(s.estimatedMargin)+' margin')}${card('Actual Cost',money(s.actualCost))}
        ${card('Actual Revenue',money(s.actualRevenue))}${card('Actual Profit',money(s.actualProfit),pct(s.actualMargin)+' margin')}${card('Unlinked Expenses',money(s.approvedUnlinked),'approved event expenses')}${card('Cost Variance',varianceValue,varianceSub)}
      </div>
      <div class="budget-guidance"><strong>Customer pricing rule:</strong> Enter the customer selling price at the <b>Sub Item</b> level for a grouped quotation, or leave the Sub Item price at 0 and price its Detailed Items individually. Customer-visible pricing is highlighted below. Internal detailed costs never appear on the customer quotation.</div>
      <div id="budgetTree" class="budget-tree">${budgetTreeHtml(b.lines,s)}</div>`;
    $('#addMainItemBtn').onclick=()=>budgetLineModal('MAIN');
    bindBudgetActions();
  }
  function budgetTreeHtml(lines,summary){
    const mains=lines.filter(x=>x.level==='MAIN').sort(orderBudgetLines);
    if(!mains.length) return `<section class="panel empty big-empty"><div class="coming-icon">＋</div><h3>Start your event budget</h3><p>Add a Main Item such as Decoration, Photography, Catering or Entertainment.</p></section>`;
    return mains.map(main=>{
      const subs=lines.filter(x=>x.level==='SUB'&&x.parentLineId===main.budgetLineId).sort(orderBudgetLines);
      const mainEst=subCost(lines,main.budgetLineId,'estimated',summary);
      const mainAct=subCost(lines,main.budgetLineId,'actual',summary);
      const mainRev=mainRevenue(lines,main.budgetLineId);
      const expectedProfit=mainRev-mainEst;
      const collapsed=isBudgetCollapsed(main.budgetLineId);
      return `<section class="budget-main panel">
        <div class="budget-main-head">
          <button class="budget-collapse-btn" data-budget-collapse="${main.budgetLineId}" title="${collapsed?'Expand':'Collapse'} ${escapeHtml(main.mainItem)}">${collapsed?'▸':'▾'}</button>
          <div class="budget-main-title"><p class="eyebrow">MAIN ITEM</p><h3>${escapeHtml(main.mainItem)}</h3>${main.description?`<small>${escapeHtml(main.description)}</small>`:''}</div>
          <div class="budget-main-totals">
            <span><small>Estimated cost</small><b>${money(mainEst)}</b></span>
            <span><small>Actual cost</small><b>${money(mainAct)}</b></span>
            <span><small>Customer value</small><b>${money(mainRev)}</b></span>
            <span class="${expectedProfit<0?'negative':''}"><small>Expected profit</small><b>${money(expectedProfit)}</b></span>
          </div>
          <div class="row-actions budget-actions">
            <button class="btn btn-xs btn-secondary" data-budget-add="SUB" data-parent="${main.budgetLineId}">+ Sub Item</button>
            ${budgetOrderButtons(main)}
            <button class="icon-action" title="Duplicate main item" aria-label="Duplicate main item" data-budget-duplicate="${main.budgetLineId}">⧉</button>
            <button class="icon-action" title="Edit main item" aria-label="Edit main item" data-budget-edit="${main.budgetLineId}">✎</button>
            <button class="icon-action danger" title="Remove main item" aria-label="Remove main item" data-budget-delete="${main.budgetLineId}">×</button>
          </div>
        </div>
        <div class="budget-sub-list ${collapsed?'hidden':''}">${subs.length?subs.map(sub=>budgetSubHtml(sub,lines,summary)).join(''):'<div class="empty budget-empty">No sub items yet.</div>'}</div>
      </section>`;
    }).join('');
  }
  function budgetSubHtml(sub,lines,summary){
    const details=lines.filter(x=>x.level==='DETAIL'&&x.parentLineId===sub.budgetLineId).sort(orderBudgetLines);
    const est=details.reduce((a,d)=>a+Number(d.estimatedQty||0)*Number(d.estimatedUnitCost||0),0);
    const act=details.reduce((a,d)=>a+detailActual(d,summary),0);
    const customerPrice=Number(sub.sellingPrice||0);
    const groupedVisible=sub.quotationVisible&&customerPrice>0;
    const detailVisibleCount=customerPrice<=0?details.filter(d=>d.quotationVisible&&Number(d.sellingPrice||0)>0).length:0;
    const quoteBadge=groupedVisible
      ? `<span class="quote-chip">Customer visible · ${money(customerPrice)}</span>`
      : detailVisibleCount>0
        ? `<span class="quote-chip detail-quote-chip">${detailVisibleCount} detailed price${detailVisibleCount===1?'':'s'} visible</span>`
        : `<span class="quote-chip muted-chip">Internal only</span>`;
    const collapsed=isBudgetCollapsed(sub.budgetLineId);
    return `<div class="budget-sub">
      <div class="budget-sub-head">
        <button class="budget-collapse-btn sub-collapse" data-budget-collapse="${sub.budgetLineId}" title="${collapsed?'Expand':'Collapse'} ${escapeHtml(sub.subItem)}">${collapsed?'▸':'▾'}</button>
        <div class="budget-sub-title"><p class="budget-kicker">SUB ITEM</p><h4>${escapeHtml(sub.subItem)}</h4><div class="budget-sub-meta"><span>Est. cost <b>${money(est)}</b></span><span>Actual <b>${money(act)}</b></span><span>Customer price <b>${customerPrice>0?money(customerPrice):'Not grouped'}</b></span>${quoteBadge}</div></div>
        <div class="row-actions budget-actions">
          <button class="btn btn-xs btn-ghost" data-budget-add="DETAIL" data-parent="${sub.budgetLineId}">+ Detailed Item</button>
          ${budgetOrderButtons(sub)}
          <button class="icon-action" title="Duplicate sub item" aria-label="Duplicate sub item" data-budget-duplicate="${sub.budgetLineId}">⧉</button>
          <button class="icon-action" title="Edit sub item" aria-label="Edit sub item" data-budget-edit="${sub.budgetLineId}">✎</button>
          <button class="icon-action danger" title="Remove sub item" aria-label="Remove sub item" data-budget-delete="${sub.budgetLineId}">×</button>
        </div>
      </div>
      <div class="${collapsed?'hidden':''}">
        ${details.length?`<div class="budget-detail-table"><div class="budget-detail-row header"><span>Detailed item</span><span>Estimate</span><span>Customer price</span><span>Actual</span><span>Budget status</span><span>Actions</span></div>${details.map(d=>budgetDetailHtml(d,summary,groupedVisible)).join('')}</div>`:'<div class="empty budget-empty">No detailed items yet.</div>'}
        <div class="budget-subtotal-row"><span>Sub item total</span><b>${money(est)}</b><b>${customerPrice>0?money(customerPrice):money(details.filter(d=>d.quotationVisible).reduce((a,d)=>a+Number(d.sellingPrice||0),0))}</b><b>${money(act)}</b><span>${varianceLabel(act-est,true)}</span><span></span></div>
      </div>
    </div>`;
  }
  function orderBudgetLines(a,b){ return Number(a.displayOrder||0)-Number(b.displayOrder||0) || String(a.budgetLineId||'').localeCompare(String(b.budgetLineId||'')); }
  function detailActual(d,summary){ const linked=Number(summary.linkedByLine?.[d.budgetLineId]||0); const manual=Number(d.actualQty||0)*Number(d.actualUnitCost||0); return linked>0?linked:manual; }
  function subCost(lines,mainId,kind,summary){
    const subIds=lines.filter(x=>x.level==='SUB'&&x.parentLineId===mainId).map(x=>x.budgetLineId);
    return lines.filter(x=>x.level==='DETAIL'&&subIds.includes(x.parentLineId)).reduce((a,d)=>a+(kind==='estimated'?Number(d.estimatedQty||0)*Number(d.estimatedUnitCost||0):detailActual(d,summary)),0);
  }
  function mainRevenue(lines,mainId){
    const subs=lines.filter(x=>x.level==='SUB'&&x.parentLineId===mainId);
    return subs.reduce((total,sub)=>{
      const grouped=Number(sub.sellingPrice||0);
      if(grouped>0 && sub.quotationVisible) return total+grouped;
      return total+lines.filter(d=>d.level==='DETAIL'&&d.parentLineId===sub.budgetLineId&&d.quotationVisible).reduce((a,d)=>a+Number(d.sellingPrice||0),0);
    },0);
  }
  function varianceLabel(variance){
    variance=Number(variance||0);
    if(variance===0) return '<span class="variance-neutral">On budget</span>';
    const amount=money(Math.abs(variance));
    return variance>0?`<span class="variance-over">Over ${amount}</span>`:`<span class="variance-under">Under ${amount}</span>`;
  }
  function budgetDetailHtml(d,summary,groupedPricing=false){
    const estimated=Number(d.estimatedQty||0)*Number(d.estimatedUnitCost||0);
    const linked=Number(summary.linkedByLine?.[d.budgetLineId]||0);
    const actual=detailActual(d,summary);
    const variance=actual-estimated;
    const visible=!groupedPricing&&d.quotationVisible&&Number(d.sellingPrice||0)>0;
    return `<div class="budget-detail-row"><span><b>${escapeHtml(d.detailedItem)}</b><small>${escapeHtml(d.estimatedQty||0)} ${escapeHtml(d.unit||'unit')} × ${money(d.estimatedUnitCost)}${linked>0?`<em>Actual from approved expenses</em>`:''}${visible?`<i class="detail-visible-badge">Customer visible</i>`:''}</small></span><span>${money(estimated)}</span><span>${Number(d.sellingPrice||0)>0?money(d.sellingPrice):'—'}</span><span>${money(actual)}</span><span>${varianceLabel(variance)}</span><span class="row-actions budget-detail-actions">${budgetOrderButtons(d)}<button class="icon-action" title="Duplicate detailed item" aria-label="Duplicate detailed item" data-budget-duplicate="${d.budgetLineId}">⧉</button><button class="icon-action" title="Edit detailed item" aria-label="Edit detailed item" data-budget-edit="${d.budgetLineId}">✎</button><button class="icon-action danger" title="Remove detailed item" aria-label="Remove detailed item" data-budget-delete="${d.budgetLineId}">×</button></span></div>`;
  }
  function budgetOrderButtons(line){
    return `<button class="icon-action" title="Move up" aria-label="Move up" data-budget-move="${line.budgetLineId}" data-direction="UP">↑</button><button class="icon-action" title="Move down" aria-label="Move down" data-budget-move="${line.budgetLineId}" data-direction="DOWN">↓</button>`;
  }
  function isBudgetCollapsed(id){ return state.budgetCollapsed.has(`${state.currentEvent?.eventId||''}:${id}`); }
  function toggleBudgetCollapse(id){
    const key=`${state.currentEvent?.eventId||''}:${id}`;
    if(state.budgetCollapsed.has(key)) state.budgetCollapsed.delete(key); else state.budgetCollapsed.add(key);
    const tree=$('#budgetTree'); if(tree&&state.budget) tree.innerHTML=budgetTreeHtml(state.budget.lines,state.budget.summary);
    bindBudgetActions();
  }
  function bindBudgetActions(){
    $$('[data-budget-add]').forEach(b=>b.onclick=()=>budgetLineModal(b.dataset.budgetAdd,b.dataset.parent));
    $$('[data-budget-edit]').forEach(b=>b.onclick=()=>{const line=state.budget.lines.find(x=>x.budgetLineId===b.dataset.budgetEdit);if(line)budgetLineModal(line.level,line.parentLineId,line)});
    $$('[data-budget-delete]').forEach(b=>b.onclick=()=>deleteBudgetLine(b.dataset.budgetDelete));
    $$('[data-budget-collapse]').forEach(b=>b.onclick=()=>toggleBudgetCollapse(b.dataset.budgetCollapse));
    $$('[data-budget-move]').forEach(b=>b.onclick=()=>moveBudgetLine(b.dataset.budgetMove,b.dataset.direction));
    $$('[data-budget-duplicate]').forEach(b=>b.onclick=()=>duplicateBudgetLine(b.dataset.budgetDuplicate));
  }
  async function moveBudgetLine(id,direction){
    try{
      await API.request('moveBudgetLine',{budgetLineId:id,direction,eventId:state.currentEvent.eventId});
      await renderEventBudget();
    }catch(err){toast(err.message,'error')}
  }
  async function duplicateBudgetLine(id){
    try{
      await API.request('duplicateBudgetLine',{budgetLineId:id,eventId:state.currentEvent.eventId});
      toast('Budget item duplicated.');
      await renderEventBudget();
    }catch(err){toast(err.message,'error')}
  }
  function budgetLineModal(level,parentLineId='',existing=null){
    const labels={MAIN:'Main Item',SUB:'Sub Item',DETAIL:'Detailed Item'}; const name=existing?(existing.mainItem||existing.subItem||existing.detailedItem):'';
    let extra='';
    if(level==='SUB') extra=`<label>Customer selling price (LKR)<input type="number" min="0" step="0.01" name="sellingPrice" value="${escapeHtml(existing?.sellingPrice||0)}"></label><label class="check-label"><input type="checkbox" name="quotationVisible" ${existing?.quotationVisible===false?'':'checked'}> Show this Sub Item on quotation</label>`;
    if(level==='DETAIL') extra=`
      <label>Estimated quantity<input type="number" min="0" step="0.01" name="estimatedQty" value="${escapeHtml(existing?.estimatedQty||0)}"></label><label>Unit<input name="unit" value="${escapeHtml(existing?.unit||'')}" placeholder="pcs / bunch / day / lot"></label>
      <label>Estimated unit cost (LKR)<input type="number" min="0" step="0.01" name="estimatedUnitCost" value="${escapeHtml(existing?.estimatedUnitCost||0)}"></label><label>Customer selling price (optional)<input type="number" min="0" step="0.01" name="sellingPrice" value="${escapeHtml(existing?.sellingPrice||0)}"></label>
      <label>Actual quantity <small>Optional if linked expenses are used</small><input type="number" min="0" step="0.01" name="actualQty" value="${escapeHtml(existing?.actualQty||0)}"></label><label>Actual unit cost (LKR)<input type="number" min="0" step="0.01" name="actualUnitCost" value="${escapeHtml(existing?.actualUnitCost||0)}"></label>
      <label class="check-label span-2"><input type="checkbox" name="quotationVisible" ${existing?.quotationVisible===false?'':'checked'}> Allow this Detailed Item on quotation only when its Sub Item has no grouped selling price</label>`;
    showModal(`${existing?'Edit':'Add'} ${labels[level]}`,`<form id="budgetLineForm" class="form-grid"><label class="span-2">${labels[level]} name<input name="name" required value="${escapeHtml(name)}" placeholder="${level==='MAIN'?'Decoration':level==='SUB'?'Flowers':'White Roses'}"></label>${extra}<label class="span-2">${level==='MAIN'?'Description':'Internal notes'}<textarea name="internalNotes">${escapeHtml(existing?.internalNotes||existing?.description||'')}</textarea></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">${existing?'Save Changes':'Add Item'}</button></div></form>`);
    $('#budgetLineForm').onsubmit=async e=>{
      e.preventDefault(); const fd=new FormData(e.target); const data=Object.fromEntries(fd); data.quotationVisible=level==='MAIN'?true:fd.has('quotationVisible'); data.eventId=state.currentEvent.eventId; data.level=level; data.parentLineId=parentLineId||''; data.internalNotes=data.internalNotes||'';
      try{ if(existing){data.budgetLineId=existing.budgetLineId;await API.request('updateBudgetLine',data)}else await API.request('createBudgetLine',data); closeModal(); toast(existing?'Budget item updated.':'Budget item added.'); await renderEventBudget(); }catch(err){toast(err.message,'error')}
    };
    bindModalCloseButtons();
  }
  function deleteBudgetLine(id){
    const line=state.budget.lines.find(x=>x.budgetLineId===id); if(!line)return;
    const name=line.mainItem||line.subItem||line.detailedItem;
    showModal('Remove Budget Item',`<div class="stack"><p>Remove <strong>${escapeHtml(name)}</strong> from this budget?</p><p class="muted">Items with child items or linked financial transactions cannot be removed.</p><div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button id="confirmBudgetDelete" class="btn btn-danger">Remove</button></div></div>`);
    $('#confirmBudgetDelete').onclick=async()=>{try{await API.request('deleteBudgetLine',{budgetLineId:id,eventId:state.currentEvent.eventId});closeModal();toast('Budget item removed.');renderEventBudget();}catch(err){toast(err.message,'error')}};bindModalCloseButtons();
  }

  async function renderEventExpenses(){
    state.expenses=await API.request('listExpenses'); const items=state.expenses.filter(x=>x.eventId===state.currentEvent.eventId);
    $('#eventTabBody').innerHTML=`<div class="toolbar"><div><p class="eyebrow">EVENT EXPENSES</p><h3>${items.length} transaction(s)</h3></div><button id="eventAddExpense" class="btn btn-primary">+ Add Expense</button></div>${expenseTable(items,false)}`;
    $('#eventAddExpense').onclick=()=>expenseModal(state.currentEvent.eventId);
  }
  async function renderEventIncome(){
    state.income=await API.request('listIncome'); const items=state.income.filter(x=>x.eventId===state.currentEvent.eventId);
    $('#eventTabBody').innerHTML=`<div class="toolbar"><div><p class="eyebrow">EVENT INCOME</p><h3>${items.length} transaction(s)</h3></div><button id="eventAddIncome" class="btn btn-primary">+ Add Income</button></div>${incomeTable(items)}`;
    $('#eventAddIncome').onclick=()=>incomeModal(state.currentEvent.eventId);
  }

  function renderExpenses(approvalsOnly=false){
    const items=approvalsOnly?state.expenses.filter(x=>x.status==='PENDING'):state.expenses;
    $('#content').innerHTML=`<div class="toolbar"><input id="expenseSearch" class="search" placeholder="Search expense, event or category"><button id="addExpenseBtn" class="btn btn-primary">+ Add Expense</button></div><div id="expenseTableWrap">${expenseTable(items,approvalsOnly)}</div>`;
    bindExpenseApprovalButtons(); $('#addExpenseBtn').addEventListener('click',()=>expenseModal()); $('#expenseSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();const filtered=items.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q));$('#expenseTableWrap').innerHTML=expenseTable(filtered,approvalsOnly);bindExpenseApprovalButtons();});
  }
  function expenseTable(items,approvalsOnly=false){ return `<section class="panel table-panel"><table><thead><tr><th>Expense</th><th>Event</th><th>Category</th><th>Paid From</th><th>Amount</th><th>Status</th>${approvalsOnly?'<th>Action</th>':''}</tr></thead><tbody>${items.length?items.map(x=>`<tr><td><b>${escapeHtml(x.description||x.expenseId)}</b><small>${escapeHtml(x.expenseId)} · ${escapeHtml(x.date)}${x.budgetLineId?' · Budget linked':''}</small></td><td>${escapeHtml(x.eventId||'Business')}</td><td>${escapeHtml(x.category)}${x.subCategory?`<small>${escapeHtml(x.subCategory)}</small>`:''}</td><td>${escapeHtml(String(x.paidFrom||'').replaceAll('_',' '))}</td><td class="money">${money(x.amount)}</td><td><span class="${statusClass(x.status)}">${escapeHtml(x.status)}</span></td>${approvalsOnly?`<td><div class="row-actions"><button class="btn btn-xs btn-success" data-approve="${x.expenseId}">Approve</button><button class="btn btn-xs btn-danger" data-reject="${x.expenseId}">Reject</button></div></td>`:''}</tr>`).join(''):`<tr><td colspan="${approvalsOnly?7:6}" class="empty">No expenses found.</td></tr>`}</tbody></table></section>`; }
  function bindExpenseApprovalButtons(){ $$('[data-approve]').forEach(b=>b.onclick=()=>approveExpense(b.dataset.approve));$$('[data-reject]').forEach(b=>b.onclick=()=>rejectExpense(b.dataset.reject)); }
  async function expenseModal(presetEventId=''){
    if(!state.events.length) state.events=await API.request('listEvents');
    const opts=state.events.map(e=>`<option value="${escapeHtml(e.eventId)}" ${e.eventId===presetEventId?'selected':''}>${escapeHtml(e.eventId)} — ${escapeHtml(e.name)}</option>`).join('');
    showModal('Add Expense',`<form id="expenseForm" class="form-grid"><label class="span-2">Event<select id="expenseEvent" name="eventId"><option value="">General Business Expense</option>${opts}</select></label><label class="span-2">Budget detail item <small>Optional. Linking lets approved expenses update the Actual Budget automatically.</small><select id="budgetTarget" name="budgetLineId"><option value="">Not linked to a budget item</option></select></label><label>Category<select name="category"><option>Flowers</option><option>Lighting</option><option>Backdrop</option><option>Transport</option><option>Catering</option><option>Printing</option><option>Supplier Labour</option><option>Advertising</option><option>Fuel</option><option>Software</option><option>Inventory Purchase</option><option>Other</option></select></label><label>Amount (LKR)<input type="number" min="0.01" step="0.01" name="amount" required></label><label>Paid From<select name="paidFrom"><option value="DREAM_EVENTS_CASH">Dream Events Cash</option><option value="DREAM_EVENTS_BANK">Dream Events Bank</option><option value="OWNER_PERSONAL">Owner Personal Funds</option><option value="TEAM_MEMBER_PERSONAL">Team Member Personal Funds</option><option value="CREDIT_PAY_LATER">Credit / Pay Later</option></select></label><label>Date<input type="date" name="date" value="${today()}"></label><label class="span-2">Description<input name="description" required></label><label class="span-2">Receipt / bill<input type="file" name="attachment" accept="image/*,.pdf"><small>Demo mode stores the filename only. Google Drive upload is connected in the backend deployment phase.</small></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Submit Expense</button></div></form>`);
    const loadTargets=async id=>{const sel=$('#budgetTarget');sel.innerHTML='<option value="">Not linked to a budget item</option>';if(!id)return;try{const targets=await API.request('listBudgetTargets',{eventId:id});targets.forEach(t=>{const o=document.createElement('option');o.value=t.budgetLineId;o.textContent=t.label;sel.appendChild(o)})}catch{}};
    $('#expenseEvent').onchange=e=>loadTargets(e.target.value); if(presetEventId) await loadTargets(presetEventId);
    $('#expenseForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target);const file=fd.get('attachment');const data=Object.fromEntries(fd);delete data.attachment;data.attachmentName=file?.name||'';try{await API.request('createExpense',data);closeModal();toast(session.user.role==='FINANCE_HEAD'?'Expense approved and recorded.':'Expense submitted for approval.');if(state.route==='eventDetail')openEvent(state.currentEvent.eventId,'expenses');else navigate(state.route==='approvals'?'approvals':'expenses');}catch(err){toast(err.message,'error')}});bindModalCloseButtons();
  }
  async function approveExpense(id){try{await API.request('approveExpense',{expenseId:id});toast('Expense approved.');navigate('approvals');}catch(err){toast(err.message,'error')}}
  function rejectExpense(id){showModal('Reject Expense',`<form id="rejectForm" class="stack"><label>Reason<textarea name="reason" required></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger">Reject</button></div></form>`);$('#rejectForm').onsubmit=async e=>{e.preventDefault();try{await API.request('rejectExpense',{expenseId:id,reason:new FormData(e.target).get('reason')});closeModal();toast('Expense rejected.');navigate('approvals');}catch(err){toast(err.message,'error')}};bindModalCloseButtons();}

  function renderIncome(){
    $('#content').innerHTML=`<div class="toolbar"><input id="incomeSearch" class="search" placeholder="Search income or event"><button id="addIncomeBtn" class="btn btn-primary">+ Add Income</button></div><div id="incomeTableWrap">${incomeTable(state.income)}</div>`;
    $('#addIncomeBtn').onclick=()=>incomeModal();$('#incomeSearch').oninput=e=>{const q=e.target.value.toLowerCase();$('#incomeTableWrap').innerHTML=incomeTable(state.income.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q)))};
  }
  function incomeTable(items){ return `<section class="panel table-panel"><table><thead><tr><th>Income</th><th>Event</th><th>Type</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>${items.length?items.map(x=>`<tr><td><b>${escapeHtml(x.incomeId)}</b><small>${escapeHtml(x.date)}${x.reference?' · '+escapeHtml(x.reference):''}</small></td><td>${escapeHtml(x.eventId||'Business')}</td><td>${escapeHtml(String(x.type).replaceAll('_',' '))}</td><td>${escapeHtml(x.method)}</td><td class="money">${money(x.amount)}</td><td><span class="${statusClass(x.status)}">${escapeHtml(x.status)}</span></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No income found.</td></tr>'}</tbody></table></section>`; }
  async function incomeModal(presetEventId=''){
    if(!state.events.length) state.events=await API.request('listEvents');
    const opts=state.events.map(e=>`<option value="${escapeHtml(e.eventId)}" ${e.eventId===presetEventId?'selected':''}>${escapeHtml(e.eventId)} — ${escapeHtml(e.name)}</option>`).join('');showModal('Add Income',`<form id="incomeForm" class="form-grid"><label class="span-2">Event<select name="eventId"><option value="">General Business Income</option>${opts}</select></label><label>Income type<select name="type"><option value="EVENT_ADVANCE">Event Advance</option><option value="EVENT_PAYMENT">Event Payment</option><option value="FINAL_SETTLEMENT">Final Settlement</option><option value="EQUIPMENT_RENTAL">Equipment Rental</option><option value="OTHER_EVENT_INCOME">Other Event Income</option><option value="OTHER_BUSINESS_INCOME">Other Business Income</option></select></label><label>Amount (LKR)<input type="number" min="0.01" step="0.01" name="amount" required></label><label>Payment method<select name="method"><option>CASH</option><option>BANK</option><option>CARD</option><option>OTHER</option></select></label><label>Date<input type="date" name="date" value="${today()}"></label><label class="span-2">Reference<input name="reference"></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Submit Income</button></div></form>`);$('#incomeForm').onsubmit=async e=>{e.preventDefault();try{await API.request('createIncome',Object.fromEntries(new FormData(e.target)));closeModal();toast(session.user.role==='FINANCE_HEAD'?'Income approved and recorded.':'Income submitted for approval.');if(state.route==='eventDetail')openEvent(state.currentEvent.eventId,'income');else navigate('income');}catch(err){toast(err.message,'error')}};bindModalCloseButtons();
  }


  function quotationStatusOptions(selected='DRAFT'){
    return ['DRAFT','SENT','ACCEPTED','REJECTED','SUPERSEDED','CANCELLED'].map(s=>`<option value="${s}" ${s===selected?'selected':''}>${displayStatus(s)}</option>`).join('');
  }
  function formatPrettyDate(v){
    if(!v) return '—';
    const d=new Date(`${String(v).slice(0,10)}T00:00:00`);
    if(Number.isNaN(d.getTime())) return escapeHtml(v);
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  }
  function quoteDiscountText(q){
    if(!Number(q.discountAmount||0)) return '';
    return q.discountType==='PERCENT' ? `${Number(q.discountValue||0).toFixed(1)}% discount` : 'Discount';
  }
  function quotationLinesHtml(lines){
    const sorted=(lines||[]).slice().sort((a,b)=>Number(a.displayOrder||0)-Number(b.displayOrder||0));
    const groups=[]; let current=null;
    sorted.forEach(line=>{
      if(line.level==='MAIN'){ current={main:line,subs:[]}; groups.push(current); }
      else if(line.level==='SUB'){ if(!current){current={main:{mainItem:line.mainItem||'Event Services',description:''},subs:[]};groups.push(current);} current.subs.push(line); }
    });
    return groups.map(g=>`<div class="quote-group"><div class="quote-group-head"><h4>${escapeHtml(g.main.mainItem)}</h4>${g.main.description?`<p>${escapeHtml(g.main.description)}</p>`:''}</div>${g.subs.map(sub=>`<div class="quote-line"><div><strong>${escapeHtml(sub.subItem||sub.description)}</strong>${sub.description&&sub.description!==sub.subItem?`<small>${escapeHtml(sub.description)}</small>`:''}</div><b>${quoteMoney(sub.amount)}</b></div>`).join('')}</div>`).join('');
  }
  function quotationPreviewHtml(q, compact=false){
    const e=q.event||state.currentEvent||{};
    const c=q.customer||e.customer||{};
    return `<article class="quotation-sheet ${compact?'compact':''}" data-print-quotation>
      <header class="quotation-brand"><div class="quotation-logo">DE</div><div><h2>Dream Events</h2><p>Making moments beautifully memorable</p><p class="quotation-contact">${escapeHtml(CFG.COMPANY_PHONE||'+94 70 628 0480')}</p></div><div class="quotation-title"><span>QUOTATION</span><strong>${escapeHtml(q.quotationNumber||'Draft')}</strong></div></header>
      <div class="quotation-meta-grid">
        <div><span>Prepared for</span><strong>${escapeHtml(c.name||e.customerName||'Customer')}</strong><small>${escapeHtml(c.mobile||'')}${c.email?` · ${escapeHtml(c.email)}`:''}</small></div>
        <div><span>Event</span><strong>${escapeHtml(e.name||'')}</strong><small>${escapeHtml(e.type||'Event')} · ${formatPrettyDate(e.date)}</small></div>
        <div><span>Venue</span><strong>${escapeHtml(e.venue||'TBC')}</strong></div>
        <div><span>Issue date</span><strong>${formatPrettyDate(q.issueDate)}</strong></div>
        <div><span>Valid until</span><strong>${formatPrettyDate(q.validUntil)}</strong></div>
      </div>
      <section class="quotation-items">${quotationLinesHtml(q.lines||[])||'<div class="empty">No customer-visible budget items.</div>'}</section>
      <div class="quotation-totals">
        <div><span>Subtotal</span><strong>${quoteMoney(q.subtotal)}</strong></div>
        ${Number(q.discountAmount||0)>0?`<div><span>${escapeHtml(quoteDiscountText(q))}</span><strong>− ${quoteMoney(q.discountAmount)}</strong></div>`:''}
        <div class="grand"><span>Total</span><strong>${quoteMoney(q.finalTotal)}</strong></div>
      </div>
      ${q.terms?`<section class="quotation-notes"><h4>Payment & Terms</h4><p>${escapeHtml(q.terms).replaceAll('\n','<br>')}</p></section>`:''}
      ${q.notes?`<section class="quotation-notes"><h4>Notes</h4><p>${escapeHtml(q.notes).replaceAll('\n','<br>')}</p></section>`:''}
      <section class="quotation-authorized"><div><span>Authorized by Dream Events</span><div class="authorized-line"></div><strong>Dream Events</strong></div></section>
      <footer class="quotation-footer"><span>Dream Events · ${escapeHtml(CFG.COMPANY_PHONE||'+94 70 628 0480')}</span><span>Thank you for choosing us for your special event.</span></footer>
    </article>`;
  }
  async function renderEventQuotation(){
    if(session.user.role!=='FINANCE_HEAD') throw new Error('Finance Head access required.');
    const eventId=state.currentEvent.eventId;
    const quotes=await API.request('listQuotations',{eventId});
    state.quotations=quotes;
    const body=$('#eventTabBody');
    body.innerHTML=`<div class="budget-intro"><div><p class="eyebrow">CUSTOMER DOCUMENT</p><h3>Quotations</h3><p class="muted">Create customer-facing quotations from the approved budget structure. Internal cost and margin details never appear here.</p></div><button id="createQuotationBtn" class="btn btn-primary">+ Create Quotation</button></div>
      <div class="quote-list">${quotes.length?quotes.map(quotationCardHtml).join(''):`<section class="panel empty big-empty"><div class="coming-icon">Q</div><h3>No quotation yet</h3><p>Create Version 1 from the customer-visible budget items.</p></section>`}</div>`;
    $('#createQuotationBtn').onclick=()=>quotationBuilderModal();
    bindQuotationButtons();
  }
  function quotationCardHtml(q){
    return `<article class="panel quotation-card"><div><p class="eyebrow">${escapeHtml(q.quotationNumber)}</p><h3>${quoteMoney(q.finalTotal)}</h3><p>Issued ${formatPrettyDate(q.issueDate)} · Valid until ${formatPrettyDate(q.validUntil)}</p></div><div class="quotation-card-actions"><span class="${statusClass(q.status)}">${escapeHtml(displayStatus(q.status))}</span><button class="btn btn-sm btn-secondary" data-quote-view="${escapeHtml(q.quotationId)}">Preview</button>${!['CANCELLED','REJECTED'].includes(q.status)?`<button class="btn btn-sm btn-ghost" data-quote-revise="${escapeHtml(q.quotationId)}">New Revision</button>`:''}</div></article>`;
  }
  async function quotationBuilderModal(revisionOf=''){
    const eventId=state.currentEvent?.eventId;
    if(!eventId) return;
    let draft;
    try{draft=await API.request('quotationDraftFromBudget',{eventId,revisionOf});}catch(err){toast(err.message,'error');return;}
    const issue=draft.issueDate||today();
    showModal(revisionOf?'Create Quotation Revision':'Create Quotation',`<form id="quotationForm" class="form-grid quotation-form">
      <div class="span-2 quote-builder-summary"><div><span>Event</span><strong>${escapeHtml(state.currentEvent.name)}</strong></div><div><span>Customer-visible subtotal</span><strong>${quoteMoney(draft.subtotal)}</strong></div></div>
      <label>Issue date<input type="date" name="issueDate" value="${escapeHtml(issue)}" required></label>
      <label>Valid until<input type="date" name="validUntil" value="${escapeHtml(draft.validUntil)}" required></label>
      <label>Discount type<select id="quoteDiscountType" name="discountType"><option value="NONE">No discount</option><option value="FIXED">Fixed amount</option><option value="PERCENT">Percentage</option></select></label>
      <label>Discount value<input id="quoteDiscountValue" type="number" min="0" step="0.01" name="discountValue" value="0"></label>
      <label class="span-2">Payment & terms<textarea name="terms" rows="4">${escapeHtml(draft.terms||'')}</textarea></label>
      <label class="span-2">Customer notes<textarea name="notes" rows="3">${escapeHtml(draft.notes||'')}</textarea></label>
      <div class="span-2 quote-builder-lines"><h4>Customer quotation items</h4>${quotationLinesHtml(draft.lines||[])||'<div class="empty">No visible budget items.</div>'}</div>
      <div class="span-2 quote-builder-total"><span>Quotation total</span><strong id="quoteBuilderTotal">${quoteMoney(draft.subtotal)}</strong></div>
      <div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">${revisionOf?'Create Revision':'Create Quotation'}</button></div>
    </form>`);
    const update=()=>{const type=$('#quoteDiscountType').value,val=Number($('#quoteDiscountValue').value||0),sub=Number(draft.subtotal||0);let disc=type==='FIXED'?Math.min(sub,val):type==='PERCENT'?Math.min(sub,sub*val/100):0;$('#quoteBuilderTotal').textContent=quoteMoney(Math.max(0,sub-disc));};
    $('#quoteDiscountType').onchange=update;$('#quoteDiscountValue').oninput=update;
    $('#quotationForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.eventId=eventId;data.revisionOf=revisionOf;try{const q=await API.request('createQuotation',data);closeModal();toast(`${q.quotationNumber} created.`);await openEvent(eventId,'quotation');showQuotationPreview(q.quotationId);}catch(err){toast(err.message,'error')}};
    bindModalCloseButtons();
  }
  async function showQuotationPreview(quotationId){
    try{
      const q=await API.request('getQuotation',{quotationId}); state.currentQuotation=q;
      showModal('Quotation Preview',`<div class="quotation-preview-wrap"><div class="quotation-preview-actions"><select id="quoteStatusSelect">${quotationStatusOptions(q.status)}</select><button id="saveQuoteStatusBtn" class="btn btn-secondary">Update Status</button><button id="printQuoteBtn" class="btn btn-primary">Print / Save PDF</button></div>${quotationPreviewHtml(q)}</div>`);
      $('#saveQuoteStatusBtn').onclick=async()=>{try{const updated=await API.request('updateQuotationStatus',{quotationId,status:$('#quoteStatusSelect').value});state.currentQuotation=updated;toast('Quotation status updated.');closeModal();if(state.route==='eventDetail')openEvent(q.eventId,'quotation');else navigate('sales');}catch(err){toast(err.message,'error')}};
      $('#printQuoteBtn').onclick=()=>printQuotation(q);
    }catch(err){toast(err.message,'error')}
  }
  function printQuotation(q){
    const w=window.open('','_blank','width=900,height=1000');
    if(!w){toast('Allow pop-ups to print the quotation.','error');return;}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(q.quotationNumber)}</title><style>${quotationPrintCss()}</style></head><body>${quotationPreviewHtml(q)}</body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>w.print(),250);
  }
  function quotationPrintCss(){return `*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#171511;font-family:Arial,sans-serif}.quotation-sheet{width:100%;max-width:190mm;min-height:0;margin:0 auto;padding:14mm 14mm 16mm}.quotation-brand{display:grid;grid-template-columns:52px 1fr auto;gap:14px;align-items:center;border-bottom:2px solid #b88a34;padding-bottom:16px;break-inside:avoid;page-break-inside:avoid}.quotation-logo{width:46px;height:46px;border:1px solid #b88a34;border-radius:50%;display:grid;place-items:center;font-family:Georgia,serif;font-weight:bold;color:#9a6d19}.quotation-brand h2{font-family:Georgia,serif;margin:0;font-size:24px}.quotation-brand p{margin:4px 0 0;color:#6f675a;font-size:10px}.quotation-brand .quotation-contact{color:#171511;font-weight:700;letter-spacing:.02em}.quotation-title{text-align:right}.quotation-title span{display:block;font-size:10px;letter-spacing:2px;color:#9a6d19}.quotation-title strong{font-size:13px}.quotation-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;padding:20px 0 18px;break-inside:avoid;page-break-inside:avoid}.quotation-meta-grid div{border-bottom:1px solid #e7dfd1;padding-bottom:8px}.quotation-meta-grid span,.quotation-meta-grid small{display:block;color:#756e63;font-size:10px}.quotation-meta-grid strong{display:block;margin:4px 0;font-size:12px}.quotation-items{margin-top:4px}.quote-group{margin:14px 0 24px}.quote-group-head{background:#f6f1e8;padding:12px 14px;border-radius:3px;break-after:avoid;page-break-after:avoid}.quote-group-head h4{margin:0;font-family:Georgia,serif;font-size:15px}.quote-group-head p{margin:4px 0 0;font-size:10px;line-height:1.45;color:#6f675a}.quote-line{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:14px 14px;border-bottom:1px solid #eee8de;font-size:11px;line-height:1.45;break-inside:avoid;page-break-inside:avoid}.quote-line>div{max-width:72%}.quote-line b{white-space:nowrap}.quote-line small{display:block;color:#756e63;margin-top:4px;line-height:1.4}.quotation-totals{width:48%;margin:26px 0 26px auto;break-inside:avoid;page-break-inside:avoid}.quotation-totals div{display:flex;justify-content:space-between;gap:18px;padding:8px 0;font-size:11px}.quotation-totals strong{white-space:nowrap}.quotation-totals .grand{border-top:2px solid #171511;font-size:15px;padding-top:12px}.quotation-notes{margin-top:20px;break-inside:avoid;page-break-inside:avoid}.quotation-notes h4{font-family:Georgia,serif;margin:0 0 7px}.quotation-notes p{font-size:10px;line-height:1.65;color:#504a42;margin:0}.quotation-authorized{margin:30px 0 16px;display:flex;justify-content:flex-end;break-inside:avoid;page-break-inside:avoid}.quotation-authorized>div{width:62mm;text-align:left}.quotation-authorized span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#756e63}.authorized-line{height:22px;border-bottom:1px solid #8f877c;margin-bottom:6px}.quotation-authorized strong{font-family:Georgia,serif;font-size:11px}.quotation-footer{margin-top:22px;padding-top:12px;border-top:1px solid #ddd4c4;display:flex;justify-content:space-between;gap:15px;font-size:9px;line-height:1.4;color:#756e63;break-inside:avoid;page-break-inside:avoid}@page{size:A4;margin:12mm 10mm}@media print{html,body{width:auto;height:auto}.quotation-sheet{width:auto;max-width:none;margin:0;padding:0;box-shadow:none;border:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.quotation-brand,.quotation-meta-grid,.quote-line,.quotation-totals,.quotation-notes,.quotation-authorized,.quotation-footer{break-inside:avoid;page-break-inside:avoid}.quote-group-head{break-after:avoid;page-break-after:avoid}.quote-group{break-inside:auto;page-break-inside:auto}}`;}

  function bindQuotationButtons(){
    $$('[data-quote-view]').forEach(b=>b.onclick=()=>showQuotationPreview(b.dataset.quoteView));
    $$('[data-quote-revise]').forEach(b=>b.onclick=()=>quotationBuilderModal(b.dataset.quoteRevise));
  }
  function bindInvoiceReceiptButtons(){
    $$('[data-invoice-view]').forEach(b=>b.onclick=()=>showInvoicePreview(b.dataset.invoiceView));
    $$('[data-receipt-view]').forEach(b=>b.onclick=()=>showReceiptPreview(b.dataset.receiptView));
  }
  function renderSalesDocuments(){
    if(session.user.role!=='FINANCE_HEAD') return navigate('dashboard');
    const qs=state.quotations||[], invs=state.invoices||[], receipts=state.receipts||[];
    $('#content').innerHTML=`<div class="document-register">
      <section><div class="panel-head register-head"><div><p class="eyebrow">QUOTATIONS</p><h3>Customer Quotations</h3></div></div><div class="panel table-panel"><table><thead><tr><th>Quotation</th><th>Event</th><th>Customer</th><th>Issue</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${qs.length?qs.map(q=>`<tr><td><b>${escapeHtml(q.quotationNumber)}</b><small>Version ${escapeHtml(q.version)}</small></td><td>${escapeHtml(q.event?.name||q.eventId)}</td><td>${escapeHtml(q.customer?.name||'—')}</td><td>${formatPrettyDate(q.issueDate)}</td><td class="money">${quoteMoney(q.finalTotal)}</td><td><span class="${statusClass(q.status)}">${escapeHtml(displayStatus(q.status))}</span></td><td><button class="btn btn-xs btn-secondary" data-quote-view="${escapeHtml(q.quotationId)}">Preview</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No quotations found.</td></tr>'}</tbody></table></div></section>
      <section><div class="panel-head register-head"><div><p class="eyebrow">INVOICES</p><h3>Invoices</h3></div></div><div class="panel table-panel"><table><thead><tr><th>Invoice</th><th>Event</th><th>Date</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th><th></th></tr></thead><tbody>${invs.length?invs.map(i=>`<tr><td><b>${escapeHtml(i.invoiceNumber)}</b><small>${escapeHtml(i.quotationId||'')}</small></td><td>${escapeHtml(i.event?.name||i.eventId)}</td><td>${formatPrettyDate(i.invoiceDate)}</td><td class="money">${quoteMoney(i.finalTotal)}</td><td class="money">${quoteMoney(i.amountPaid)}</td><td class="money">${quoteMoney(i.outstanding)}</td><td><span class="${statusClass(i.status)}">${escapeHtml(displayStatus(i.status))}</span></td><td><button class="btn btn-xs btn-secondary" data-invoice-view="${escapeHtml(i.invoiceId)}">Preview</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">No invoices found.</td></tr>'}</tbody></table></div></section>
      <section><div class="panel-head register-head"><div><p class="eyebrow">RECEIPTS</p><h3>Receipts</h3></div></div><div class="panel table-panel"><table><thead><tr><th>Receipt</th><th>Event</th><th>Date</th><th>Amount</th><th>Invoice</th><th></th></tr></thead><tbody>${receipts.length?receipts.map(r=>`<tr><td><b>${escapeHtml(r.receiptNumber)}</b></td><td>${escapeHtml(r.event?.name||r.eventId)}</td><td>${formatPrettyDate(r.receiptDate)}</td><td class="money">${quoteMoney(r.amount)}</td><td>${escapeHtml(r.invoice?.invoiceNumber||r.invoiceId)}</td><td><button class="btn btn-xs btn-secondary" data-receipt-view="${escapeHtml(r.receiptId)}">Preview</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No receipts found.</td></tr>'}</tbody></table></div></section>
    </div>`; bindQuotationButtons();bindInvoiceReceiptButtons();
  }

  function invoiceStatusOptions(selected='ISSUED'){
    return ['ISSUED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED'].map(x=>`<option ${x===selected?'selected':''}>${displayStatus(x)}</option>`).join('');
  }
  function documentLineGroups(lines){
    const sorted=(lines||[]).slice().sort((a,b)=>Number(a.displayOrder||0)-Number(b.displayOrder||0));
    const groups=[]; let current=null;
    sorted.forEach(line=>{
      if(line.level==='MAIN'){current={main:line,subs:[]};groups.push(current);}
      else if(line.level==='SUB'){if(!current){current={main:{mainItem:line.mainItem||'Event Services',description:''},subs:[]};groups.push(current);}current.subs.push(line);}
    });
    return groups;
  }
  function invoiceLinesHtml(lines){
    return documentLineGroups(lines).map(g=>`<div class="quote-group"><div class="quote-group-head"><h4>${escapeHtml(g.main.mainItem)}</h4>${g.main.description?`<p>${escapeHtml(g.main.description)}</p>`:''}</div>${g.subs.map(sub=>`<div class="quote-line"><div><strong>${escapeHtml(sub.subItem||sub.description)}</strong>${sub.description&&sub.description!==sub.subItem?`<small>${escapeHtml(sub.description)}</small>`:''}</div><b>${quoteMoney(sub.amount)}</b></div>`).join('')}</div>`).join('');
  }
  function invoicePreviewHtml(inv){
    const e=inv.event||state.currentEvent||{}, c=inv.customer||e.customer||{};
    return `<article class="quotation-sheet invoice-sheet" data-print-invoice>
      <header class="quotation-brand"><div class="quotation-logo">DE</div><div><h2>Dream Events</h2><p>Making moments beautifully memorable</p><p class="quotation-contact">${escapeHtml(CFG.COMPANY_PHONE||'+94 70 628 0480')}</p></div><div class="quotation-title"><span>INVOICE</span><strong>${escapeHtml(inv.invoiceNumber)}</strong></div></header>
      <div class="quotation-meta-grid">
        <div><span>Bill to</span><strong>${escapeHtml(c.name||'Customer')}</strong><small>${escapeHtml(c.mobile||'')}${c.email?' · '+escapeHtml(c.email):''}</small></div>
        <div><span>Event</span><strong>${escapeHtml(e.name||'')}</strong><small>${escapeHtml(e.type||'')} · ${formatPrettyDate(e.date)}</small></div>
        <div><span>Invoice date</span><strong>${formatPrettyDate(inv.invoiceDate)}</strong><small>Quotation ${escapeHtml(inv.quotationId||'—')}</small></div>
        <div><span>Due date</span><strong>${formatPrettyDate(inv.dueDate)}</strong><small>${escapeHtml(displayStatus(inv.status))}</small></div>
      </div>
      <section class="quotation-items">${invoiceLinesHtml(inv.lines)||'<div class="empty">No invoice items.</div>'}</section>
      <div class="quotation-totals">
        <div><span>Subtotal</span><b>${quoteMoney(inv.subtotal)}</b></div>
        ${Number(inv.discount||0)?`<div><span>Discount</span><b>− ${quoteMoney(inv.discount)}</b></div>`:''}
        <div class="grand"><span>Invoice total</span><b>${quoteMoney(inv.finalTotal)}</b></div>
        <div><span>Paid</span><b>${quoteMoney(inv.amountPaid)}</b></div>
        <div class="grand outstanding-total"><span>Outstanding</span><b>${quoteMoney(inv.outstanding)}</b></div>
      </div>
      <section class="quotation-authorized"><div><span>Authorized by Dream Events</span><div class="authorized-line"></div><strong>Dream Events</strong></div></section>
      <footer class="quotation-footer"><span>Dream Events · ${escapeHtml(CFG.COMPANY_PHONE||'+94 70 628 0480')}</span><span>Thank you for choosing Dream Events.</span></footer>
    </article>`;
  }
  function receiptPreviewHtml(r){
    const e=r.event||{}, c=r.customer||{}, inv=r.invoice||{};
    return `<article class="quotation-sheet receipt-sheet" data-print-receipt>
      <header class="quotation-brand"><div class="quotation-logo">DE</div><div><h2>Dream Events</h2><p>Making moments beautifully memorable</p><p class="quotation-contact">${escapeHtml(CFG.COMPANY_PHONE||'+94 70 628 0480')}</p></div><div class="quotation-title"><span>RECEIPT</span><strong>${escapeHtml(r.receiptNumber)}</strong></div></header>
      <div class="quotation-meta-grid receipt-meta">
        <div><span>Received from</span><strong>${escapeHtml(c.name||'Customer')}</strong><small>${escapeHtml(c.mobile||'')}</small></div>
        <div><span>Event</span><strong>${escapeHtml(e.name||'')}</strong><small>${escapeHtml(e.eventId||'')}</small></div>
        <div><span>Receipt date</span><strong>${formatPrettyDate(r.receiptDate)}</strong><small>Invoice ${escapeHtml(inv.invoiceNumber||r.invoiceId||'—')}</small></div>
        <div><span>Payment method</span><strong>${escapeHtml(displayStatus(r.paymentMethod||'—'))}</strong><small>${r.reference?'Reference '+escapeHtml(r.reference):'No reference'}</small></div>
      </div>
      <section class="receipt-amount"><span>Amount received</span><strong>${quoteMoney(r.amount)}</strong><p>Thank you. This payment has been recorded against ${escapeHtml(inv.invoiceNumber||r.invoiceId||'the event invoice')}.</p></section>
      <div class="receipt-balance"><span>Remaining invoice balance</span><strong>${quoteMoney(r.remainingBalance)}</strong></div>
      <section class="quotation-authorized"><div><span>Authorized by Dream Events</span><div class="authorized-line"></div><strong>Dream Events</strong></div></section>
      <footer class="quotation-footer"><span>Dream Events · ${escapeHtml(CFG.COMPANY_PHONE||'+94 70 628 0480')}</span><span>Payment receipt</span></footer>
    </article>`;
  }
  function invoicePrintCss(){ return quotationPrintCss()+`.outstanding-total{margin-top:4px;border-top:1px dashed #cbbd9d}.receipt-amount{margin:24px 0;padding:24px;border:1px solid #ddd4c4;border-radius:16px;text-align:center;break-inside:avoid}.receipt-amount span{display:block;text-transform:uppercase;letter-spacing:.12em;font-size:9px;color:#756e63}.receipt-amount strong{display:block;font-family:Georgia,serif;font-size:30px;margin:8px 0}.receipt-amount p{font-size:10px;color:#756e63}.receipt-balance{display:flex;justify-content:space-between;gap:16px;padding:15px 0;border-top:1px solid #ddd4c4;border-bottom:1px solid #ddd4c4;font-size:11px;break-inside:avoid}.receipt-balance strong{font-size:15px}`; }
  function printDoc(title,html){
    const w=window.open('','_blank','width=900,height=1000'); if(!w){toast('Allow pop-ups to print this document.','error');return;}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${invoicePrintCss()}</style></head><body>${html}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  async function renderEventPayments(){
    if(session.user.role!=='FINANCE_HEAD') throw new Error('Finance Head access required.');
    const eventId=state.currentEvent.eventId;
    const [invoices,plans,payments,receipts,quotes]=await Promise.all([
      API.request('listInvoices',{eventId}),API.request('listPaymentPlans',{eventId}),API.request('listPayments',{eventId}),API.request('listReceipts',{eventId}),API.request('listQuotations',{eventId})
    ]);
    state.invoices=invoices;state.paymentPlans=plans;state.payments=payments;state.receipts=receipts;
    const activeInvoice=invoices.find(x=>x.status!=='CANCELLED')||null;
    const accepted=quotes.find(x=>x.status==='ACCEPTED')||null;
    if(!activeInvoice){
      $('#eventTabBody').innerHTML=`<div class="budget-intro"><div><p class="eyebrow">CUSTOMER FINANCE</p><h3>Invoice & Payments</h3><p class="muted">Create an invoice from the accepted quotation, then define payment milestones and record customer payments.</p></div>${accepted?'<button id="createInvoiceBtn" class="btn btn-primary">+ Create Invoice</button>':''}</div>${accepted?`<section class="panel finance-start-card"><p class="eyebrow">ACCEPTED QUOTATION</p><h3>${escapeHtml(accepted.quotationNumber)}</h3><strong>${quoteMoney(accepted.finalTotal)}</strong><p>Ready to invoice.</p></section>`:`<section class="panel empty big-empty"><div class="coming-icon">✓</div><h3>Accept a quotation first</h3><p>An invoice can only be created from the customer-approved quotation.</p></section>`}`;
      $('#createInvoiceBtn')?.addEventListener('click',()=>invoiceCreateModal(accepted)); return;
    }
    const invoicePlans=plans.filter(x=>x.invoiceId===activeInvoice.invoiceId);
    const invoicePaymentsRows=payments.filter(x=>x.invoiceId===activeInvoice.invoiceId);
    const invoiceReceipts=receipts.filter(x=>x.invoiceId===activeInvoice.invoiceId);
    $('#eventTabBody').innerHTML=`
      <div class="budget-intro"><div><p class="eyebrow">CUSTOMER FINANCE</p><h3>Invoice & Payments</h3><p class="muted">Track milestones, payments, receipts and the customer outstanding balance.</p></div><div class="inline-actions"><button id="previewInvoiceBtn" class="btn btn-secondary">Preview Invoice</button>${Number(activeInvoice.outstanding)>0?'<button id="recordPaymentBtn" class="btn btn-primary">+ Record Payment</button>':''}</div></div>
      <div class="metric-grid payment-metrics">${card('Invoice Total',quoteMoney(activeInvoice.finalTotal))}${card('Paid',quoteMoney(activeInvoice.amountPaid))}${card('Outstanding',quoteMoney(activeInvoice.outstanding))}${card('Status',displayStatus(activeInvoice.status),`Due ${formatPrettyDate(activeInvoice.dueDate)}`)}</div>
      <div class="section-grid payment-grid">
        <section class="panel"><div class="panel-head"><div><p class="eyebrow">PAYMENT PLAN</p><h3>Milestones</h3></div>${invoicePlans.length||invoicePaymentsRows.length?'':'<button id="createPlanBtn" class="btn btn-sm btn-secondary">Create Plan</button>'}</div>
          ${invoicePlans.length?paymentPlanTable(invoicePlans):`<div class="empty">${invoicePaymentsRows.length?'Payments are being recorded directly against the invoice. A milestone plan can only be created before the first payment.':'No payment plan yet. You can still record direct invoice payments, or create a structured milestone plan.'}</div>`}
        </section>
        <section class="panel"><div class="panel-head"><div><p class="eyebrow">PAYMENT HISTORY</p><h3>Customer Payments</h3></div></div>${paymentHistoryHtml(invoicePaymentsRows,invoiceReceipts)}</section>
      </div>`;
    $('#previewInvoiceBtn').onclick=()=>showInvoicePreview(activeInvoice.invoiceId);
    $('#recordPaymentBtn')?.addEventListener('click',()=>recordPaymentModal(activeInvoice,invoicePlans));
    $('#createPlanBtn')?.addEventListener('click',()=>paymentPlanModal(activeInvoice));
    $$('[data-receipt-view]').forEach(b=>b.onclick=()=>showReceiptPreview(b.dataset.receiptView));
  }
  function paymentPlanTable(rows){
    return `<div class="payment-plan-list">${rows.map(r=>`<div class="payment-plan-row"><div><strong>${escapeHtml(r.milestoneName)}</strong><small>${formatPrettyDate(r.dueDate)} · ${Number(r.percentage||0).toFixed(0)}%</small></div><div><span>Expected</span><b>${quoteMoney(r.expectedAmount)}</b></div><div><span>Received</span><b>${quoteMoney(r.receivedAmount)}</b></div><div><span>Balance</span><b>${quoteMoney(r.balance)}</b></div><span class="${statusClass(r.status)}">${escapeHtml(displayStatus(r.status))}</span></div>`).join('')}</div>`;
  }
  function paymentHistoryHtml(payments,receipts){
    if(!payments.length)return '<div class="empty">No customer payments recorded yet.</div>';
    const receiptByPayment=Object.fromEntries(receipts.map(r=>[r.paymentId,r]));
    return `<div class="payment-history">${payments.map(p=>{const r=receiptByPayment[p.paymentId];return `<div class="payment-history-row"><div><strong>${quoteMoney(p.amount)}</strong><small>${formatPrettyDate(p.paymentDate)} · ${escapeHtml(displayStatus(p.method))}${p.reference?' · '+escapeHtml(p.reference):''}</small></div>${r?`<button class="btn btn-xs btn-secondary" data-receipt-view="${escapeHtml(r.receiptId)}">${escapeHtml(r.receiptNumber)}</button>`:''}</div>`}).join('')}</div>`;
  }
  function invoiceCreateModal(q){
    const eventDate=state.currentEvent?.date||today();
    showModal('Create Invoice',`<form id="invoiceForm" class="form-grid"><div class="span-2 summary-strip"><div><span>Accepted quotation</span><strong>${escapeHtml(q.quotationNumber)}</strong></div><div><span>Invoice total</span><strong>${quoteMoney(q.finalTotal)}</strong></div></div><label>Invoice date<input type="date" name="invoiceDate" value="${today()}" required></label><label>Due date<input type="date" name="dueDate" value="${escapeHtml(eventDate)}" required></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Create Invoice</button></div></form>`);
    $('#invoiceForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.quotationId=q.quotationId;try{const inv=await API.request('createInvoiceFromQuotation',data);closeModal();toast(`${inv.invoiceNumber} created.`);await openEvent(state.currentEvent.eventId,'payments');showInvoicePreview(inv.invoiceId);}catch(err){toast(err.message,'error')}};bindModalCloseButtons();
  }
  function paymentPlanModal(inv){
    showModal('Create Payment Plan',`<form id="paymentPlanForm" class="form-grid"><label class="span-2">Plan type<select id="planType" name="planType"><option value="STANDARD_50_50">50% Booking / 50% Final</option><option value="STANDARD_30_70">30% Booking / 70% Final</option><option value="CUSTOM">Custom milestones</option></select></label><div id="planEditor" class="span-2"></div><div class="plan-total span-2"><span>Invoice total</span><strong>${quoteMoney(inv.finalTotal)}</strong><span id="planDifference"></span></div><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save Payment Plan</button></div></form>`);
    const render=()=>renderPaymentPlanEditor(inv,$('#planType').value);$('#planType').onchange=render;render();
    $('#paymentPlanForm').onsubmit=async e=>{e.preventDefault();const rows=$$('[data-plan-row]').map(r=>({name:$('[name="milestoneName"]',r).value.trim(),amount:Number($('[name="milestoneAmount"]',r).value||0),dueDate:$('[name="milestoneDue"]',r).value})).filter(r=>r.name&&r.amount>0);try{await API.request('createPaymentPlan',{invoiceId:inv.invoiceId,planType:$('#planType').value,milestones:rows});closeModal();toast('Payment plan created.');openEvent(inv.eventId,'payments');}catch(err){toast(err.message,'error')}};bindModalCloseButtons();
  }
  function renderPaymentPlanEditor(inv,type){
    const editor=$('#planEditor'), total=Number(inv.finalTotal||0), firstDate=today(), finalDate=inv.dueDate||state.currentEvent?.date||today();
    let rows=[];
    if(type==='STANDARD_50_50'){const first=Math.round(total*.5);rows=[['Booking Advance',first,firstDate],['Final Balance',total-first,finalDate]];}
    else if(type==='STANDARD_30_70'){const first=Math.round(total*.3);rows=[['Booking Advance',first,firstDate],['Final Balance',total-first,finalDate]];}
    else rows=[['Booking Advance',0,firstDate],['Final Balance',total,finalDate]];
    editor.innerHTML=`<div class="plan-editor"><div class="plan-editor-head"><h4>Milestones</h4>${type==='CUSTOM'?'<button type="button" id="addPlanRow" class="btn btn-xs btn-secondary">+ Milestone</button>':''}</div><div id="planRows">${rows.map((r,i)=>planRowHtml(r[0],r[1],r[2],type==='CUSTOM',i)).join('')}</div></div>`;
    $('#addPlanRow')?.addEventListener('click',()=>{$('#planRows').insertAdjacentHTML('beforeend',planRowHtml('Milestone',0,finalDate,true,$$('[data-plan-row]').length));bindPlanRowControls(inv);});bindPlanRowControls(inv);
  }
  function planRowHtml(name,amount,due,removable,index){return `<div class="plan-editor-row" data-plan-row><label>Milestone<input name="milestoneName" value="${escapeHtml(name)}"></label><label>Amount (LKR)<input type="number" min="0" step="1" name="milestoneAmount" value="${Number(amount||0)}"></label><label>Due date<input type="date" name="milestoneDue" value="${escapeHtml(due)}"></label>${removable&&index>1?'<button type="button" class="icon-btn danger" data-remove-plan title="Remove">×</button>':'<span></span>'}</div>`;}
  function bindPlanRowControls(inv){
    $$('[data-remove-plan]').forEach(b=>b.onclick=()=>{b.closest('[data-plan-row]').remove();updatePlanDifference(inv)});$$('[data-plan-row] input').forEach(i=>i.oninput=()=>updatePlanDifference(inv));updatePlanDifference(inv);
  }
  function updatePlanDifference(inv){const sum=$$('[name="milestoneAmount"]').reduce((a,i)=>a+Number(i.value||0),0),diff=Math.round(Number(inv.finalTotal||0)-sum),el=$('#planDifference');if(el)el.textContent=diff===0?'Plan matches invoice':diff>0?`${quoteMoney(diff)} still unallocated`:`${quoteMoney(Math.abs(diff))} over invoice total`;}
  function recordPaymentModal(inv,plans){
    const available=plans.filter(p=>Number(p.balance||0)>0);showModal('Record Customer Payment',`<form id="paymentForm" class="form-grid"><div class="span-2 summary-strip"><div><span>Invoice</span><strong>${escapeHtml(inv.invoiceNumber)}</strong></div><div><span>Outstanding</span><strong>${quoteMoney(inv.outstanding)}</strong></div></div><label class="span-2">Payment milestone<select name="paymentPlanId">${available.length?'<option value="">Select milestone</option>':'<option value="">General invoice payment</option>'}${available.map(p=>`<option value="${escapeHtml(p.paymentPlanId)}">${escapeHtml(p.milestoneName)} — balance ${quoteMoney(p.balance)}</option>`).join('')}</select></label><label>Amount (LKR)<input type="number" min="1" max="${Number(inv.outstanding||0)}" step="0.01" name="amount" required></label><label>Payment method<select name="method"><option value="BANK">Bank Transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label><label>Date<input type="date" name="date" value="${today()}" required></label><label>Reference<input name="reference" placeholder="Bank/reference number"></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Record & Generate Receipt</button></div></form>`);
    $('#paymentForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.invoiceId=inv.invoiceId;try{const out=await API.request('recordPayment',data);closeModal();toast(`${out.receipt.receiptNumber} generated.`);await openEvent(inv.eventId,'payments');showReceiptPreview(out.receipt.receiptId);}catch(err){toast(err.message,'error')}};bindModalCloseButtons();
  }
  async function showInvoicePreview(invoiceId){try{const inv=await API.request('getInvoice',{invoiceId});state.currentInvoice=inv;showModal('Invoice Preview',`<div class="quotation-preview-wrap"><div class="quotation-preview-actions"><button id="printInvoiceBtn" class="btn btn-primary">Print / Save PDF</button></div>${invoicePreviewHtml(inv)}</div>`);$('#printInvoiceBtn').onclick=()=>printDoc(inv.invoiceNumber,invoicePreviewHtml(inv));}catch(err){toast(err.message,'error')}}
  async function showReceiptPreview(receiptId){try{const r=await API.request('getReceipt',{receiptId});state.currentReceipt=r;showModal('Receipt Preview',`<div class="quotation-preview-wrap"><div class="quotation-preview-actions"><button id="printReceiptBtn" class="btn btn-primary">Print / Save PDF</button></div>${receiptPreviewHtml(r)}</div>`);$('#printReceiptBtn').onclick=()=>printDoc(r.receiptNumber,receiptPreviewHtml(r));}catch(err){toast(err.message,'error')}}

  function renderComingSoon(title){ $('#content').innerHTML=`<section class="panel empty big-empty"><div class="coming-icon">✦</div><h3>${escapeHtml(title)}</h3><p>The database structure is already reserved for this module. It will be connected in a later build phase.</p></section>`; }
  function bindRouteLinks(){ $$('[data-go]').forEach(x=>x.onclick=()=>navigate(x.dataset.go)); bindOpenEventButtons(); }
  function bindOpenEventButtons(){ $$('[data-open-event]').forEach(x=>x.onclick=()=>openEvent(x.dataset.openEvent)); }
  function bindModalCloseButtons(){ $$('[data-close]').forEach(x=>x.onclick=closeModal); }

  $('#loginForm').addEventListener('submit',login);
  $('#logoutBtn').addEventListener('click',logout);
  $('#modalClose').addEventListener('click',closeModal);
  $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
  $('#mainNav').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b){navigate(b.dataset.route);document.body.classList.remove('nav-open')}});
  $('#menuBtn').onclick=()=>document.body.classList.toggle('nav-open');
  $('#quickExpenseBtn').onclick=async()=>{state.events=await API.request('listEvents');expenseModal()};
  $('#quickIncomeBtn').onclick=async()=>{state.events=await API.request('listEvents');incomeModal()};
  $('#demoHint').textContent=CFG.DEMO_MODE?'Demo login: finance / demo123  |  team / demo123':'Connected to Dream Events backend';
  if(CFG.DEMO_MODE) API.initMock();
  boot();
})();
