(() => {
  const API = window.DE_API;
  const CFG = window.DREAM_EVENTS_CONFIG;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let session = API.getSession();
  let state = { route:'dashboard', customers:[], events:[], expenses:[], income:[], currentEvent:null, currentEventTab:'overview', budget:null };

  const money = v => `${CFG.CURRENCY} ${Number(v||0).toLocaleString('en-LK', {maximumFractionDigits:2})}`;
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
    const tabs=[['overview','Overview'],...(finance?[['budget','Budget']]:[]),['expenses','Expenses'],['income','Income']];
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
    }catch(err){body.innerHTML=`<div class="empty error-box">${escapeHtml(err.message)}</div>`}
  }
  function renderEventOverview(){
    const e=state.currentEvent, finance=session.user.role==='FINANCE_HEAD';
    const outstanding=finance?Math.max(0,Number(e.confirmedValue||0)-Number(e.approvedIncome||0)):0;
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
    $('#eventTabBody').innerHTML=`
      <div class="budget-intro"><div><p class="eyebrow">INTERNAL BUDGET · VERSION ${escapeHtml(b.header.version||1)}</p><h3>Event Budget Planning</h3><p class="muted">Build the budget as Main Item → Sub Item → Detailed Item. Internal costs and margins remain Finance Head-only.</p></div><button id="addMainItemBtn" class="btn btn-primary">+ Main Item</button></div>
      <div class="metric-grid budget-metrics">
        ${card('Estimated Revenue',money(s.estimatedRevenue))}${card('Estimated Cost',money(s.estimatedCost))}${card('Expected Profit',money(s.estimatedProfit),pct(s.estimatedMargin)+' margin')}${card('Actual Cost',money(s.actualCost))}
        ${card('Actual Revenue',money(s.actualRevenue))}${card('Actual Profit',money(s.actualProfit),pct(s.actualMargin)+' margin')}${card('Unlinked Expenses',money(s.approvedUnlinked),'approved event expenses')}${card('Variance',money(s.actualCost-s.estimatedCost),(s.actualCost-s.estimatedCost)>0?'over estimate':'vs estimate')}
      </div>
      <div class="budget-guidance"><strong>Customer pricing rule:</strong> Enter the customer selling price at the <b>Sub Item</b> level for a grouped quotation, or leave the Sub Item price at 0 and price its Detailed Items individually. This prevents double-counting quotation revenue.</div>
      <div id="budgetTree" class="budget-tree">${budgetTreeHtml(b.lines,s)}</div>`;
    $('#addMainItemBtn').onclick=()=>budgetLineModal('MAIN');
    bindBudgetActions();
  }
  function budgetTreeHtml(lines,summary){
    const mains=lines.filter(x=>x.level==='MAIN').sort((a,b)=>a.displayOrder-b.displayOrder);
    if(!mains.length) return `<section class="panel empty big-empty"><div class="coming-icon">＋</div><h3>Start your event budget</h3><p>Add a Main Item such as Decoration, Photography, Catering or Entertainment.</p></section>`;
    return mains.map(main=>{
      const subs=lines.filter(x=>x.level==='SUB'&&x.parentLineId===main.budgetLineId).sort((a,b)=>a.displayOrder-b.displayOrder);
      const mainEst=subCost(lines,main.budgetLineId,'estimated',summary);
      const mainAct=subCost(lines,main.budgetLineId,'actual',summary);
      return `<section class="budget-main panel">
        <div class="budget-main-head"><div><p class="eyebrow">MAIN ITEM</p><h3>${escapeHtml(main.mainItem)}</h3><span>${money(mainEst)} estimated · ${money(mainAct)} actual</span></div><div class="row-actions"><button class="btn btn-xs btn-secondary" data-budget-add="SUB" data-parent="${main.budgetLineId}">+ Sub Item</button><button class="icon-action" title="Edit" data-budget-edit="${main.budgetLineId}">✎</button><button class="icon-action danger" title="Remove" data-budget-delete="${main.budgetLineId}">×</button></div></div>
        <div class="budget-sub-list">${subs.length?subs.map(sub=>budgetSubHtml(sub,lines,summary)).join(''):'<div class="empty budget-empty">No sub items yet.</div>'}</div>
      </section>`;
    }).join('');
  }
  function budgetSubHtml(sub,lines,summary){
    const details=lines.filter(x=>x.level==='DETAIL'&&x.parentLineId===sub.budgetLineId).sort((a,b)=>a.displayOrder-b.displayOrder);
    const est=details.reduce((a,d)=>a+Number(d.estimatedQty||0)*Number(d.estimatedUnitCost||0),0);
    const act=details.reduce((a,d)=>a+detailActual(d,summary),0);
    return `<div class="budget-sub">
      <div class="budget-sub-head"><div><p class="budget-kicker">SUB ITEM</p><h4>${escapeHtml(sub.subItem)}</h4><div class="budget-sub-meta"><span>Est. cost <b>${money(est)}</b></span><span>Actual <b>${money(act)}</b></span><span>Customer price <b>${money(sub.sellingPrice)}</b></span>${sub.quotationVisible?'<span class="quote-chip">Quotation visible</span>':'<span class="quote-chip muted-chip">Internal only</span>'}</div></div><div class="row-actions"><button class="btn btn-xs btn-ghost" data-budget-add="DETAIL" data-parent="${sub.budgetLineId}">+ Detailed Item</button><button class="icon-action" data-budget-edit="${sub.budgetLineId}">✎</button><button class="icon-action danger" data-budget-delete="${sub.budgetLineId}">×</button></div></div>
      ${details.length?`<div class="budget-detail-table"><div class="budget-detail-row header"><span>Detailed item</span><span>Estimate</span><span>Customer price</span><span>Actual</span><span>Variance</span><span></span></div>${details.map(d=>budgetDetailHtml(d,summary)).join('')}</div>`:'<div class="empty budget-empty">No detailed items yet.</div>'}
    </div>`;
  }
  function detailActual(d,summary){ const linked=Number(summary.linkedByLine?.[d.budgetLineId]||0); const manual=Number(d.actualQty||0)*Number(d.actualUnitCost||0); return linked>0?linked:manual; }
  function subCost(lines,mainId,kind,summary){
    const subIds=lines.filter(x=>x.level==='SUB'&&x.parentLineId===mainId).map(x=>x.budgetLineId);
    return lines.filter(x=>x.level==='DETAIL'&&subIds.includes(x.parentLineId)).reduce((a,d)=>a+(kind==='estimated'?Number(d.estimatedQty||0)*Number(d.estimatedUnitCost||0):detailActual(d,summary)),0);
  }
  function budgetDetailHtml(d,summary){
    const estimated=Number(d.estimatedQty||0)*Number(d.estimatedUnitCost||0); const linked=Number(summary.linkedByLine?.[d.budgetLineId]||0); const actual=detailActual(d,summary); const variance=actual-estimated;
    return `<div class="budget-detail-row"><span><b>${escapeHtml(d.detailedItem)}</b><small>${escapeHtml(d.estimatedQty||0)} ${escapeHtml(d.unit||'unit')} × ${money(d.estimatedUnitCost)}${linked>0?`<em>Actual from approved expenses</em>`:''}</small></span><span>${money(estimated)}</span><span>${money(d.sellingPrice)}</span><span>${money(actual)}</span><span class="${variance>0?'variance-over':variance<0?'variance-under':''}">${variance===0?'—':`${variance>0?'+':''}${money(variance)}`}</span><span class="row-actions"><button class="icon-action" data-budget-edit="${d.budgetLineId}">✎</button><button class="icon-action danger" data-budget-delete="${d.budgetLineId}">×</button></span></div>`;
  }
  function bindBudgetActions(){
    $$('[data-budget-add]').forEach(b=>b.onclick=()=>budgetLineModal(b.dataset.budgetAdd,b.dataset.parent));
    $$('[data-budget-edit]').forEach(b=>b.onclick=()=>{const line=state.budget.lines.find(x=>x.budgetLineId===b.dataset.budgetEdit);if(line)budgetLineModal(line.level,line.parentLineId,line)});
    $$('[data-budget-delete]').forEach(b=>b.onclick=()=>deleteBudgetLine(b.dataset.budgetDelete));
  }
  function budgetLineModal(level,parentLineId='',existing=null){
    const labels={MAIN:'Main Item',SUB:'Sub Item',DETAIL:'Detailed Item'}; const name=existing?(existing.mainItem||existing.subItem||existing.detailedItem):'';
    let extra='';
    if(level==='SUB') extra=`<label>Customer selling price (LKR)<input type="number" min="0" step="0.01" name="sellingPrice" value="${escapeHtml(existing?.sellingPrice||0)}"></label><label class="check-label"><input type="checkbox" name="quotationVisible" ${existing?.quotationVisible===false?'':'checked'}> Show on quotation</label>`;
    if(level==='DETAIL') extra=`
      <label>Estimated quantity<input type="number" min="0" step="0.01" name="estimatedQty" value="${escapeHtml(existing?.estimatedQty||0)}"></label><label>Unit<input name="unit" value="${escapeHtml(existing?.unit||'')}" placeholder="pcs / bunch / day / lot"></label>
      <label>Estimated unit cost (LKR)<input type="number" min="0" step="0.01" name="estimatedUnitCost" value="${escapeHtml(existing?.estimatedUnitCost||0)}"></label><label>Customer selling price (optional)<input type="number" min="0" step="0.01" name="sellingPrice" value="${escapeHtml(existing?.sellingPrice||0)}"></label>
      <label>Actual quantity <small>Optional if linked expenses are used</small><input type="number" min="0" step="0.01" name="actualQty" value="${escapeHtml(existing?.actualQty||0)}"></label><label>Actual unit cost (LKR)<input type="number" min="0" step="0.01" name="actualUnitCost" value="${escapeHtml(existing?.actualUnitCost||0)}"></label>
      <label class="check-label span-2"><input type="checkbox" name="quotationVisible" ${existing?.quotationVisible===false?'':'checked'}> Eligible to show on quotation when its Sub Item has no grouped selling price</label>`;
    showModal(`${existing?'Edit':'Add'} ${labels[level]}`,`<form id="budgetLineForm" class="form-grid"><label class="span-2">${labels[level]} name<input name="name" required value="${escapeHtml(name)}" placeholder="${level==='MAIN'?'Decoration':level==='SUB'?'Flowers':'White Roses'}"></label>${extra}<label class="span-2">${level==='MAIN'?'Description':'Internal notes'}<textarea name="internalNotes">${escapeHtml(existing?.internalNotes||existing?.description||'')}</textarea></label><div class="form-actions span-2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">${existing?'Save Changes':'Add Item'}</button></div></form>`);
    $('#budgetLineForm').onsubmit=async e=>{
      e.preventDefault(); const fd=new FormData(e.target); const data=Object.fromEntries(fd); data.quotationVisible=fd.has('quotationVisible'); data.eventId=state.currentEvent.eventId; data.level=level; data.parentLineId=parentLineId||''; data.internalNotes=data.internalNotes||'';
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
