(() => {
  const API = window.DE_API;
  const CFG = window.DREAM_EVENTS_CONFIG;
  if (!API || !CFG) return;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = v => v === null || v === undefined ? '—' : `${CFG.CURRENCY || 'LKR'} ${Number(v || 0).toLocaleString('en-LK',{maximumFractionDigits:2})}`;
  const pct = v => v === null || v === undefined ? '—' : `${Number(v || 0).toFixed(1)}%`;
  const displayStatus = s => String(s || '').replaceAll('_',' ');
  const statusClass = s => `status ${String(s || '').toLowerCase().replaceAll('_','-').replaceAll(' ','-')}`;
  const isFinance = () => API.getSession()?.user?.role === 'FINANCE_HEAD';

  let overview = null;
  let currentEventReport = null;

  function setReportsRoute(){
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route==='reports'));
    $('#pageEyebrow').textContent='DREAM EVENTS';
    $('#pageTitle').textContent='Reports & Profit Analysis';
    document.body.classList.remove('nav-open');
  }

  function installReportsRoute(){
    const nav=$('#mainNav');
    if(!nav)return;
    nav.addEventListener('click',e=>{
      const btn=e.target.closest('[data-route="reports"]');
      if(!btn)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openReports();
    },true);
  }

  async function openReports(force=false){
    if(!isFinance())return;
    setReportsRoute();
    $('#content').innerHTML='<div class="loading">Building profitability report…</div>';
    try{
      overview=await API.request('getReportsOverview',{force:!!force});
      renderOverview();
    }catch(err){
      $('#content').innerHTML=`<div class="empty error-box"><h3>Unable to load reports</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  function metric(label,value,sub=''){
    return `<article class="metric-card"><span>${esc(label)}</span><strong>${value}</strong>${sub?`<small>${esc(sub)}</small>`:''}</article>`;
  }

  function profitClass(v){
    if(v===null||v===undefined)return 'neutral';
    return Number(v)<0?'negative':'positive';
  }

  function marginClass(v){
    if(v===null||v===undefined)return '';
    return Number(v)<0?'report-margin-loss':'report-margin-good';
  }

  function overviewRows(items){
    if(!items.length)return '<tr><td colspan="11" class="empty">No event financial data found.</td></tr>';
    return items.map(r=>`<tr data-report-event="${esc(r.eventId)}">
      <td><b>${esc(r.eventName)}</b><small>${esc(r.eventId)} · ${esc(r.customerName||'')}</small></td>
      <td>${esc(r.date||'—')}<small>${esc(r.type||'')}</small></td>
      <td><span class="${statusClass(r.status)}">${esc(displayStatus(r.status))}</span></td>
      <td class="money">${money(r.confirmedValue)}</td>
      <td class="money">${money(r.received)}</td>
      <td class="money">${money(r.estimatedCost)}</td>
      <td class="money">${money(r.totalCost)}</td>
      <td class="money ${profitClass(r.projectedProfit)}">${money(r.projectedProfit)}</td>
      <td class="${marginClass(r.projectedMargin)}"><b>${pct(r.projectedMargin)}</b></td>
      <td class="money">${money(r.outstanding)}</td>
      <td>${r.overBudget?'<span class="report-attention over">OVER BUDGET</span>':'<span class="report-attention on">OK</span>'}</td>
    </tr>`).join('');
  }

  function renderOverview(){
    const s=overview.summary||{};
    $('#content').innerHTML=`
      <div class="report-toolbar">
        <div>
          <p class="eyebrow">MANAGEMENT REPORT</p>
          <h3>Event Profitability Portfolio</h3>
        </div>
        <div class="report-toolbar-actions">
          <button id="reportsRefreshBtn" class="btn btn-secondary">Refresh</button>
        </div>
      </div>
      <div class="report-note">
        <b>Projected event profit</b> = Confirmed Value − Current Event Cost.
        Current Event Cost includes budget actuals, approved unlinked event expenses, inventory internal-use cost and event labour.
        Cash received is shown separately, so unpaid customer balances do not incorrectly appear as event losses.
      </div>
      <div class="metric-grid">
        ${metric('Confirmed Sales',money(s.confirmedValue))}
        ${metric('Cash Received',money(s.received))}
        ${metric('Current Event Cost',money(s.totalCost))}
        ${metric('Projected Profit',money(s.projectedProfit),`Portfolio margin ${pct(s.projectedMargin)}`)}
        ${metric('Customer Outstanding',money(s.outstanding))}
        ${metric('Estimated Budget Cost',money(s.estimatedCost))}
        ${metric('Inventory Use Cost',money(s.inventoryCost))}
        ${metric('Event Labour Cost',money(s.labourCost))}
      </div>
      <div class="toolbar" style="margin-top:18px">
        <input id="reportSearch" class="search" placeholder="Search event, customer, type, date or status">
      </div>
      <section class="panel table-panel report-table">
        <div class="panel-head"><div><p class="eyebrow">EVENT PROFITABILITY</p><h3>All Events</h3></div></div>
        <table>
          <thead><tr>
            <th>Event</th><th>Date</th><th>Status</th><th>Confirmed</th><th>Received</th>
            <th>Est. Cost</th><th>Current Cost</th><th>Projected Profit</th><th>Margin</th><th>Outstanding</th><th>Budget</th>
          </tr></thead>
          <tbody id="reportOverviewRows">${overviewRows(overview.events||[])}</tbody>
        </table>
      </section>
      <div id="eventProfitAnalysis" class="report-detail-section">
        <section class="panel report-empty-analysis">
          <div class="empty"><h3>Select an event</h3><p>Click any event row to open its detailed Budget vs Actual analysis.</p></div>
        </section>
      </div>`;
    $('#reportsRefreshBtn').onclick=()=>openReports(true);
    $('#reportSearch').oninput=e=>{
      const q=e.target.value.toLowerCase();
      const filtered=(overview.events||[]).filter(x=>Object.values(x).join(' ').toLowerCase().includes(q));
      $('#reportOverviewRows').innerHTML=overviewRows(filtered);
      bindOverviewRows();
    };
    bindOverviewRows();
  }

  function bindOverviewRows(){
    $$('[data-report-event]').forEach(row=>{
      row.onclick=()=>loadEventReport(row.dataset.reportEvent);
    });
  }

  async function loadEventReport(eventId){
    const host=$('#eventProfitAnalysis');
    if(!host)return;
    host.innerHTML='<div class="loading">Loading Budget vs Actual analysis…</div>';
    try{
      currentEventReport=await API.request('getEventProfitReport',{eventId});
      renderEventReport(currentEventReport);
      host.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){
      host.innerHTML=`<div class="empty error-box"><h3>Unable to load event analysis</h3><p>${esc(err.message)}</p></div>`;
    }
  }

  function varianceClass(v){
    const n=Number(v||0);
    if(n>0)return 'report-overrun';
    if(n<0)return 'report-under';
    return '';
  }

  function varianceBadge(v){
    const n=Number(v||0);
    if(n>0)return '<span class="report-attention over">OVER</span>';
    if(n<0)return '<span class="report-attention under">UNDER</span>';
    return '<span class="report-attention on">ON BUDGET</span>';
  }

  function budgetRows(groups){
    if(!groups.length)return '<tr><td colspan="8" class="empty">No detailed budget items for this event.</td></tr>';
    let html='';
    groups.forEach(main=>{
      html+=`<tr class="report-main-row"><td colspan="8">${esc(main.name||'Main Item')}</td></tr>`;
      (main.subs||[]).forEach(sub=>{
        html+=`<tr class="report-sub-row"><td colspan="8">${esc(sub.name||'Sub Item')}</td></tr>`;
        (sub.details||[]).forEach(d=>{
          html+=`<tr class="${varianceClass(d.variance)}">
            <td class="report-detail-name"><b>${esc(d.name||'Detail')}</b><small>${esc(d.description||'')}</small></td>
            <td>${Number(d.estimatedQty||0)} ${esc(d.unit||'')}</td>
            <td class="money">${money(d.estimatedCost)}</td>
            <td class="money">${money(d.actualCost)}</td>
            <td class="money ${profitClass(-Number(d.variance||0))}">${money(d.variance)}</td>
            <td>${d.variancePercent===null?'—':pct(d.variancePercent)}</td>
            <td class="money">${money(d.linkedExpense)}</td>
            <td>${varianceBadge(d.variance)}</td>
          </tr>`;
        });
      });
    });
    return html;
  }

  function renderEventReport(r){
    const host=$('#eventProfitAnalysis');
    const s=r.summary||{};
    host.innerHTML=`
      <section class="panel">
        <div class="report-event-title">
          <div>
            <p class="eyebrow">EVENT ANALYSIS</p>
            <h3>${esc(r.event.name)}</h3>
            <p>${esc(r.event.eventId)} · ${esc(r.event.customerName||'')} · ${esc(r.event.date||'')} · ${esc(displayStatus(r.event.status))}</p>
          </div>
          <button id="closeEventReportBtn" class="btn btn-ghost">Close Analysis</button>
        </div>
        <div class="report-summary-strip">
          <div class="report-mini-card"><span>Confirmed Value</span><strong>${money(s.confirmedValue)}</strong></div>
          <div class="report-mini-card"><span>Cash Received</span><strong>${money(s.received)}</strong></div>
          <div class="report-mini-card"><span>Estimated Budget Cost</span><strong>${money(s.estimatedCost)}</strong></div>
          <div class="report-mini-card"><span>Current Event Cost</span><strong>${money(s.totalCost)}</strong></div>
          <div class="report-mini-card"><span>Projected Profit</span><strong class="${profitClass(s.projectedProfit)}">${money(s.projectedProfit)}</strong></div>
          <div class="report-mini-card"><span>Projected Margin</span><strong class="${marginClass(s.projectedMargin)}">${pct(s.projectedMargin)}</strong></div>
          <div class="report-mini-card"><span>Customer Outstanding</span><strong>${money(s.outstanding)}</strong></div>
          <div class="report-mini-card"><span>Cost Variance vs Estimate</span><strong class="${Number(s.costVariance||0)>0?'negative':'positive'}">${money(s.costVariance)}</strong></div>
        </div>
      </section>

      <section class="panel table-panel report-table report-detail-section">
        <div class="panel-head"><div><p class="eyebrow">BUDGET CONTROL</p><h3>Budget vs Actual</h3></div></div>
        <table>
          <thead><tr><th>Detailed Item</th><th>Planned Qty</th><th>Estimated</th><th>Actual</th><th>Variance</th><th>Variance %</th><th>Linked Expense</th><th>Status</th></tr></thead>
          <tbody>${budgetRows(r.groups||[])}</tbody>
        </table>
      </section>

      <div class="report-extras">
        <div class="report-extra-card"><span>Unlinked Approved Expenses</span><strong>${money(s.unlinkedExpense)}</strong><small>Approved event expenses not linked to a detailed budget item.</small></div>
        <div class="report-extra-card"><span>Inventory Internal Cost</span><strong>${money(s.inventoryCost)}</strong><small>Internal event/use cost from allocated reusable inventory.</small></div>
        <div class="report-extra-card"><span>Event Labour Cost</span><strong>${money(s.labourCost)}</strong><small>Calculated cost recorded in Event Labour.</small></div>
      </div>`;
    $('#closeEventReportBtn').onclick=()=>{
      currentEventReport=null;
      host.innerHTML=`<section class="panel report-empty-analysis"><div class="empty"><h3>Select an event</h3><p>Click any event row to open its detailed Budget vs Actual analysis.</p></div></section>`;
    };
  }

  installReportsRoute();
})();