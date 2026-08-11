function reportNum_(v){return Number(v||0);}
function reportRound_(v){return Math.round((Number(v||0)+Number.EPSILON)*100)/100;}

function reportGroupBy_(rows,key){
  const out={};
  (rows||[]).forEach(r=>{
    const k=String(r[key]||'');
    if(!out[k])out[k]=[];
    out[k].push(r);
  });
  return out;
}

function reportEventCost_(eventId,budgetLines,expenses,inventoryAllocations,labourRows){
  const lines=(budgetLines||[]).filter(x=>String(x.Event_ID||'')===String(eventId)&&x.Status!=='ARCHIVED');
  const details=lines.filter(x=>x.Level==='DETAIL');
  const approved=(expenses||[]).filter(x=>String(x.Event_ID||'')===String(eventId)&&x.Approval_Status==='APPROVED');

  const expenseByLine={};
  approved.filter(x=>x.Budget_Line_ID).forEach(x=>{
    const id=String(x.Budget_Line_ID||'');
    expenseByLine[id]=(expenseByLine[id]||0)+reportNum_(x.Amount);
  });

  let estimatedCost=0;
  let budgetActualCost=0;
  details.forEach(d=>{
    const estimated=reportNum_(d.Estimated_Qty)*reportNum_(d.Estimated_Unit_Cost);
    const linked=reportNum_(expenseByLine[String(d.Budget_Line_ID)]||0);
    const manual=reportNum_(d.Actual_Qty)*reportNum_(d.Actual_Unit_Cost);
    estimatedCost+=estimated;
    budgetActualCost+=(linked>0?linked:manual);
  });

  const unlinkedExpense=approved.filter(x=>!x.Budget_Line_ID).reduce((a,b)=>a+reportNum_(b.Amount),0);
  const cashExpense=approved.reduce((a,b)=>a+reportNum_(b.Amount),0);
  const inventoryCost=(inventoryAllocations||[])
    .filter(x=>String(x.Event_ID||'')===String(eventId)&&String(x.Status||'')!=='CANCELLED')
    .reduce((a,b)=>a+reportNum_(b.Internal_Cost),0);
  const labourCost=(labourRows||[])
    .filter(x=>String(x.Event_ID||'')===String(eventId))
    .reduce((a,b)=>a+reportNum_(b.Calculated_Cost),0);

  return {
    estimatedCost:reportRound_(estimatedCost),
    budgetActualCost:reportRound_(budgetActualCost),
    unlinkedExpense:reportRound_(unlinkedExpense),
    cashExpense:reportRound_(cashExpense),
    inventoryCost:reportRound_(inventoryCost),
    labourCost:reportRound_(labourCost),
    totalCost:reportRound_(budgetActualCost+unlinkedExpense+inventoryCost+labourCost)
  };
}

function reportOutstanding_(event,received,invoices,payments){
  const eventId=String(event.Event_ID||'');
  const eventInvoices=(invoices||[]).filter(x=>String(x.Event_ID||'')===eventId&&String(x.Status||'')!=='CANCELLED');
  if(eventInvoices.length){
    const paymentByInvoice={};
    (payments||[]).filter(x=>x.Status==='APPROVED').forEach(p=>{
      const id=String(p.Invoice_ID||'');
      paymentByInvoice[id]=(paymentByInvoice[id]||0)+reportNum_(p.Amount);
    });
    return reportRound_(eventInvoices.reduce((sum,inv)=>{
      const remaining=Math.max(0,reportNum_(inv.Final_Total)-reportNum_(paymentByInvoice[String(inv.Invoice_ID)]||0));
      return sum+remaining;
    },0));
  }
  return reportRound_(Math.max(0,reportNum_(event.Confirmed_Value)-reportNum_(received)));
}

