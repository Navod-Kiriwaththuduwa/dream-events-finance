function mapEvent_(r,user){
  const c=findOne_('02_CUSTOMERS','Customer_ID',r.Customer_ID);
  const expenses=getRows_('17_EXPENSES').filter(x=>x.Event_ID===r.Event_ID&&x.Approval_Status==='APPROVED').reduce((a,b)=>a+Number(b.Amount||0),0);
  const income=getRows_('16_INCOME').filter(x=>x.Event_ID===r.Event_ID&&x.Approval_Status==='APPROVED').reduce((a,b)=>a+Number(b.Amount||0),0);
  return {
    eventId:r.Event_ID,name:r.Event_Name,type:r.Event_Type,customerId:r.Customer_ID,customerName:c?c.Customer_Name:'',
    customer:c?{customerId:c.Customer_ID,name:c.Customer_Name,mobile:c.Mobile,whatsapp:c.WhatsApp,email:c.Email}:null,
    date:formatDateOnly_(r.Event_Date),startTime:r.Start_Time||'',endTime:r.End_Time||'',venue:r.Venue,guestCount:Number(r.Guest_Count||0),
    coordinator:r.Coordinator||'',status:r.Status,confirmedValue:user.Role==='FINANCE_HEAD'?Number(r.Confirmed_Value||0):null,notes:r.Notes||'',
    approvedExpenses:expenses,approvedIncome:income,createdAt:r.Created_At,updatedAt:r.Updated_At
  };
}
function listEvents_(user){ return getRows_('03_EVENTS').filter(r=>r.Status!=='ARCHIVED').map(r=>mapEvent_(r,user)); }
function getEvent_(user,data){ requireFields_(data,['eventId']);const r=findOne_('03_EVENTS','Event_ID',data.eventId);if(!r||r.Status==='ARCHIVED')throw new Error('Event not found.');return mapEvent_(r,user); }
function createEvent_(user,data){
  requireFinance_(user);requireFields_(data,['name','type','customerId','date']);const c=findOne_('02_CUSTOMERS','Customer_ID',data.customerId);if(!c)throw new Error('Customer not found.');
  const id=nextNumber_('EVENT','DE-EVT-',4);const rec={Event_ID:id,Event_Name:String(data.name).trim(),Event_Type:data.type,Customer_ID:data.customerId,Event_Date:data.date,Start_Time:data.startTime||'',End_Time:data.endTime||'',Venue:data.venue||'',Guest_Count:Number(data.guestCount||0),Coordinator:data.coordinator||'',Status:data.status||'INQUIRY',Package_ID:'',Quoted_Value:0,Confirmed_Value:Number(data.confirmedValue||0),Payment_Plan_Type:'',Notes:data.notes||'',Created_By:user.User_ID,Created_At:nowIso_(),Updated_By:user.User_ID,Updated_At:nowIso_()};
  appendObject_('03_EVENTS',rec);ensureEventFolder_(id);audit_(user,'CREATE_EVENT','EVENTS',id,null,rec,'',{});return mapEvent_(rec,user);
}
function updateEvent_(user,data){
  requireFinance_(user);requireFields_(data,['eventId','name','type','customerId','date']);const r=findOne_('03_EVENTS','Event_ID',data.eventId);if(!r||r.Status==='ARCHIVED')throw new Error('Event not found.');
  const c=findOne_('02_CUSTOMERS','Customer_ID',data.customerId);if(!c)throw new Error('Customer not found.');
  const patch={Event_Name:String(data.name).trim(),Event_Type:data.type,Customer_ID:data.customerId,Event_Date:data.date,Start_Time:data.startTime||'',End_Time:data.endTime||'',Venue:data.venue||'',Guest_Count:Number(data.guestCount||0),Coordinator:data.coordinator||'',Status:data.status||r.Status,Confirmed_Value:Number(data.confirmedValue||0),Notes:data.notes||'',Updated_By:user.User_ID,Updated_At:nowIso_()};
  updateObjectRow_('03_EVENTS',r._row,patch);const updated=Object.assign({},r,patch);audit_(user,'UPDATE_EVENT','EVENTS',r.Event_ID,r,updated,'',{});return mapEvent_(updated,user);
}
function ensureEventFolder_(eventId){ const root=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(DE.DRIVE_PROP)); let eventsFolder=null;const it=root.getFoldersByName('Events');eventsFolder=it.hasNext()?it.next():root.createFolder('Events');const found=eventsFolder.getFoldersByName(eventId);if(found.hasNext())return found.next();const f=eventsFolder.createFolder(eventId);['Quotations','Invoices','Receipts','Supplier Bills','Expense Proof'].forEach(n=>f.createFolder(n));return f; }
function formatDateOnly_(v){ if(!v)return '';if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,'Asia/Colombo','yyyy-MM-dd');return String(v).slice(0,10); }
