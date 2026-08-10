function paymentRound_(v){ return Math.round(Number(v||0)); }
function invoiceRows_(invoiceId){ return getRows_('12_INVOICE_LINES').filter(x=>x.Invoice_ID===invoiceId).sort((a,b)=>Number(a.Display_Order||0)-Number(b.Display_Order||0)); }
function paymentRowsForInvoice_(invoiceId){ return getRows_('14_PAYMENTS').filter(x=>x.Invoice_ID===invoiceId&&x.Status==='APPROVED'); }
function activePlanRows_(invoiceId){ return getRows_('13_PAYMENT_PLANS').filter(x=>x.Invoice_ID===invoiceId&&x.Status!=='SUPERSEDED').sort((a,b)=>Number(a.Sequence||0)-Number(b.Sequence||0)); }
function invoiceComputed_(r){
  const paid=paymentRound_(paymentRowsForInvoice_(r.Invoice_ID).reduce((a,b)=>a+Number(b.Amount||0),0));
  const outstanding=paymentRound_(Math.max(0,Number(r.Final_Total||0)-paid));
  let status=r.Status||'ISSUED';
  if(status!=='CANCELLED'){
    if(outstanding<=0)status='PAID';
    else if(formatDateOnly_(r.Due_Date)&&formatDateOnly_(r.Due_Date)<formatDateOnly_(new Date()))status='OVERDUE';
    else if(paid>0)status='PARTIALLY_PAID';
    else status='ISSUED';
  }
  return {paid:paid,outstanding:outstanding,status:status};
}
function mapInvoiceLine_(r){ return {level:r.Level||'SUB',mainItem:r.Main_Item||'',subItem:r.Sub_Item||'',description:r.Description||'',qty:Number(r.Qty||0),unitPrice:Number(r.Unit_Price||0),amount:Number(r.Amount||0),displayOrder:Number(r.Display_Order||0)}; }
function mapInvoice_(r,user){
  const calc=invoiceComputed_(r),event=findOne_('03_EVENTS','Event_ID',r.Event_ID),customer=event?findOne_('02_CUSTOMERS','Customer_ID',event.Customer_ID):null;
  return {invoiceId:r.Invoice_ID,invoiceNumber:r.Invoice_Number,eventId:r.Event_ID,customerId:r.Customer_ID,quotationId:r.Quotation_ID,invoiceDate:formatDateOnly_(r.Invoice_Date),dueDate:formatDateOnly_(r.Due_Date),subtotal:Number(r.Subtotal||0),discount:Number(r.Discount||0),finalTotal:Number(r.Final_Total||0),amountPaid:calc.paid,outstanding:calc.outstanding,status:calc.status,pdfUrl:r.PDF_URL||'',createdAt:r.Created_At,event:event?mapEventBase_(event,user):null,customer:customer?{customerId:customer.Customer_ID,name:customer.Customer_Name,mobile:customer.Mobile,whatsapp:customer.WhatsApp,email:customer.Email,address:customer.Address}:null,lines:invoiceRows_(r.Invoice_ID).map(mapInvoiceLine_)};
}
function mapEventBase_(r,user){
  const c=findOne_('02_CUSTOMERS','Customer_ID',r.Customer_ID);
  return {eventId:r.Event_ID,name:r.Event_Name,type:r.Event_Type,customerId:r.Customer_ID,customerName:c?c.Customer_Name:'',date:formatDateOnly_(r.Event_Date),startTime:r.Start_Time||'',endTime:r.End_Time||'',venue:r.Venue,guestCount:Number(r.Guest_Count||0),coordinator:r.Coordinator||'',status:r.Status,confirmedValue:user&&user.Role==='FINANCE_HEAD'?Number(r.Confirmed_Value||0):null,notes:r.Notes||''};
}
function listInvoices_(user,data){
  requireFinance_(user);
  if(data&&data.workspace&&data.eventId)return paymentWorkspace_(user,data);
  let rows=getRows_('11_INVOICES');
  if(data&&data.eventId)rows=rows.filter(x=>x.Event_ID===data.eventId);
  return rows.sort((a,b)=>String(b.Created_At||'').localeCompare(String(a.Created_At||''))).map(x=>mapInvoice_(x,user));
}
function getInvoice_(user,data){ requireFinance_(user);requireFields_(data,['invoiceId']);const r=findOne_('11_INVOICES','Invoice_ID',data.invoiceId);if(!r)throw new Error('Invoice not found.');return mapInvoice_(r,user); }
function createInvoiceFromQuotation_(user,data){
  requireFinance_(user);requireFields_(data,['quotationId','invoiceDate','dueDate']);const q=findOne_('09_QUOTATIONS','Quotation_ID',data.quotationId);if(!q)throw new Error('Quotation not found.');if(q.Status!=='ACCEPTED')throw new Error('Only an accepted quotation can be invoiced.');
  const existing=getRows_('11_INVOICES').find(x=>x.Quotation_ID===q.Quotation_ID&&x.Status!=='CANCELLED');if(existing)throw new Error('Invoice '+existing.Invoice_Number+' already exists for this quotation.');
  const id=nextNumber_('INVOICE','DE-INV-',4),rec={Invoice_ID:id,Invoice_Number:id,Event_ID:q.Event_ID,Customer_ID:q.Customer_ID,Quotation_ID:q.Quotation_ID,Invoice_Date:data.invoiceDate,Due_Date:data.dueDate,Subtotal:paymentRound_(q.Subtotal),Discount:paymentRound_(q.Discount_Amount),Final_Total:paymentRound_(q.Final_Total),Amount_Paid:0,Outstanding:paymentRound_(q.Final_Total),Status:'ISSUED',PDF_File_ID:'',PDF_URL:'',Created_By:user.User_ID,Created_At:nowIso_()};
  appendObject_('11_INVOICES',rec);quotationRows_(q.Quotation_ID).forEach((line,i)=>appendObject_('12_INVOICE_LINES',{Invoice_Line_ID:'INL-'+Utilities.getUuid(),Invoice_ID:id,Level:line.Level,Main_Item:line.Main_Item,Sub_Item:line.Sub_Item,Description:line.Description,Qty:Number(line.Qty||0),Unit_Price:Number(line.Unit_Price||0),Amount:Number(line.Amount||0),Display_Order:i+1}));
  audit_(user,'CREATE_INVOICE','INVOICES',id,null,rec,'',{quotationId:q.Quotation_ID});return mapInvoice_(rec,user);
}
function mapPaymentPlan_(r){ return {paymentPlanId:r.Payment_Plan_ID,invoiceId:r.Invoice_ID,eventId:r.Event_ID,sequence:Number(r.Sequence||0),milestoneName:r.Milestone_Name,percentage:Number(r.Percentage||0),expectedAmount:Number(r.Expected_Amount||0),dueDate:formatDateOnly_(r.Due_Date),receivedAmount:Number(r.Received_Amount||0),balance:Number(r.Balance||0),status:r.Status,planType:r.Plan_Type||''}; }
function listPaymentPlans_(user,data){ requireFinance_(user);let rows=getRows_('13_PAYMENT_PLANS').filter(x=>x.Status!=='SUPERSEDED');if(data&&data.invoiceId)rows=rows.filter(x=>x.Invoice_ID===data.invoiceId);if(data&&data.eventId)rows=rows.filter(x=>x.Event_ID===data.eventId);return rows.sort((a,b)=>Number(a.Sequence||0)-Number(b.Sequence||0)).map(mapPaymentPlan_); }
function createPaymentPlan_(user,data){
  requireFinance_(user);requireFields_(data,['invoiceId']);const inv=findOne_('11_INVOICES','Invoice_ID',data.invoiceId);if(!inv)throw new Error('Invoice not found.');if(paymentRowsForInvoice_(inv.Invoice_ID).length)throw new Error('Create or change the payment plan before recording payments.');
  const milestones=Array.isArray(data.milestones)?data.milestones:[];if(!milestones.length)throw new Error('Add at least one payment milestone.');const total=paymentRound_(milestones.reduce((a,r)=>a+Number(r.amount||0),0));if(Math.abs(total-Number(inv.Final_Total||0))>0.01)throw new Error('Payment plan must total '+paymentRound_(inv.Final_Total)+'.');
  getRows_('13_PAYMENT_PLANS').filter(x=>x.Invoice_ID===inv.Invoice_ID&&x.Status!=='SUPERSEDED').forEach(x=>updateObjectRow_('13_PAYMENT_PLANS',x._row,{Status:'SUPERSEDED'}));
  const planType=String(data.planType||'CUSTOM'),created=[];milestones.forEach((m,i)=>{const amount=paymentRound_(m.amount),id=nextNumber_('PAYMENT_PLAN','DE-PPL-',6),rec={Payment_Plan_ID:id,Invoice_ID:inv.Invoice_ID,Event_ID:inv.Event_ID,Sequence:i+1,Milestone_Name:String(m.name||('Milestone '+(i+1))),Percentage:Number(inv.Final_Total||0)?amount/Number(inv.Final_Total)*100:0,Expected_Amount:amount,Due_Date:m.dueDate||inv.Due_Date,Received_Amount:0,Balance:amount,Status:'PENDING',Plan_Type:planType};appendObject_('13_PAYMENT_PLANS',rec);created.push(mapPaymentPlan_(rec));});
  const e=findOne_('03_EVENTS','Event_ID',inv.Event_ID);if(e)updateObjectRow_('03_EVENTS',e._row,{Payment_Plan_Type:planType,Updated_By:user.User_ID,Updated_At:nowIso_()});audit_(user,'CREATE_PAYMENT_PLAN','PAYMENT_PLANS',inv.Invoice_ID,null,created,'',{});return created;
}
function mapPayment_(r){ return {paymentId:r.Payment_ID,eventId:r.Event_ID,customerId:r.Customer_ID,invoiceId:r.Invoice_ID,paymentPlanId:r.Payment_Plan_ID||'',amount:Number(r.Amount||0),method:r.Payment_Method,paymentDate:formatDateOnly_(r.Payment_Date),reference:r.Reference||'',status:r.Status,createdAt:r.Created_At}; }
function listPayments_(user,data){ requireFinance_(user);let rows=getRows_('14_PAYMENTS');if(data&&data.invoiceId)rows=rows.filter(x=>x.Invoice_ID===data.invoiceId);if(data&&data.eventId)rows=rows.filter(x=>x.Event_ID===data.eventId);return rows.sort((a,b)=>String(b.Payment_Date||'').localeCompare(String(a.Payment_Date||''))).map(mapPayment_); }
function mapReceipt_(r,user){
  const event=findOne_('03_EVENTS','Event_ID',r.Event_ID),customer=event?findOne_('02_CUSTOMERS','Customer_ID',event.Customer_ID):null,invoice=findOne_('11_INVOICES','Invoice_ID',r.Invoice_ID);
  return {receiptId:r.Receipt_ID,receiptNumber:r.Receipt_Number,paymentId:r.Payment_ID,eventId:r.Event_ID,customerId:r.Customer_ID,invoiceId:r.Invoice_ID,amount:Number(r.Amount||0),receiptDate:formatDateOnly_(r.Receipt_Date),paymentMethod:r.Payment_Method,reference:r.Reference||'',remainingBalance:Number(r.Remaining_Balance||0),pdfUrl:r.PDF_URL||'',createdAt:r.Created_At,event:event?mapEventBase_(event,user):null,customer:customer?{customerId:customer.Customer_ID,name:customer.Customer_Name,mobile:customer.Mobile,whatsapp:customer.WhatsApp,email:customer.Email,address:customer.Address}:null,invoice:invoice?mapInvoice_(invoice,user):null};
}
function listReceipts_(user,data){ requireFinance_(user);let rows=getRows_('15_RECEIPTS');if(data&&data.invoiceId)rows=rows.filter(x=>x.Invoice_ID===data.invoiceId);if(data&&data.eventId)rows=rows.filter(x=>x.Event_ID===data.eventId);return rows.sort((a,b)=>String(b.Created_At||'').localeCompare(String(a.Created_At||''))).map(x=>mapReceipt_(x,user)); }
function getReceipt_(user,data){ requireFinance_(user);requireFields_(data,['receiptId']);const r=findOne_('15_RECEIPTS','Receipt_ID',data.receiptId);if(!r)throw new Error('Receipt not found.');return mapReceipt_(r,user); }
function recordPayment_(user,data){
  requireFinance_(user);requireFields_(data,['invoiceId','amount','method','date']);const inv=findOne_('11_INVOICES','Invoice_ID',data.invoiceId);if(!inv)throw new Error('Invoice not found.');const calc=invoiceComputed_(inv),amount=paymentRound_(data.amount);if(!(amount>0))throw new Error('Payment amount must be greater than zero.');if(amount-calc.outstanding>0.01)throw new Error('Payment cannot exceed the invoice outstanding balance.');
  const activePlan=activePlanRows_(inv.Invoice_ID);if(activePlan.length&&!data.paymentPlanId)throw new Error('Select the payment milestone for this payment.');
  let milestone=null;if(data.paymentPlanId){milestone=findOne_('13_PAYMENT_PLANS','Payment_Plan_ID',data.paymentPlanId);if(!milestone||milestone.Invoice_ID!==inv.Invoice_ID||milestone.Status==='SUPERSEDED')throw new Error('Payment milestone not found.');if(amount-Number(milestone.Balance||0)>0.01)throw new Error('Payment cannot exceed the selected milestone balance.');}
  const paymentId=nextNumber_('PAYMENT','DE-PMT-',6),receiptId=nextNumber_('RECEIPT','DE-RCP-',4),payment={Payment_ID:paymentId,Event_ID:inv.Event_ID,Customer_ID:inv.Customer_ID,Invoice_ID:inv.Invoice_ID,Payment_Plan_ID:data.paymentPlanId||'',Amount:amount,Payment_Method:data.method,Payment_Date:data.date,Reference:data.reference||'',Status:'APPROVED',Created_By:user.User_ID,Created_At:nowIso_()};appendObject_('14_PAYMENTS',payment);
  if(milestone){const received=paymentRound_(Number(milestone.Received_Amount||0)+amount),balance=paymentRound_(Math.max(0,Number(milestone.Expected_Amount||0)-received));updateObjectRow_('13_PAYMENT_PLANS',milestone._row,{Received_Amount:received,Balance:balance,Status:balance<=0?'PAID':'PARTIALLY_PAID'});}
  const totalPaid=paymentRound_(calc.paid+amount),outstanding=paymentRound_(Math.max(0,Number(inv.Final_Total||0)-totalPaid)),status=outstanding<=0?'PAID':(formatDateOnly_(inv.Due_Date)&&formatDateOnly_(inv.Due_Date)<formatDateOnly_(new Date())?'OVERDUE':'PARTIALLY_PAID');updateObjectRow_('11_INVOICES',inv._row,{Amount_Paid:totalPaid,Outstanding:outstanding,Status:status});
  const receipt={Receipt_ID:receiptId,Receipt_Number:receiptId,Payment_ID:paymentId,Event_ID:inv.Event_ID,Customer_ID:inv.Customer_ID,Invoice_ID:inv.Invoice_ID,Amount:amount,Receipt_Date:data.date,Payment_Method:data.method,Reference:data.reference||'',Remaining_Balance:outstanding,PDF_File_ID:'',PDF_URL:'',Created_By:user.User_ID,Created_At:nowIso_()};appendObject_('15_RECEIPTS',receipt);
  const incomeId=nextNumber_('INCOME','DE-INC-',6),incomeType=outstanding<=0?'FINAL_SETTLEMENT':(totalPaid===amount?'EVENT_ADVANCE':'EVENT_PAYMENT');appendObject_('16_INCOME',{Income_ID:incomeId,Event_ID:inv.Event_ID,Customer_ID:inv.Customer_ID,Invoice_ID:inv.Invoice_ID,Income_Type:incomeType,Amount:amount,Payment_Method:data.method,Payment_Date:data.date,Reference:data.reference||'',Approval_Status:'APPROVED',Entered_By:user.User_ID,Approved_By:user.User_ID,Approved_At:nowIso_(),Receipt_ID:receiptId,Notes:'Recorded through invoice payment',Created_At:nowIso_()});
  audit_(user,'RECORD_PAYMENT','PAYMENTS',paymentId,null,payment,'',{invoiceId:inv.Invoice_ID,receiptId:receiptId});const updated=findOne_('11_INVOICES','Invoice_ID',inv.Invoice_ID);return {payment:mapPayment_(payment),receipt:mapReceipt_(receipt,user),invoice:mapInvoice_(updated,user)};
}
function customerOutstandingForEvent_(eventId){
  const invoices=getRows_('11_INVOICES').filter(x=>x.Event_ID===eventId&&x.Status!=='CANCELLED');if(invoices.length)return paymentRound_(invoices.reduce((a,i)=>a+invoiceComputed_(i).outstanding,0));
  const e=findOne_('03_EVENTS','Event_ID',eventId);if(!e)return 0;const income=getRows_('16_INCOME').filter(x=>x.Event_ID===eventId&&x.Approval_Status==='APPROVED').reduce((a,b)=>a+Number(b.Amount||0),0);return paymentRound_(Math.max(0,Number(e.Confirmed_Value||0)-income));
}