function getReportsOverview_(user,data){
  requireFinance_(user);

  const events=getRows_('03_EVENTS').filter(x=>!['CANCELLED','ARCHIVED'].includes(String(x.Status||'')));
  const customers=getRows_('02_CUSTOMERS');
  const budgetLines=getRows_('06_BUDGET_LINES');
  const expenses=getRows_('17_EXPENSES');
  const income=getRows_('16_INCOME');
  const invoices=getRows_('11_INVOICES');
  const payments=getRows_('14_PAYMENTS');
  const allocations=getRows_('23_INVENTORY_ALLOCATIONS');
  const labour=getRows_('26_EVENT_LABOUR');

  const customerById={};
  customers.forEach(c=>customerById[String(c.Customer_ID||'')]=c);
  const incomeByEvent=reportGroupBy_(income.filter(x=>x.Approval_Status==='APPROVED'),'Event_ID');

  const rows=events.map(e=>{
    const eventId=String(e.Event_ID||'');
    const received=(incomeByEvent[eventId]||[]).reduce((a,b)=>a+reportNum_(b.Amount),0);
    const costs=reportEventCost_(eventId,budgetLines,expenses,allocations,labour);
    const confirmed=reportNum_(e.Confirmed_Value);
    const projectedProfit=confirmed>0?reportRound_(confirmed-costs.totalCost):null;
    const projectedMargin=confirmed>0?reportRound_(projectedProfit/confirmed*100):null;
    const outstanding=reportOutstanding_(e,received,invoices,payments);
    const c=customerById[String(e.Customer_ID||'')];
    return {
      eventId:eventId,
      eventName:e.Event_Name||eventId,
      type:e.Event_Type||'',
      customerName:c?c.Customer_Name:'',
      date:formatDateOnly_(e.Event_Date),
      status:e.Status||'',
      quotedValue:reportNum_(e.Quoted_Value),
      confirmedValue:confirmed,
      received:reportRound_(received),
      estimatedCost:costs.estimatedCost,
      cashExpense:costs.cashExpense,
      inventoryCost:costs.inventoryCost,
      labourCost:costs.labourCost,
      totalCost:costs.totalCost,
      projectedProfit:projectedProfit,
      projectedMargin:projectedMargin,
      outstanding:outstanding,
      overBudget:costs.estimatedCost>0&&costs.totalCost-costs.estimatedCost>0.01
    };
  }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.eventId).localeCompare(String(a.eventId)));

  const summary=rows.reduce((s,r)=>{
    s.confirmedValue+=r.confirmedValue;
    s.received+=r.received;
    s.estimatedCost+=r.estimatedCost;
    s.totalCost+=r.totalCost;
    s.inventoryCost+=r.inventoryCost;
    s.labourCost+=r.labourCost;
    s.outstanding+=r.outstanding;
    if(r.projectedProfit!==null)s.projectedProfit+=r.projectedProfit;
    return s;
  },{confirmedValue:0,received:0,estimatedCost:0,totalCost:0,inventoryCost:0,labourCost:0,outstanding:0,projectedProfit:0});
  summary.projectedMargin=summary.confirmedValue?reportRound_(summary.projectedProfit/summary.confirmedValue*100):null;
  Object.keys(summary).forEach(k=>{if(typeof summary[k]==='number')summary[k]=reportRound_(summary[k]);});

  return {summary:summary,events:rows};
}

