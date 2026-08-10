function listExpenses_(user){ return getRows_('17_EXPENSES').map(r=>({expenseId:r.Expense_ID,eventId:r.Event_ID,budgetLineId:r.Budget_Line_ID||'',scope:r.Expense_Scope,category:r.Main_Category,subCategory:r.Sub_Category,description:r.Description,supplierId:r.Supplier_ID,amount:Number(r.Amount||0),method:r.Payment_Method,paidFrom:r.Paid_From,date:formatDateOnly_(r.Expense_Date),attachmentUrl:r.Attachment_URL||'',status:r.Approval_Status,submittedBy:r.Submitted_By,approvedBy:r.Approved_By,rejectionReason:r.Rejection_Reason,locked:String(r.Locked).toLowerCase()==='true'})).reverse(); }
function createExpense_(user,data){
  requireFields_(data,['category','amount','description']);const amount=Number(data.amount);if(!(amount>0))throw new Error('Amount must be greater than zero.');
  const id=nextNumber_('EXPENSE','DE-EXP-',6),finance=user.Role==='FINANCE_HEAD';let mainCategory=data.category,subCategory=data.subCategory||'';
  if(data.budgetLineId){const detail=findOne_('06_BUDGET_LINES','Budget_Line_ID',data.budgetLineId);if(!detail||detail.Level!=='DETAIL'||detail.Status==='ARCHIVED')throw new Error('Budget detail item not found.');if(data.eventId&&detail.Event_ID!==data.eventId)throw new Error('Budget item does not belong to this event.');const sub=findOne_('06_BUDGET_LINES','Budget_Line_ID',detail.Parent_Line_ID);const main=sub?findOne_('06_BUDGET_LINES','Budget_Line_ID',sub.Parent_Line_ID):null;if(main)mainCategory=main.Main_Item;if(sub)subCategory=sub.Sub_Item;}
  let uploaded=null;
  if(data.attachment&&data.attachment.base64) uploaded=uploadExpenseAttachment_(user,id,data.eventId||'',data.attachment);
  const rec={Expense_ID:id,Event_ID:data.eventId||'',Budget_Line_ID:data.budgetLineId||'',Expense_Scope:data.eventId?'EVENT':'BUSINESS',Main_Category:mainCategory,Sub_Category:subCategory,Description:data.description,Supplier_ID:data.supplierId||'',Amount:amount,Payment_Method:data.paymentMethod||'',Paid_From:data.paidFrom||'DREAM_EVENTS_CASH',Expense_Date:data.date||Utilities.formatDate(new Date(),'Asia/Colombo','yyyy-MM-dd'),Attachment_URL:uploaded?uploaded.driveUrl:'',Approval_Status:finance?'APPROVED':'PENDING',Submitted_By:user.User_ID,Submitted_At:nowIso_(),Approved_By:finance?user.User_ID:'',Approved_At:finance?nowIso_():'',Locked:finance,Rejection_Reason:'',Notes:data.notes||'',Created_At:nowIso_()};
  try{
    appendObject_('17_EXPENSES',rec);
    if(uploaded) appendObject_('27_ATTACHMENTS',{Attachment_ID:'ATT-'+Utilities.getUuid(),Module:'EXPENSE',Record_ID:id,Event_ID:rec.Event_ID,File_Name:uploaded.fileName,Mime_Type:uploaded.mimeType,Drive_File_ID:uploaded.driveFileId,Drive_URL:uploaded.driveUrl,Uploaded_By:user.User_ID,Uploaded_At:nowIso_()});
  }catch(err){
    if(uploaded&&uploaded.driveFileId){try{DriveApp.getFileById(uploaded.driveFileId).setTrashed(true)}catch(ignore){}}
    throw err;
  }
  if(finance)createPayableIfNeeded_(user,rec);audit_(user,'CREATE_EXPENSE','EXPENSES',id,null,rec,'',{attachment:uploaded?uploaded.fileName:''});return mapExpense_(rec);
}