// V1.5.3: lightweight payment workspace used by the Payments tab.
// It deliberately avoids invoice lines, event/customer expansion and nested receipt/invoice mapping.
function paymentWorkspace_(user,data){
  requireFinance_(user);
  requireFields_(data,['eventId']);
  const eventId=String(data.eventId||'');

  const invoiceRows=getRows_('11_INVOICES').filter(x=>String(x.Event_ID)===eventId);
  const planRows=getRows_('13_PAYMENT_PLANS').filter(x=>String(x.Event_ID)===eventId&&x.Status!=='SUPERSEDED');
  const paymentRows=getRows_('14_PAYMENTS').filter(x=>String(x.Event_ID)===eventId);
  const receiptRows=getRows_('15_RECEIPTS').filter(x=>String(x.Event_ID)===eventId);

  const paidByInvoice={};
  paymentRows.filter(x=>x.Status==='APPROVED').forEach(x=>{
    const id=String(x.Invoice_ID||'');
    paidByInvoice[id]=(paidByInvoice[id]||0)+Number(x.Amount||0);
  });

  const invoices=invoiceRows.map(r=>{
    const paid=paymentRound_(paidByInvoice[String(r.Invoice_ID)]||0);
    const total=paymentRound_(r.Final_Total);
    const outstanding=paymentRound_(Math.max(0,total-paid));
    let status=r.Status||'ISSUED';
    if(status!=='CANCELLED'){
      if(outstanding<=0)status='PAID';
      else if(formatDateOnly_(r.Due_Date)&&formatDateOnly_(r.Due_Date)<formatDateOnly_(new Date()))status='OVERDUE';
      else if(paid>0)status='PARTIALLY_PAID';
      else status='ISSUED';
    }
    return {
      invoiceId:r.Invoice_ID,
      invoiceNumber:r.Invoice_Number,
      eventId:r.Event_ID,
      customerId:r.Customer_ID,
      quotationId:r.Quotation_ID,
      invoiceDate:formatDateOnly_(r.Invoice_Date),
      dueDate:formatDateOnly_(r.Due_Date),
      subtotal:Number(r.Subtotal||0),
      discount:Number(r.Discount||0),
      finalTotal:Number(r.Final_Total||0),
      amountPaid:paid,
      outstanding:outstanding,
      status:status,
      pdfUrl:r.PDF_URL||'',
      createdAt:r.Created_At
    };
  }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));

  const paymentPlans=planRows.map(mapPaymentPlan_).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0));
  const payments=paymentRows.map(mapPayment_).sort((a,b)=>String(b.paymentDate||'').localeCompare(String(a.paymentDate||'')));
  const receipts=receiptRows.map(r=>({
    receiptId:r.Receipt_ID,
    receiptNumber:r.Receipt_Number,
    paymentId:r.Payment_ID,
    eventId:r.Event_ID,
    customerId:r.Customer_ID,
    invoiceId:r.Invoice_ID,
    amount:Number(r.Amount||0),
    receiptDate:formatDateOnly_(r.Receipt_Date),
    paymentMethod:r.Payment_Method,
    reference:r.Reference||'',
    remainingBalance:Number(r.Remaining_Balance||0),
    pdfUrl:r.PDF_URL||'',
    createdAt:r.Created_At
  })).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));

  return {invoices:invoices,paymentPlans:paymentPlans,payments:payments,receipts:receipts};
}
