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

  function migrateMock(saved) {
    const s = saved || {};
    s.users ||= [];
    s.customers ||= [];
    s.events ||= [];
    s.expenses ||= [];
    s.income ||= [];
    s.budgetHeaders ||= [];
    s.budgetLines ||= [];
    s.quotations ||= [];
    s.expenses.forEach(x => { if (!('budgetLineId' in x)) x.budgetLineId = ''; });
    return s;
  }

  function initMock() {
    const saved = localStorage.getItem('dream_events_demo_db_v1');
    if (saved) {
      try { mockState = migrateMock(JSON.parse(saved)); saveMock(); return; } catch {}
    }
    mockState = migrateMock({
      users: [
        { userId:'USR-00001', username:'finance', password:'demo123', fullName:'Finance Head', role:'FINANCE_HEAD', status:'ACTIVE' },
        { userId:'USR-00002', username:'team', password:'demo123', fullName:'Team Member', role:'TEAM_MEMBER', status:'ACTIVE' }
      ],
      customers: [
        { customerId:'DE-CUS-0001', name:'Kasun Perera', mobile:'0771234567', whatsapp:'0771234567', email:'', source:'Referral', status:'ACTIVE', createdAt:new Date().toISOString() },
        { customerId:'DE-CUS-0002', name:'Amanda Silva', mobile:'0718884433', whatsapp:'0718884433', email:'', source:'Instagram', status:'ACTIVE', createdAt:new Date().toISOString() }
      ],
      events: [
        { eventId:'DE-EVT-2026-0001', name:'Kasun & Amanda Proposal', type:'Marriage Proposal', customerId:'DE-CUS-0001', customerName:'Kasun Perera', date:'2026-09-26', startTime:'17:00', endTime:'21:00', venue:'Negombo', guestCount:15, coordinator:'', status:'CONFIRMED', confirmedValue:185000, notes:'', createdAt:new Date().toISOString() },
        { eventId:'DE-EVT-2026-0002', name:'Birthday Celebration', type:'Birthday', customerId:'DE-CUS-0002', customerName:'Amanda Silva', date:'2026-08-28', startTime:'', endTime:'', venue:'Colombo', guestCount:50, coordinator:'', status:'PLANNING', confirmedValue:125000, notes:'', createdAt:new Date().toISOString() }
      ],
      expenses:[
        { expenseId:'DE-EXP-2026-000001', eventId:'DE-EVT-2026-0001', budgetLineId:'', category:'Flowers', subCategory:'', description:'Initial flower purchase', amount:24500, paidFrom:'OWNER_PERSONAL', status:'PENDING', submittedBy:'Team Member', date:'2026-08-09' }
      ],
      income:[
        { incomeId:'DE-INC-2026-000001', eventId:'DE-EVT-2026-0001', type:'EVENT_ADVANCE', amount:50000, method:'BANK', status:'APPROVED', date:'2026-08-09' }
      ]
    });
    saveMock();
  }

  function saveMock(){ localStorage.setItem('dream_events_demo_db_v1', JSON.stringify(mockState)); }
  function nextReadable(prefix, collection, digits=4) {
    return `${prefix}${String((mockState[collection] || []).length + 1).padStart(digits,'0')}`;
  }
  function requireFinance(session){ if(session?.user?.role !== 'FINANCE_HEAD') throw new Error('Finance Head access required.'); }
  function eventById(id){ return mockState.events.find(x => x.eventId === id); }
  function customerById(id){ return mockState.customers.find(x => x.customerId === id); }
  function activeBudgetLines(eventId){ return mockState.budgetLines.filter(x => x.eventId === eventId && x.status !== 'ARCHIVED'); }
  function budgetHeader(eventId){
    let h = mockState.budgetHeaders.find(x => x.eventId === eventId && x.status !== 'ARCHIVED');
    if (!h) {
      h = { budgetId:`DE-BUD-2026-${String(mockState.budgetHeaders.length+1).padStart(4,'0')}`, eventId, version:1, status:'DRAFT', createdAt:new Date().toISOString() };
      mockState.budgetHeaders.push(h); saveMock();
    }
    return h;
  }
  function lineName(line){ return line.level === 'MAIN' ? line.mainItem : line.level === 'SUB' ? line.subItem : line.detailedItem; }
  function budgetSummary(eventId) {
    const lines = activeBudgetLines(eventId);
    const details = lines.filter(x=>x.level==='DETAIL');
    const subs = lines.filter(x=>x.level==='SUB');
    const approved = mockState.expenses.filter(x=>x.eventId===eventId && x.status==='APPROVED');
    const linkedByLine = Object.fromEntries(details.map(d=>[d.budgetLineId, approved.filter(x=>x.budgetLineId===d.budgetLineId).reduce((a,b)=>a+Number(b.amount||0),0)]));
    const estimatedCost = details.reduce((a,d)=>a + Number(d.estimatedQty||0)*Number(d.estimatedUnitCost||0),0);
    let estimatedRevenue = 0;
    subs.forEach(s=>{
      const own = Number(s.sellingPrice||0);
      if (own > 0 && s.quotationVisible) estimatedRevenue += own;
      else estimatedRevenue += details.filter(d=>d.parentLineId===s.budgetLineId && d.quotationVisible).reduce((a,d)=>a+Number(d.sellingPrice||0),0);
    });
    const unlinkedDetailRevenue = details.filter(d=>!subs.some(s=>s.budgetLineId===d.parentLineId)).reduce((a,d)=>a+Number(d.sellingPrice||0),0);
    estimatedRevenue += unlinkedDetailRevenue;
    const actualLineCost = details.reduce((a,d)=>{
      const linked = linkedByLine[d.budgetLineId] || 0;
      const manual = Number(d.actualQty||0)*Number(d.actualUnitCost||0);
      return a + (linked > 0 ? linked : manual);
    },0);
    const unlinkedApproved = approved.filter(x=>!x.budgetLineId).reduce((a,b)=>a+Number(b.amount||0),0);
    const actualCost = actualLineCost + unlinkedApproved;
    const actualRevenue = mockState.income.filter(x=>x.eventId===eventId && x.status==='APPROVED').reduce((a,b)=>a+Number(b.amount||0),0);
    const estimatedProfit = estimatedRevenue - estimatedCost;
    const actualProfit = actualRevenue - actualCost;
    return {
      estimatedCost, estimatedRevenue, estimatedProfit,
      estimatedMargin: estimatedRevenue ? estimatedProfit/estimatedRevenue*100 : 0,
      actualCost, actualRevenue, actualProfit,
      actualMargin: actualRevenue ? actualProfit/actualRevenue*100 : 0,
      linkedByLine,
      approvedUnlinked: unlinkedApproved
    };
  }


  function addDays(dateStr, days){
    const d=new Date(`${dateStr||new Date().toISOString().slice(0,10)}T00:00:00`); d.setDate(d.getDate()+Number(days||0)); return d.toISOString().slice(0,10);
  }
  function quotationBudgetLines(eventId){
    const lines=activeBudgetLines(eventId);
    const mains=lines.filter(x=>x.level==='MAIN').sort((a,b)=>Number(a.displayOrder||0)-Number(b.displayOrder||0));
    const output=[]; let order=1;
    mains.forEach(main=>{
      if(main.quotationVisible===false) return;
      const subs=lines.filter(x=>x.level==='SUB'&&x.parentLineId===main.budgetLineId).sort((a,b)=>Number(a.displayOrder||0)-Number(b.displayOrder||0));
      const visibleSubs=[];
      subs.forEach(sub=>{
        let amount=0;
        if(sub.quotationVisible!==false && Number(sub.sellingPrice||0)>0) amount=Number(sub.sellingPrice||0);
        else {
          amount=lines.filter(x=>x.level==='DETAIL'&&x.parentLineId===sub.budgetLineId&&x.quotationVisible!==false).reduce((a,d)=>a+Number(d.sellingPrice||0),0);
        }
        if(amount>0) visibleSubs.push({level:'SUB',mainItem:main.mainItem,subItem:sub.subItem,description:sub.description||sub.subItem,qty:1,unitPrice:amount,amount,displayOrder:0});
      });
      if(visibleSubs.length){
        output.push({level:'MAIN',mainItem:main.mainItem,subItem:'',description:main.description||'',qty:0,unitPrice:0,amount:0,displayOrder:order++});
        visibleSubs.forEach(x=>{x.displayOrder=order++;output.push(x);});
      }
    });
    return output;
  }
  function quotationSubtotal(lines){ return (lines||[]).filter(x=>x.level==='SUB').reduce((a,b)=>a+Number(b.amount||0),0); }
  function calculateQuoteTotals(subtotal,type,value){
    const sub=Number(subtotal||0), val=Math.max(0,Number(value||0));
    let discount=0;
    if(type==='FIXED') discount=Math.min(sub,val);
    if(type==='PERCENT') discount=Math.min(sub,sub*val/100);
    return {discountAmount:discount,finalTotal:Math.max(0,sub-discount)};
  }
  function latestEventQuotation(eventId){
    return mockState.quotations.filter(q=>q.eventId===eventId).sort((a,b)=>Number(b.version||0)-Number(a.version||0))[0]||null;
  }
  function quotationDraft(eventId, revisionOf=''){
    const event=eventById(eventId); if(!event) throw new Error('Event not found.');
    const lines=quotationBudgetLines(eventId); const subtotal=quotationSubtotal(lines);
    const prior=revisionOf?mockState.quotations.find(q=>q.quotationId===revisionOf):latestEventQuotation(eventId);
    const issue=new Date().toISOString().slice(0,10);
    return {eventId,issueDate:issue,validUntil:addDays(issue,14),subtotal,discountType:'NONE',discountValue:0,discountAmount:0,finalTotal:subtotal,terms:prior?.terms||'A booking advance is required to confirm the event. Remaining payment milestones can be agreed according to the event plan.',notes:prior?.notes||'',lines};
  }
  function publicQuote(q){
    const e=eventById(q.eventId), c=e?customerById(e.customerId):null;
    return {...q,event:e?{...e}:null,customer:c?{...c}:null,lines:(q.lines||[]).map(x=>({...x}))};
  }

  async function mockRequest(action, data={}) {
    if (!mockState) initMock();
    await new Promise(r => setTimeout(r, 90));
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
      return {ok:true,data:{
        activeEvents:mockState.events.filter(x=>!['COMPLETED','CANCELLED','FINANCIALLY_CLOSED'].includes(x.status)).length,
        revenue, expenses:approvedExpense, eventProfit:finance?revenue-approvedExpense:null,
        receivables:finance?Math.max(0,mockState.events.reduce((a,b)=>a+Number(b.confirmedValue||0),0)-revenue):null,
        supplierPayables:0,
        ownerPayable:finance?mockState.expenses.filter(x=>x.status==='APPROVED'&&x.paidFrom==='OWNER_PERSONAL').reduce((a,b)=>a+Number(b.amount||0),0):null,
        teamPayable:finance?mockState.expenses.filter(x=>x.status==='APPROVED'&&x.paidFrom==='TEAM_MEMBER_PERSONAL').reduce((a,b)=>a+Number(b.amount||0),0):null,
        pendingApprovals:mockState.expenses.filter(x=>x.status==='PENDING').length + mockState.income.filter(x=>x.status==='PENDING').length,
        upcomingEvents:mockState.events.slice().filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5)
      }};
    }

    if (action === 'listCustomers') return {ok:true,data:mockState.customers.slice().reverse()};
    if (action === 'createCustomer') {
      requireFinance(session);
      const rec={ customerId:`DE-CUS-${String(mockState.customers.length+1).padStart(4,'0')}`, name:data.name, mobile:data.mobile||'', whatsapp:data.whatsapp||'', email:data.email||'', address:data.address||'', source:data.source||'', notes:data.notes||'', status:'ACTIVE', createdAt:new Date().toISOString() };
      mockState.customers.push(rec); saveMock(); return {ok:true,data:rec};
    }

    if (action === 'listEvents') return {ok:true,data:mockState.events.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>finance?{...e}:{...e,confirmedValue:null})};
    if (action === 'getEvent') {
      const e=eventById(data.eventId); if(!e) throw new Error('Event not found.');
      const c=customerById(e.customerId);
      const expenses=mockState.expenses.filter(x=>x.eventId===e.eventId && x.status==='APPROVED').reduce((a,b)=>a+Number(b.amount||0),0);
      const income=mockState.income.filter(x=>x.eventId===e.eventId && x.status==='APPROVED').reduce((a,b)=>a+Number(b.amount||0),0);
      return {ok:true,data:{...e,customer:c?{customerId:c.customerId,name:c.name,mobile:c.mobile,whatsapp:c.whatsapp,email:c.email}:null,approvedExpenses:expenses,approvedIncome:income,confirmedValue:finance?e.confirmedValue:null}};
    }
    if (action === 'createEvent') {
      requireFinance(session);
      const customer=customerById(data.customerId);
      const rec={ eventId:`DE-EVT-2026-${String(mockState.events.length+1).padStart(4,'0')}`, name:data.name, type:data.type, customerId:data.customerId, customerName:customer?.name||'', date:data.date, startTime:data.startTime||'', endTime:data.endTime||'', venue:data.venue||'', guestCount:Number(data.guestCount||0), coordinator:data.coordinator||'', status:data.status||'INQUIRY', confirmedValue:Number(data.confirmedValue||0), notes:data.notes||'', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
      mockState.events.push(rec); saveMock(); return {ok:true,data:rec};
    }
    if (action === 'updateEvent') {
      requireFinance(session);
      const rec=eventById(data.eventId); if(!rec) throw new Error('Event not found.');
      const customer=customerById(data.customerId);
      Object.assign(rec,{name:data.name,type:data.type,customerId:data.customerId,customerName:customer?.name||'',date:data.date,startTime:data.startTime||'',endTime:data.endTime||'',venue:data.venue||'',guestCount:Number(data.guestCount||0),coordinator:data.coordinator||'',status:data.status||rec.status,confirmedValue:Number(data.confirmedValue||0),notes:data.notes||'',updatedAt:new Date().toISOString()});
      saveMock(); return {ok:true,data:rec};
    }

    if (action === 'getBudget') {
      requireFinance(session);
      const event=eventById(data.eventId); if(!event) throw new Error('Event not found.');
      const header=budgetHeader(data.eventId);
      return {ok:true,data:{header,lines:activeBudgetLines(data.eventId),summary:budgetSummary(data.eventId)}};
    }
    if (action === 'listBudgetTargets') {
      const lines=activeBudgetLines(data.eventId);
      const mainById=Object.fromEntries(lines.filter(x=>x.level==='MAIN').map(x=>[x.budgetLineId,x.mainItem]));
      const subById=Object.fromEntries(lines.filter(x=>x.level==='SUB').map(x=>[x.budgetLineId,x.subItem]));
      return {ok:true,data:lines.filter(x=>x.level==='DETAIL').map(x=>({budgetLineId:x.budgetLineId,label:`${mainById[lines.find(s=>s.budgetLineId===x.parentLineId)?.parentLineId]||''}${mainById[lines.find(s=>s.budgetLineId===x.parentLineId)?.parentLineId]?' → ':''}${subById[x.parentLineId]||''}${subById[x.parentLineId]?' → ':''}${x.detailedItem}`}))};
    }
    if (action === 'createBudgetLine') {
      requireFinance(session); budgetHeader(data.eventId);
      const level=String(data.level||'').toUpperCase();
      if(!['MAIN','SUB','DETAIL'].includes(level)) throw new Error('Invalid budget level.');
      if(level!=='MAIN'){
        const parent=mockState.budgetLines.find(x=>x.budgetLineId===data.parentLineId && x.eventId===data.eventId && x.status!=='ARCHIVED');
        if(!parent) throw new Error('Parent budget item not found.');
        if(level==='SUB'&&parent.level!=='MAIN') throw new Error('Sub items must belong to a main item.');
        if(level==='DETAIL'&&parent.level!=='SUB') throw new Error('Detailed items must belong to a sub item.');
      }
      const rec={
        budgetLineId:`DE-BLN-2026-${String(mockState.budgetLines.length+1).padStart(6,'0')}`,
        budgetId:budgetHeader(data.eventId).budgetId,eventId:data.eventId,level,parentLineId:data.parentLineId||'',
        mainItem:level==='MAIN'?String(data.name||'').trim():'',subItem:level==='SUB'?String(data.name||'').trim():'',detailedItem:level==='DETAIL'?String(data.name||'').trim():'',
        description:data.description||'',supplierId:data.supplierId||'',estimatedQty:Number(data.estimatedQty||0),unit:data.unit||'',estimatedUnitCost:Number(data.estimatedUnitCost||0),sellingPrice:Number(data.sellingPrice||0),actualQty:Number(data.actualQty||0),actualUnitCost:Number(data.actualUnitCost||0),quotationVisible:data.quotationVisible!==false,internalNotes:data.internalNotes||'',displayOrder:Number(data.displayOrder||mockState.budgetLines.length+1),status:'ACTIVE'
      };
      if(!lineName(rec)) throw new Error('Item name is required.');
      mockState.budgetLines.push(rec); saveMock(); return {ok:true,data:rec};
    }
    if (action === 'updateBudgetLine') {
      requireFinance(session);
      const rec=mockState.budgetLines.find(x=>x.budgetLineId===data.budgetLineId && x.status!=='ARCHIVED'); if(!rec) throw new Error('Budget line not found.');
      const name=String(data.name??lineName(rec)).trim(); if(!name) throw new Error('Item name is required.');
      if(rec.level==='MAIN') rec.mainItem=name;
      if(rec.level==='SUB') rec.subItem=name;
      if(rec.level==='DETAIL') rec.detailedItem=name;
      ['description','supplierId','unit','internalNotes'].forEach(k=>{if(k in data)rec[k]=data[k]||''});
      ['estimatedQty','estimatedUnitCost','sellingPrice','actualQty','actualUnitCost','displayOrder'].forEach(k=>{if(k in data)rec[k]=Number(data[k]||0)});
      if('quotationVisible' in data) rec.quotationVisible=Boolean(data.quotationVisible);
      saveMock(); return {ok:true,data:rec};
    }
    if (action === 'moveBudgetLine') {
      requireFinance(session);
      const rec=mockState.budgetLines.find(x=>x.budgetLineId===data.budgetLineId && x.status!=='ARCHIVED'); if(!rec) throw new Error('Budget line not found.');
      const siblings=mockState.budgetLines.filter(x=>x.eventId===rec.eventId && x.level===rec.level && (x.parentLineId||'')===(rec.parentLineId||'') && x.status!=='ARCHIVED').sort((a,b)=>Number(a.displayOrder||0)-Number(b.displayOrder||0)||a.budgetLineId.localeCompare(b.budgetLineId));
      siblings.forEach((x,i)=>x.displayOrder=i+1);
      const i=siblings.findIndex(x=>x.budgetLineId===rec.budgetLineId);
      const j=String(data.direction||'').toUpperCase()==='UP'?i-1:i+1;
      if(i>=0 && j>=0 && j<siblings.length){
        const temp=siblings[i].displayOrder; siblings[i].displayOrder=siblings[j].displayOrder; siblings[j].displayOrder=temp;
      }
      saveMock(); return {ok:true,data:true};
    }
    if (action === 'duplicateBudgetLine') {
      requireFinance(session);
      const source=mockState.budgetLines.find(x=>x.budgetLineId===data.budgetLineId && x.status!=='ARCHIVED'); if(!source) throw new Error('Budget line not found.');
      const active=()=>mockState.budgetLines.filter(x=>x.eventId===source.eventId && x.status!=='ARCHIVED');
      const nextOrder=(level,parent)=>Math.max(0,...active().filter(x=>x.level===level&&(x.parentLineId||'')===(parent||'')).map(x=>Number(x.displayOrder||0)))+1;
      const cloneNode=(node,newParent='',isRoot=false)=>{
        const clone={...node};
        clone.budgetLineId=`DE-BLN-2026-${String(mockState.budgetLines.length+1).padStart(6,'0')}`;
        clone.parentLineId=newParent;
        clone.displayOrder=nextOrder(node.level,newParent);
        clone.actualQty=0; clone.actualUnitCost=0; clone.status='ACTIVE';
        if(isRoot){
          if(clone.level==='MAIN') clone.mainItem=`${clone.mainItem} Copy`;
          if(clone.level==='SUB') clone.subItem=`${clone.subItem} Copy`;
          if(clone.level==='DETAIL') clone.detailedItem=`${clone.detailedItem} Copy`;
        }
        mockState.budgetLines.push(clone);
        const children=active().filter(x=>x.parentLineId===node.budgetLineId && x.budgetLineId!==clone.budgetLineId).sort((a,b)=>Number(a.displayOrder||0)-Number(b.displayOrder||0));
        children.forEach(child=>cloneNode(child,clone.budgetLineId,false));
        return clone;
      };
      const cloned=cloneNode(source,source.parentLineId||'',true);
      saveMock(); return {ok:true,data:cloned};
    }
    if (action === 'deleteBudgetLine') {
      requireFinance(session);
      const rec=mockState.budgetLines.find(x=>x.budgetLineId===data.budgetLineId && x.status!=='ARCHIVED'); if(!rec) throw new Error('Budget line not found.');
      if(mockState.budgetLines.some(x=>x.parentLineId===rec.budgetLineId && x.status!=='ARCHIVED')) throw new Error('Remove child items first.');
      if(mockState.expenses.some(x=>x.budgetLineId===rec.budgetLineId && x.status!=='REJECTED')) throw new Error('This item has linked expenses and cannot be removed.');
      rec.status='ARCHIVED'; saveMock(); return {ok:true,data:true};
    }


    if (action === 'quotationDraftFromBudget') {
      requireFinance(session); return {ok:true,data:quotationDraft(data.eventId,data.revisionOf||'')};
    }
    if (action === 'listQuotations') {
      requireFinance(session);
      let items=mockState.quotations.slice(); if(data.eventId) items=items.filter(q=>q.eventId===data.eventId);
      return {ok:true,data:items.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(publicQuote)};
    }
    if (action === 'getQuotation') {
      requireFinance(session); const q=mockState.quotations.find(x=>x.quotationId===data.quotationId); if(!q) throw new Error('Quotation not found.'); return {ok:true,data:publicQuote(q)};
    }
    if (action === 'createQuotation') {
      requireFinance(session); const event=eventById(data.eventId); if(!event) throw new Error('Event not found.');
      const draft=quotationDraft(data.eventId,data.revisionOf||''); if(!(draft.subtotal>0)) throw new Error('Add customer-visible pricing to the budget before creating a quotation.');
      let base,version=1,prior=null;
      if(data.revisionOf){ prior=mockState.quotations.find(x=>x.quotationId===data.revisionOf); if(!prior) throw new Error('Previous quotation not found.'); base=prior.baseNumber||String(prior.quotationNumber).replace(/-V\d+$/,''); version=Math.max(...mockState.quotations.filter(x=>x.eventId===data.eventId&&((x.baseNumber||String(x.quotationNumber).replace(/-V\d+$/,''))===base)).map(x=>Number(x.version||1)))+1; }
      else { const n=mockState.quotations.filter(x=>Number(x.version||1)===1).length+1; base=`DE-QTN-${new Date().getFullYear()}-${String(n).padStart(4,'0')}`; }
      const totals=calculateQuoteTotals(draft.subtotal,String(data.discountType||'NONE'),data.discountValue);
      const q={quotationId:`${base}-V${version}`,baseNumber:base,quotationNumber:`${base}-V${version}`,eventId:data.eventId,customerId:event.customerId,version,issueDate:data.issueDate||draft.issueDate,validUntil:data.validUntil||draft.validUntil,subtotal:draft.subtotal,discountType:String(data.discountType||'NONE'),discountValue:Number(data.discountValue||0),discountAmount:totals.discountAmount,finalTotal:totals.finalTotal,status:'DRAFT',terms:data.terms||'',notes:data.notes||'',lines:draft.lines,createdBy:session.user.fullName,createdAt:new Date().toISOString()};
      if(prior && !['ACCEPTED','CANCELLED','REJECTED'].includes(prior.status)) prior.status='SUPERSEDED';
      mockState.quotations.push(q); event.quotedValue=q.finalTotal; if(!['CONFIRMED','COMPLETED','FINANCIALLY_CLOSED'].includes(event.status)) event.status='QUOTATION'; saveMock(); return {ok:true,data:publicQuote(q)};
    }
    if (action === 'updateQuotationStatus') {
      requireFinance(session); const q=mockState.quotations.find(x=>x.quotationId===data.quotationId); if(!q) throw new Error('Quotation not found.');
      const status=String(data.status||'').toUpperCase(); if(!['DRAFT','SENT','ACCEPTED','REJECTED','SUPERSEDED','CANCELLED'].includes(status)) throw new Error('Invalid quotation status.');
      if(status==='ACCEPTED'){
        mockState.quotations.filter(x=>x.eventId===q.eventId&&x.quotationId!==q.quotationId&&x.status==='ACCEPTED').forEach(x=>x.status='SUPERSEDED');
        const e=eventById(q.eventId); if(e){e.confirmedValue=q.finalTotal;e.quotedValue=q.finalTotal;e.status='CONFIRMED';}
      }
      q.status=status; q.updatedAt=new Date().toISOString(); saveMock(); return {ok:true,data:publicQuote(q)};
    }

    if (action === 'listExpenses') return {ok:true,data:mockState.expenses.slice().reverse()};
    if (action === 'createExpense') {
      const target=data.budgetLineId?mockState.budgetLines.find(x=>x.budgetLineId===data.budgetLineId):null;
      const parent=target?mockState.budgetLines.find(x=>x.budgetLineId===target.parentLineId):null;
      const main=parent?mockState.budgetLines.find(x=>x.budgetLineId===parent.parentLineId):null;
      const rec={ expenseId:`DE-EXP-2026-${String(mockState.expenses.length+1).padStart(6,'0')}`, eventId:data.eventId||'', budgetLineId:data.budgetLineId||'', category:main?.mainItem||data.category||'Other', subCategory:parent?.subItem||data.subCategory||'', description:data.description||'', amount:Number(data.amount||0), paidFrom:data.paidFrom||'DREAM_EVENTS_CASH', method:data.paymentMethod||'', status: finance ? 'APPROVED' : 'PENDING', submittedBy:session.user.fullName, date:data.date||new Date().toISOString().slice(0,10), attachmentName:data.attachmentName||'' };
      if(!(rec.amount>0)) throw new Error('Amount must be greater than zero.');
      mockState.expenses.push(rec); saveMock(); return {ok:true,data:rec};
    }
    if (action === 'approveExpense') {
      requireFinance(session);
      const rec=mockState.expenses.find(x=>x.expenseId===data.expenseId); if(!rec) throw new Error('Expense not found.'); rec.status='APPROVED'; rec.approvedBy=session.user.fullName; saveMock(); return {ok:true,data:rec};
    }
    if (action === 'rejectExpense') {
      requireFinance(session);
      const rec=mockState.expenses.find(x=>x.expenseId===data.expenseId); if(!rec) throw new Error('Expense not found.'); rec.status='REJECTED'; rec.rejectionReason=data.reason||''; saveMock(); return {ok:true,data:rec};
    }

    if (action === 'listIncome') return {ok:true,data:mockState.income.slice().reverse()};
    if (action === 'createIncome') {
      const rec={ incomeId:`DE-INC-2026-${String(mockState.income.length+1).padStart(6,'0')}`, eventId:data.eventId||'', type:data.type||'EVENT_PAYMENT', amount:Number(data.amount||0), method:data.method||'CASH', reference:data.reference||'', status:finance?'APPROVED':'PENDING', submittedBy:session.user.fullName, date:data.date||new Date().toISOString().slice(0,10) };
      if(!(rec.amount>0)) throw new Error('Amount must be greater than zero.');
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