function uploadExpenseAttachment_(user,expenseId,eventId,attachment){
  const mime=String(attachment.mimeType||'').toLowerCase();
  if(!(mime==='application/pdf'||mime.indexOf('image/')===0)) throw new Error('Receipt / bill must be an image or PDF file.');
  let bytes;
  try{bytes=Utilities.base64Decode(String(attachment.base64||''));}catch(err){throw new Error('Receipt / bill could not be decoded. Please select the file again.');}
  const maxBytes=5*1024*1024;
  if(!bytes.length) throw new Error('Receipt / bill file is empty.');
  if(bytes.length>maxBytes) throw new Error('Receipt / bill must be 5 MB or smaller.');
  const original=safeExpenseFileName_(attachment.name||'attachment');
  const fileName=expenseId+' - '+original;
  const folder=expenseAttachmentFolder_(eventId);
  const file=folder.createFile(Utilities.newBlob(bytes,mime,fileName));
  return {driveFileId:file.getId(),driveUrl:file.getUrl(),fileName:fileName,mimeType:mime};
}
function safeExpenseFileName_(name){ return String(name||'attachment').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'attachment'; }
function expenseAttachmentFolder_(eventId){
  if(eventId){
    const eventFolder=ensureEventFolder_(eventId), found=eventFolder.getFoldersByName('Expense Proof');
    return found.hasNext()?found.next():eventFolder.createFolder('Expense Proof');
  }
  const root=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(DE.DRIVE_PROP));
  const found=root.getFoldersByName('Business Expenses'), business=found.hasNext()?found.next():root.createFolder('Business Expenses');
  const year=Utilities.formatDate(new Date(),'Asia/Colombo','yyyy'), yearFound=business.getFoldersByName(year);
  return yearFound.hasNext()?yearFound.next():business.createFolder(year);
}
function approveExpense_(user,data){ requireFinance_(user);requireFields_(data,['expenseId']);const r=findOne_('17_EXPENSES','Expense_ID',data.expenseId);if(!r)throw new Error('Expense not found.');if(r.Approval_Status!=='PENDING'&&r.Approval_Status!=='REOPENED')throw new Error('Only pending or reopened expenses can be approved.');updateObjectRow_('17_EXPENSES',r._row,{Approval_Status:'APPROVED',Approved_By:user.User_ID,Approved_At:nowIso_(),Locked:true,Rejection_Reason:''});const updated=Object.assign({},r,{Approval_Status:'APPROVED',Approved_By:user.User_ID,Approved_At:nowIso_(),Locked:true});createPayableIfNeeded_(user,updated);audit_(user,'APPROVE_EXPENSE','EXPENSES',r.Expense_ID,r,updated,'',{});return mapExpense_(updated); }
function rejectExpense_(user,data){ requireFinance_(user);requireFields_(data,['expenseId','reason']);const r=findOne_('17_EXPENSES','Expense_ID',data.expenseId);if(!r)throw new Error('Expense not found.');if(r.Approval_Status!=='PENDING')throw new Error('Only pending expenses can be rejected.');updateObjectRow_('17_EXPENSES',r._row,{Approval_Status:'REJECTED',Rejection_Reason:data.reason,Approved_By:user.User_ID,Approved_At:nowIso_(),Locked:true});audit_(user,'REJECT_EXPENSE','EXPENSES',r.Expense_ID,r,null,data.reason,{});return true; }
function createPayableIfNeeded_(user,e){ let type='',partyId='',partyName='';if(e.Paid_From==='OWNER_PERSONAL'){type='OWNER';partyId=e.Submitted_By;const u=findOne_('01_USERS','User_ID',e.Submitted_By);partyName=u?u.Full_Name:'Owner';}else if(e.Paid_From==='TEAM_MEMBER_PERSONAL'){type='TEAM_MEMBER';partyId=e.Submitted_By;const u=findOne_('01_USERS','User_ID',e.Submitted_By);partyName=u?u.Full_Name:'Team Member';}else if(e.Paid_From==='CREDIT_PAY_LATER'){type='SUPPLIER';partyId=e.Supplier_ID;const s=findOne_('19_SUPPLIERS','Supplier_ID',e.Supplier_ID);partyName=s?s.Supplier_Name:'Supplier';}if(!type)return;const existing=getRows_('20_PAYABLES').find(p=>p.Related_Expense_ID===e.Expense_ID&&p.Status!=='CANCELLED');if(existing)return;const id=nextNumber_('PAYABLE','DE-PAY-',6);appendObject_('20_PAYABLES',{Payable_ID:id,Payable_Type:type,Party_ID:partyId,Party_Name:partyName,Event_ID:e.Event_ID,Related_Expense_ID:e.Expense_ID,Original_Amount:Number(e.Amount),Paid_Amount:0,Outstanding:Number(e.Amount),Due_Date:'',Status:'OUTSTANDING',Created_At:nowIso_(),Created_By:user.User_ID,Updated_At:nowIso_()}); }
function mapExpense_(r){return {expenseId:r.Expense_ID,eventId:r.Event_ID,budgetLineId:r.Budget_Line_ID||'',category:r.Main_Category,subCategory:r.Sub_Category||'',description:r.Description,amount:Number(r.Amount||0),paidFrom:r.Paid_From,status:r.Approval_Status,submittedBy:r.Submitted_By,date:formatDateOnly_(r.Expense_Date),attachmentUrl:r.Attachment_URL||''};}

function listIncome_(user){return getRows_('16_INCOME').map(r=>({incomeId:r.Income_ID,eventId:r.Event_ID,type:r.Income_Type,amount:Number(r.Amount||0),method:r.Payment_Method,date:formatDateOnly_(r.Payment_Date),reference:r.Reference,status:r.Approval_Status,submittedBy:r.Entered_By})).reverse();}
function createIncome_(user,data){requireFields_(data,['type','amount']);const amount=Number(data.amount);if(!(amount>0))throw new Error('Amount must be greater than zero.');const id=nextNumber_('INCOME','DE-INC-',6),finance=user.Role==='FINANCE_HEAD';const event=data.eventId?findOne_('03_EVENTS','Event_ID',data.eventId):null;const rec={Income_ID:id,Event_ID:data.eventId||'',Customer_ID:event?event.Customer_ID:'',Invoice_ID:data.invoiceId||'',Income_Type:data.type,Amount:amount,Payment_Method:data.method||'CASH',Payment_Date:data.date||Utilities.formatDate(new Date(),'Asia/Colombo','yyyy-MM-dd'),Reference:data.reference||'',Approval_Status:finance?'APPROVED':'PENDING',Entered_By:user.User_ID,Approved_By:finance?user.User_ID:'',Approved_At:finance?nowIso_():'',Receipt_ID:'',Notes:data.notes||'',Created_At:nowIso_()};appendObject_('16_INCOME',rec);audit_(user,'CREATE_INCOME','INCOME',id,null,rec,'',{});return {incomeId:id,eventId:rec.Event_ID,type:rec.Income_Type,amount,method:rec.Payment_Method,date:rec.Payment_Date,reference:rec.Reference,status:rec.Approval_Status};}
