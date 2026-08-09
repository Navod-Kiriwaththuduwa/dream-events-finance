function ensureBudgetHeader_(user,eventId){
  requireFinance_(user);const event=findOne_('03_EVENTS','Event_ID',eventId);if(!event||event.Status==='ARCHIVED')throw new Error('Event not found.');
  let h=getRows_('05_BUDGET_HEADERS').find(x=>x.Event_ID===eventId&&x.Status!=='ARCHIVED');
  if(h)return h;
  const id=nextNumber_('BUDGET','DE-BUD-',4);const rec={Budget_ID:id,Event_ID:eventId,Version:1,Status:'DRAFT',Estimated_Revenue:0,Estimated_Cost:0,Estimated_Profit:0,Estimated_Margin:0,Actual_Revenue:0,Actual_Cost:0,Actual_Profit:0,Actual_Margin:0,Created_By:user.User_ID,Created_At:nowIso_(),Updated_By:user.User_ID,Updated_At:nowIso_()};
  appendObject_('05_BUDGET_HEADERS',rec);audit_(user,'CREATE_BUDGET','BUDGETS',id,null,rec,'',{});return rec;
}
function budgetLinesForEvent_(eventId){return getRows_('06_BUDGET_LINES').filter(x=>x.Event_ID===eventId&&x.Status!=='ARCHIVED');}
function mapBudgetLine_(r){return {budgetLineId:r.Budget_Line_ID,budgetId:r.Budget_ID,eventId:r.Event_ID,level:r.Level,parentLineId:r.Parent_Line_ID||'',mainItem:r.Main_Item||'',subItem:r.Sub_Item||'',detailedItem:r.Detailed_Item||'',description:r.Description||'',supplierId:r.Supplier_ID||'',estimatedQty:Number(r.Estimated_Qty||0),unit:r.Unit||'',estimatedUnitCost:Number(r.Estimated_Unit_Cost||0),sellingPrice:Number(r.Selling_Price||0),actualQty:Number(r.Actual_Qty||0),actualUnitCost:Number(r.Actual_Unit_Cost||0),quotationVisible:String(r.Quotation_Visible).toLowerCase()!=='false',internalNotes:r.Internal_Notes||'',displayOrder:Number(r.Display_Order||0),status:r.Status||'ACTIVE'};}
function budgetLineName_(r){return r.Level==='MAIN'?r.Main_Item:r.Level==='SUB'?r.Sub_Item:r.Detailed_Item;}
function budgetSummary_(eventId,lines){
  lines=lines||budgetLinesForEvent_(eventId);
  const details=lines.filter(x=>x.Level==='DETAIL'),subs=lines.filter(x=>x.Level==='SUB');
  const approved=getRows_('17_EXPENSES').filter(x=>x.Event_ID===eventId&&x.Approval_Status==='APPROVED');
  const linkedByLine={};details.forEach(d=>linkedByLine[d.Budget_Line_ID]=approved.filter(x=>x.Budget_Line_ID===d.Budget_Line_ID).reduce((a,b)=>a+Number(b.Amount||0),0));
  const estimatedCost=details.reduce((a,d)=>a+Number(d.Estimated_Qty||0)*Number(d.Estimated_Unit_Cost||0),0);
  let estimatedRevenue=0;
  subs.forEach(s=>{const own=Number(s.Selling_Price||0);if(own>0)estimatedRevenue+=own;else estimatedRevenue+=details.filter(d=>d.Parent_Line_ID===s.Budget_Line_ID).reduce((a,d)=>a+Number(d.Selling_Price||0),0);});
  const actualLineCost=details.reduce((a,d)=>{const linked=Number(linkedByLine[d.Budget_Line_ID]||0),manual=Number(d.Actual_Qty||0)*Number(d.Actual_Unit_Cost||0);return a+(linked>0?linked:manual);},0);
  const approvedUnlinked=approved.filter(x=>!x.Budget_Line_ID).reduce((a,b)=>a+Number(b.Amount||0),0);
  const actualCost=actualLineCost+approvedUnlinked;
  const actualRevenue=getRows_('16_INCOME').filter(x=>x.Event_ID===eventId&&x.Approval_Status==='APPROVED').reduce((a,b)=>a+Number(b.Amount||0),0);
  const estimatedProfit=estimatedRevenue-estimatedCost,actualProfit=actualRevenue-actualCost;
  return {estimatedCost:estimatedCost,estimatedRevenue:estimatedRevenue,estimatedProfit:estimatedProfit,estimatedMargin:estimatedRevenue?estimatedProfit/estimatedRevenue*100:0,actualCost:actualCost,actualRevenue:actualRevenue,actualProfit:actualProfit,actualMargin:actualRevenue?actualProfit/actualRevenue*100:0,linkedByLine:linkedByLine,approvedUnlinked:approvedUnlinked};
}
function syncBudgetHeader_(user,header,summary){
  const h=header._row?header:findOne_('05_BUDGET_HEADERS','Budget_ID',header.Budget_ID);if(!h)return;
  updateObjectRow_('05_BUDGET_HEADERS',h._row,{Estimated_Revenue:summary.estimatedRevenue,Estimated_Cost:summary.estimatedCost,Estimated_Profit:summary.estimatedProfit,Estimated_Margin:summary.estimatedMargin,Actual_Revenue:summary.actualRevenue,Actual_Cost:summary.actualCost,Actual_Profit:summary.actualProfit,Actual_Margin:summary.actualMargin,Updated_By:user.User_ID,Updated_At:nowIso_()});
}
function getBudget_(user,data){
  requireFinance_(user);requireFields_(data,['eventId']);const header=ensureBudgetHeader_(user,data.eventId);const rows=budgetLinesForEvent_(data.eventId);const summary=budgetSummary_(data.eventId,rows);syncBudgetHeader_(user,header,summary);
  return {header:{budgetId:header.Budget_ID,eventId:header.Event_ID,version:Number(header.Version||1),status:header.Status},lines:rows.map(mapBudgetLine_),summary:summary};
}
function listBudgetTargets_(user,data){
  requireFields_(data,['eventId']);const rows=budgetLinesForEvent_(data.eventId);const mains={};rows.filter(x=>x.Level==='MAIN').forEach(x=>mains[x.Budget_Line_ID]=x.Main_Item);const subs={};rows.filter(x=>x.Level==='SUB').forEach(x=>subs[x.Budget_Line_ID]=x);
  return rows.filter(x=>x.Level==='DETAIL').map(x=>{const sub=subs[x.Parent_Line_ID],main=sub?mains[sub.Parent_Line_ID]:'';return {budgetLineId:x.Budget_Line_ID,label:[main,sub?sub.Sub_Item:'',x.Detailed_Item].filter(Boolean).join(' → ')};});
}
function createBudgetLine_(user,data){
  requireFinance_(user);requireFields_(data,['eventId','level','name']);const header=ensureBudgetHeader_(user,data.eventId);const level=String(data.level).toUpperCase();if(!['MAIN','SUB','DETAIL'].includes(level))throw new Error('Invalid budget level.');
  let parent=null;if(level!=='MAIN'){requireFields_(data,['parentLineId']);parent=findOne_('06_BUDGET_LINES','Budget_Line_ID',data.parentLineId);if(!parent||parent.Event_ID!==data.eventId||parent.Status==='ARCHIVED')throw new Error('Parent budget item not found.');if(level==='SUB'&&parent.Level!=='MAIN')throw new Error('Sub items must belong to a main item.');if(level==='DETAIL'&&parent.Level!=='SUB')throw new Error('Detailed items must belong to a sub item.');}
  const id=nextNumber_('BUDGET_LINE','DE-BLN-',6);const rec={Budget_Line_ID:id,Budget_ID:header.Budget_ID,Event_ID:data.eventId,Level:level,Parent_Line_ID:data.parentLineId||'',Main_Item:level==='MAIN'?String(data.name).trim():'',Sub_Item:level==='SUB'?String(data.name).trim():'',Detailed_Item:level==='DETAIL'?String(data.name).trim():'',Description:level==='MAIN'?(data.internalNotes||data.description||''):'',Supplier_ID:data.supplierId||'',Estimated_Qty:Number(data.estimatedQty||0),Unit:data.unit||'',Estimated_Unit_Cost:Number(data.estimatedUnitCost||0),Estimated_Total_Cost:Number(data.estimatedQty||0)*Number(data.estimatedUnitCost||0),Selling_Price:Number(data.sellingPrice||0),Actual_Qty:Number(data.actualQty||0),Actual_Unit_Cost:Number(data.actualUnitCost||0),Actual_Total_Cost:Number(data.actualQty||0)*Number(data.actualUnitCost||0),Variance:0,Quotation_Visible:data.quotationVisible!==false,Internal_Notes:data.internalNotes||'',Display_Order:getRows_('06_BUDGET_LINES').length+1,Status:'ACTIVE'};
  appendObject_('06_BUDGET_LINES',rec);audit_(user,'CREATE_BUDGET_LINE','BUDGETS',id,null,rec,'',{});return mapBudgetLine_(rec);
}
function updateBudgetLine_(user,data){
  requireFinance_(user);requireFields_(data,['budgetLineId','name']);const r=findOne_('06_BUDGET_LINES','Budget_Line_ID',data.budgetLineId);if(!r||r.Status==='ARCHIVED')throw new Error('Budget line not found.');
  const patch={};if(r.Level==='MAIN')patch.Main_Item=String(data.name).trim();if(r.Level==='SUB')patch.Sub_Item=String(data.name).trim();if(r.Level==='DETAIL')patch.Detailed_Item=String(data.name).trim();
  if('internalNotes'in data){patch.Internal_Notes=data.internalNotes||'';if(r.Level==='MAIN')patch.Description=data.internalNotes||'';}if('supplierId'in data)patch.Supplier_ID=data.supplierId||'';if('unit'in data)patch.Unit=data.unit||'';
  if('estimatedQty'in data)patch.Estimated_Qty=Number(data.estimatedQty||0);if('estimatedUnitCost'in data)patch.Estimated_Unit_Cost=Number(data.estimatedUnitCost||0);if('sellingPrice'in data)patch.Selling_Price=Number(data.sellingPrice||0);if('actualQty'in data)patch.Actual_Qty=Number(data.actualQty||0);if('actualUnitCost'in data)patch.Actual_Unit_Cost=Number(data.actualUnitCost||0);if('quotationVisible'in data)patch.Quotation_Visible=data.quotationVisible!==false;
  const estQty='Estimated_Qty'in patch?patch.Estimated_Qty:Number(r.Estimated_Qty||0),estUnit='Estimated_Unit_Cost'in patch?patch.Estimated_Unit_Cost:Number(r.Estimated_Unit_Cost||0),actQty='Actual_Qty'in patch?patch.Actual_Qty:Number(r.Actual_Qty||0),actUnit='Actual_Unit_Cost'in patch?patch.Actual_Unit_Cost:Number(r.Actual_Unit_Cost||0);patch.Estimated_Total_Cost=estQty*estUnit;patch.Actual_Total_Cost=actQty*actUnit;patch.Variance=patch.Actual_Total_Cost-patch.Estimated_Total_Cost;
  updateObjectRow_('06_BUDGET_LINES',r._row,patch);const updated=Object.assign({},r,patch);audit_(user,'UPDATE_BUDGET_LINE','BUDGETS',r.Budget_Line_ID,r,updated,'',{});return mapBudgetLine_(updated);
}
function deleteBudgetLine_(user,data){
  requireFinance_(user);requireFields_(data,['budgetLineId']);const r=findOne_('06_BUDGET_LINES','Budget_Line_ID',data.budgetLineId);if(!r||r.Status==='ARCHIVED')throw new Error('Budget line not found.');if(getRows_('06_BUDGET_LINES').some(x=>x.Parent_Line_ID===r.Budget_Line_ID&&x.Status!=='ARCHIVED'))throw new Error('Remove child items first.');if(getRows_('17_EXPENSES').some(x=>x.Budget_Line_ID===r.Budget_Line_ID&&x.Approval_Status!=='REJECTED'))throw new Error('This item has linked expenses and cannot be removed.');updateObjectRow_('06_BUDGET_LINES',r._row,{Status:'ARCHIVED'});audit_(user,'ARCHIVE_BUDGET_LINE','BUDGETS',r.Budget_Line_ID,r,null,'',{});return true;
}