function getEventProfitReport_(user,data){
  requireFinance_(user);
  requireFields_(data,['eventId']);

  const event=findOne_('03_EVENTS','Event_ID',data.eventId);
  if(!event||['CANCELLED','ARCHIVED'].includes(String(event.Status||'')))throw new Error('Event not found.');

  const customer=event.Customer_ID?findOne_('02_CUSTOMERS','Customer_ID',event.Customer_ID):null;
  const allLines=getRows_('06_BUDGET_LINES').filter(x=>String(x.Event_ID||'')===String(event.Event_ID)&&x.Status!=='ARCHIVED');
  const expenses=getRows_('17_EXPENSES').filter(x=>String(x.Event_ID||'')===String(event.Event_ID)&&x.Approval_Status==='APPROVED');
  const income=getRows_('16_INCOME').filter(x=>String(x.Event_ID||'')===String(event.Event_ID)&&x.Approval_Status==='APPROVED');
  const allocations=getRows_('23_INVENTORY_ALLOCATIONS').filter(x=>String(x.Event_ID||'')===String(event.Event_ID)&&String(x.Status||'')!=='CANCELLED');
  const labour=getRows_('26_EVENT_LABOUR').filter(x=>String(x.Event_ID||'')===String(event.Event_ID));
  const invoices=getRows_('11_INVOICES').filter(x=>String(x.Event_ID||'')===String(event.Event_ID));
  const payments=getRows_('14_PAYMENTS');

  const expenseByLine={};
  expenses.filter(x=>x.Budget_Line_ID).forEach(x=>{
    const id=String(x.Budget_Line_ID||'');
    expenseByLine[id]=(expenseByLine[id]||0)+reportNum_(x.Amount);
  });

  const mains=allLines.filter(x=>x.Level==='MAIN').sort((a,b)=>reportNum_(a.Display_Order)-reportNum_(b.Display_Order));
  const groups=mains.map(main=>{
    const subs=allLines.filter(x=>x.Level==='SUB'&&String(x.Parent_Line_ID||'')===String(main.Budget_Line_ID))
      .sort((a,b)=>reportNum_(a.Display_Order)-reportNum_(b.Display_Order))
      .map(sub=>{
        const details=allLines.filter(x=>x.Level==='DETAIL'&&String(x.Parent_Line_ID||'')===String(sub.Budget_Line_ID))
          .sort((a,b)=>reportNum_(a.Display_Order)-reportNum_(b.Display_Order))
          .map(d=>{
            const estimated=reportRound_(reportNum_(d.Estimated_Qty)*reportNum_(d.Estimated_Unit_Cost));
            const linked=reportRound_(expenseByLine[String(d.Budget_Line_ID)]||0);
            const manual=reportRound_(reportNum_(d.Actual_Qty)*reportNum_(d.Actual_Unit_Cost));
            const actual=linked>0?linked:manual;
            const variance=reportRound_(actual-estimated);
            const variancePercent=estimated>0?reportRound_(variance/estimated*100):null;
            return {
              budgetLineId:d.Budget_Line_ID,
              name:d.Detailed_Item||'',
              description:d.Description||'',
              estimatedQty:reportNum_(d.Estimated_Qty),
              unit:d.Unit||'',
              estimatedUnitCost:reportNum_(d.Estimated_Unit_Cost),
              estimatedCost:estimated,
              actualQty:reportNum_(d.Actual_Qty),
              actualUnitCost:reportNum_(d.Actual_Unit_Cost),
              linkedExpense:linked,
              actualCost:actual,
              variance:variance,
              variancePercent:variancePercent
            };
          });
        return {budgetLineId:sub.Budget_Line_ID,name:sub.Sub_Item||'',details:details};
      });
    return {budgetLineId:main.Budget_Line_ID,name:main.Main_Item||'',subs:subs};
  });

  const costs=reportEventCost_(event.Event_ID,allLines,expenses,allocations,labour);
  const received=reportRound_(income.reduce((a,b)=>a+reportNum_(b.Amount),0));
  const confirmed=reportNum_(event.Confirmed_Value);
  const projectedProfit=confirmed>0?reportRound_(confirmed-costs.totalCost):null;
  const projectedMargin=confirmed>0?reportRound_(projectedProfit/confirmed*100):null;
  const outstanding=reportOutstanding_(event,received,invoices,payments);

  return {
    event:{
      eventId:event.Event_ID,
      name:event.Event_Name||event.Event_ID,
      type:event.Event_Type||'',
      customerName:customer?customer.Customer_Name:'',
      date:formatDateOnly_(event.Event_Date),
      status:event.Status||''
    },
    groups:groups,
    summary:{
      confirmedValue:confirmed,
      received:received,
      estimatedCost:costs.estimatedCost,
      budgetActualCost:costs.budgetActualCost,
      unlinkedExpense:costs.unlinkedExpense,
      inventoryCost:costs.inventoryCost,
      labourCost:costs.labourCost,
      totalCost:costs.totalCost,
      projectedProfit:projectedProfit,
      projectedMargin:projectedMargin,
      outstanding:outstanding,
      costVariance:reportRound_(costs.totalCost-costs.estimatedCost)
    }
  };
}
