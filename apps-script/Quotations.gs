function quotationVisible_(v){ return String(v).toLowerCase()!=='false'; }
function quotationSetting_(key, fallback){ const r=getRows_('00_SETTINGS').find(x=>x.Key===key); return r&&String(r.Value)!==''?r.Value:fallback; }
function quotationAddDays_(dateStr,days){ const d=new Date(String(dateStr||formatDateOnly_(new Date()))+'T00:00:00');d.setDate(d.getDate()+Number(days||0));return Utilities.formatDate(d,'Asia/Colombo','yyyy-MM-dd'); }
function quotationBase_(number){ return String(number||'').replace(/-V\d+$/,''); }
function quotationTotals_(subtotal,type,value){ const sub=Number(subtotal||0),val=Math.max(0,Number(value||0));let discount=0;if(type==='FIXED')discount=Math.min(sub,val);if(type==='PERCENT')discount=Math.min(sub,sub*val/100);return {discountAmount:discount,finalTotal:Math.max(0,sub-discount)}; }
function quotationBudgetLines_(eventId){
  const rows=budgetLinesForEvent_(eventId),out=[];let order=1;
  rows.filter(x=>x.Level==='MAIN').sort((a,b)=>Number(a.Display_Order||0)-Number(b.Display_Order||0)).forEach(main=>{
    if(!quotationVisible_(main.Quotation_Visible))return;
    const visible=[];
    rows.filter(x=>x.Level==='SUB'&&x.Parent_Line_ID===main.Budget_Line_ID).sort((a,b)=>Number(a.Display_Order||0)-Number(b.Display_Order||0)).forEach(sub=>{
      let amount=0;
      if(quotationVisible_(sub.Quotation_Visible)&&Number(sub.Selling_Price||0)>0)amount=Number(sub.Selling_Price||0);
      else amount=rows.filter(x=>x.Level==='DETAIL'&&x.Parent_Line_ID===sub.Budget_Line_ID&&quotationVisible_(x.Quotation_Visible)).reduce((a,d)=>a+Number(d.Selling_Price||0),0);
      if(amount>0)visible.push({Level:'SUB',Main_Item:main.Main_Item,Sub_Item:sub.Sub_Item,Description:sub.Description||sub.Sub_Item,Qty:1,Unit_Price:amount,Amount:amount,Display_Order:0});
    });
    if(visible.length){out.push({Level:'MAIN',Main_Item:main.Main_Item,Sub_Item:'',Description:main.Description||'',Qty:0,Unit_Price:0,Amount:0,Display_Order:order++});visible.forEach(x=>{x.Display_Order=order++;out.push(x);});}
  });
  return out;
}
function quotationSubtotal_(lines){return (lines||[]).filter(x=>x.Level==='SUB').reduce((a,b)=>a+Number(b.Amount||0),0);}
function quotationDraftFromBudget_(user,data){
  requireFinance_(user);requireFields_(data,['eventId']);const e=findOne_('03_EVENTS','Event_ID',data.eventId);if(!e||e.Status==='ARCHIVED')throw new Error('Event not found.');
  const lines=quotationBudgetLines_(data.eventId),subtotal=quotationSubtotal_(lines),issue=formatDateOnly_(new Date()),days=Number(quotationSetting_('QUOTATION_VALIDITY_DAYS',14)||14);
  let prior=null;if(data.revisionOf)prior=findOne_('09_QUOTATIONS','Quotation_ID',data.revisionOf);
  return {eventId:data.eventId,issueDate:issue,validUntil:quotationAddDays_(issue,days),subtotal:subtotal,discountType:'NONE',discountValue:0,discountAmount:0,finalTotal:subtotal,terms:prior?prior.Terms:'A booking advance is required to confirm the event. Remaining payment milestones can be agreed according to the event plan.',notes:prior?prior.Notes:'',lines:lines.map(mapQuotationDraftLine_)};
}
function mapQuotationDraftLine_(r){return {level:r.Level,mainItem:r.Main_Item||'',subItem:r.Sub_Item||'',description:r.Description||'',qty:Number(r.Qty||0),unitPrice:Number(r.Unit_Price||0),amount:Number(r.Amount||0),displayOrder:Number(r.Display_Order||0)};}
function quotationRows_(quotationId){return getRows_('10_QUOTATION_LINES').filter(x=>x.Quotation_ID===quotationId).sort((a,b)=>Number(a.Display_Order||0)-Number(b.Display_Order||0));}
function mapQuotation_(r,user){
  const event=findOne_('03_EVENTS','Event_ID',r.Event_ID),customer=event?findOne_('02_CUSTOMERS','Customer_ID',event.Customer_ID):null;
  const mappedEvent=event?mapEvent_(event,user):null;
  return {quotationId:r.Quotation_ID,quotationNumber:r.Quotation_Number,eventId:r.Event_ID,customerId:r.Customer_ID,version:Number(r.Version||1),issueDate:formatDateOnly_(r.Issue_Date),validUntil:formatDateOnly_(r.Valid_Until),subtotal:Number(r.Subtotal||0),discountType:r.Discount_Type||'NONE',discountValue:Number(r.Discount_Value||0),discountAmount:Number(r.Discount_Amount||0),finalTotal:Number(r.Final_Total||0),status:r.Status||'DRAFT',terms:r.Terms||'',notes:r.Notes||'',pdfUrl:r.PDF_URL||'',createdAt:r.Created_At,event:mappedEvent,customer:customer?{customerId:customer.Customer_ID,name:customer.Customer_Name,mobile:customer.Mobile,whatsapp:customer.WhatsApp,email:customer.Email,address:customer.Address}:null,lines:quotationRows_(r.Quotation_ID).map(mapQuotationDraftLine_)};
}
function listQuotations_(user,data){requireFinance_(user);let rows=getRows_('09_QUOTATIONS');if(data&&data.eventId)rows=rows.filter(x=>x.Event_ID===data.eventId);return rows.sort((a,b)=>String(b.Created_At||'').localeCompare(String(a.Created_At||''))).map(x=>mapQuotation_(x,user));}
function getQuotation_(user,data){requireFinance_(user);requireFields_(data,['quotationId']);const r=findOne_('09_QUOTATIONS','Quotation_ID',data.quotationId);if(!r)throw new Error('Quotation not found.');return mapQuotation_(r,user);}
function createQuotation_(user,data){
  requireFinance_(user);requireFields_(data,['eventId','issueDate','validUntil']);const event=findOne_('03_EVENTS','Event_ID',data.eventId);if(!event||event.Status==='ARCHIVED')throw new Error('Event not found.');
  const draft=quotationDraftFromBudget_(user,{eventId:data.eventId,revisionOf:data.revisionOf||''});if(!(draft.subtotal>0))throw new Error('Add customer-visible pricing to the budget before creating a quotation.');
  let base,version=1,prior=null;
  if(data.revisionOf){prior=findOne_('09_QUOTATIONS','Quotation_ID',data.revisionOf);if(!prior)throw new Error('Previous quotation not found.');base=quotationBase_(prior.Quotation_Number);const versions=getRows_('09_QUOTATIONS').filter(x=>x.Event_ID===data.eventId&&quotationBase_(x.Quotation_Number)===base).map(x=>Number(x.Version||1));version=(versions.length?Math.max.apply(null,versions):1)+1;}
  else base=nextNumber_('QUOTE','DE-QTN-',4);
  const number=base+'-V'+version,id=number,totals=quotationTotals_(draft.subtotal,String(data.discountType||'NONE'),data.discountValue);
  const rec={Quotation_ID:id,Quotation_Number:number,Event_ID:data.eventId,Customer_ID:event.Customer_ID,Version:version,Issue_Date:data.issueDate,Valid_Until:data.validUntil,Subtotal:draft.subtotal,Discount_Type:String(data.discountType||'NONE'),Discount_Value:Number(data.discountValue||0),Discount_Amount:totals.discountAmount,Final_Total:totals.finalTotal,Status:'DRAFT',Terms:data.terms||'',Notes:data.notes||'',PDF_File_ID:'',PDF_URL:'',Created_By:user.User_ID,Created_At:nowIso_()};
  appendObject_('09_QUOTATIONS',rec);draft.lines.forEach((line,i)=>appendObject_('10_QUOTATION_LINES',{Quotation_Line_ID:'QTL-'+Utilities.getUuid(),Quotation_ID:id,Level:line.level,Main_Item:line.mainItem,Sub_Item:line.subItem,Description:line.description,Qty:line.qty,Unit_Price:line.unitPrice,Amount:line.amount,Display_Order:i+1}));
  if(prior&&!['ACCEPTED','CANCELLED','REJECTED'].includes(prior.Status))updateObjectRow_('09_QUOTATIONS',prior._row,{Status:'SUPERSEDED'});
  const patch={Quoted_Value:totals.finalTotal,Updated_By:user.User_ID,Updated_At:nowIso_()};if(!['CONFIRMED','COMPLETED','FINANCIALLY_CLOSED'].includes(event.Status))patch.Status='QUOTATION';updateObjectRow_('03_EVENTS',event._row,patch);
  audit_(user,'CREATE_QUOTATION','QUOTATIONS',id,null,rec,'',{revisionOf:data.revisionOf||''});return mapQuotation_(rec,user);
}
function updateQuotationStatus_(user,data){
  requireFinance_(user);requireFields_(data,['quotationId','status']);const r=findOne_('09_QUOTATIONS','Quotation_ID',data.quotationId);if(!r)throw new Error('Quotation not found.');const status=String(data.status).toUpperCase();if(!['DRAFT','SENT','ACCEPTED','REJECTED','SUPERSEDED','CANCELLED'].includes(status))throw new Error('Invalid quotation status.');
  if(status==='ACCEPTED'){
    getRows_('09_QUOTATIONS').filter(x=>x.Event_ID===r.Event_ID&&x.Quotation_ID!==r.Quotation_ID&&x.Status==='ACCEPTED').forEach(x=>updateObjectRow_('09_QUOTATIONS',x._row,{Status:'SUPERSEDED'}));
    const e=findOne_('03_EVENTS','Event_ID',r.Event_ID);if(e)updateObjectRow_('03_EVENTS',e._row,{Quoted_Value:Number(r.Final_Total||0),Confirmed_Value:Number(r.Final_Total||0),Status:'CONFIRMED',Updated_By:user.User_ID,Updated_At:nowIso_()});
  }
  updateObjectRow_('09_QUOTATIONS',r._row,{Status:status});audit_(user,'UPDATE_QUOTATION_STATUS','QUOTATIONS',r.Quotation_ID,{Status:r.Status},{Status:status},'',{});r.Status=status;return mapQuotation_(r,user);
}
