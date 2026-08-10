function opsMapSupplier_(r){
  return {
    supplierId:r.Supplier_ID,
    name:r.Supplier_Name,
    category:r.Category||'',
    contactPerson:r.Contact_Person||'',
    phone:r.Phone||'',
    whatsapp:r.WhatsApp||'',
    email:r.Email||'',
    address:r.Address||'',
    bankName:r.Bank_Name||'',
    accountName:r.Account_Name||'',
    accountNumber:r.Account_Number||'',
    notes:r.Notes||'',
    status:r.Status||'ACTIVE',
    createdAt:r.Created_At||''
  };
}

function listSuppliers_(user){
  requireFinance_(user);
  return getRows_('19_SUPPLIERS')
    .sort((a,b)=>String(a.Supplier_Name||'').localeCompare(String(b.Supplier_Name||'')))
    .map(opsMapSupplier_);
}

function createSupplier_(user,data){
  requireFinance_(user);
  requireFields_(data,['name']);
  const id=nextNumber_('SUPPLIER','DE-SUP-',4);
  const rec={
    Supplier_ID:id,
    Supplier_Name:String(data.name||'').trim(),
    Category:data.category||'',
    Contact_Person:data.contactPerson||'',
    Phone:data.phone||'',
    WhatsApp:data.whatsapp||'',
    Email:data.email||'',
    Address:data.address||'',
    Bank_Name:data.bankName||'',
    Account_Name:data.accountName||'',
    Account_Number:data.accountNumber||'',
    Notes:data.notes||'',
    Status:String(data.status||'ACTIVE').toUpperCase()==='INACTIVE'?'INACTIVE':'ACTIVE',
    Created_At:nowIso_(),
    Created_By:user.User_ID
  };
  appendObject_('19_SUPPLIERS',rec);
  audit_(user,'CREATE_SUPPLIER','SUPPLIERS',id,null,rec,'',{});
  return opsMapSupplier_(rec);
}

function updateSupplier_(user,data){
  requireFinance_(user);
  requireFields_(data,['supplierId','name']);
  const r=findOne_('19_SUPPLIERS','Supplier_ID',data.supplierId);
  if(!r)throw new Error('Supplier not found.');
  const patch={
    Supplier_Name:String(data.name||'').trim(),
    Category:data.category||'',
    Contact_Person:data.contactPerson||'',
    Phone:data.phone||'',
    WhatsApp:data.whatsapp||'',
    Email:data.email||'',
    Address:data.address||'',
    Bank_Name:data.bankName||'',
    Account_Name:data.accountName||'',
    Account_Number:data.accountNumber||'',
    Notes:data.notes||'',
    Status:String(data.status||'ACTIVE').toUpperCase()==='INACTIVE'?'INACTIVE':'ACTIVE'
  };
  updateObjectRow_('19_SUPPLIERS',r._row,patch);
  const updated=Object.assign({},r,patch);
  audit_(user,'UPDATE_SUPPLIER','SUPPLIERS',r.Supplier_ID,r,updated,'',{});
  return opsMapSupplier_(updated);
}

function opsMapPayable_(r,eventNames){
  return {
    payableId:r.Payable_ID,
    type:r.Payable_Type||'',
    partyId:r.Party_ID||'',
    partyName:r.Party_Name||'',
    eventId:r.Event_ID||'',
    eventName:eventNames[String(r.Event_ID||'')]||'',
    relatedExpenseId:r.Related_Expense_ID||'',
    originalAmount:Number(r.Original_Amount||0),
    paidAmount:Number(r.Paid_Amount||0),
    outstanding:Number(r.Outstanding||0),
    dueDate:formatDateOnly_(r.Due_Date),
    status:r.Status||'OUTSTANDING',
    createdAt:r.Created_At||'',
    updatedAt:r.Updated_At||''
  };
}

function getPayablesBundle_(user){
  requireFinance_(user);
  const events=getRows_('03_EVENTS');
  const eventNames={};
  events.forEach(e=>eventNames[String(e.Event_ID||'')]=e.Event_Name||e.Event_ID);

  const payables=getRows_('20_PAYABLES')
    .sort((a,b)=>String(b.Created_At||'').localeCompare(String(a.Created_At||'')))
    .map(r=>opsMapPayable_(r,eventNames));

  const payablesById={};
  payables.forEach(p=>payablesById[p.payableId]=p);

  const reimbursements=getRows_('21_REIMBURSEMENTS')
    .sort((a,b)=>String(b.Created_At||'').localeCompare(String(a.Created_At||'')))
    .map(r=>{
      const p=payablesById[String(r.Payable_ID||'')];
      return {
        reimbursementId:r.Reimbursement_ID,
        payableId:r.Payable_ID,
        partyId:r.Party_ID||'',
        partyName:p?p.partyName:'',
        amount:Number(r.Amount||0),
        method:r.Payment_Method||'',
        date:formatDateOnly_(r.Payment_Date),
        reference:r.Reference||'',
        approvedBy:r.Approved_By||'',
        createdAt:r.Created_At||''
      };
    });

  const open=payables.filter(p=>!['PAID','CANCELLED'].includes(p.status));
  const sumType=type=>open.filter(p=>p.type===type).reduce((a,p)=>a+Number(p.outstanding||0),0);
  return {
    payables:payables,
    reimbursements:reimbursements,
    summary:{
      totalOutstanding:open.reduce((a,p)=>a+Number(p.outstanding||0),0),
      supplierOutstanding:sumType('SUPPLIER'),
      ownerOutstanding:sumType('OWNER'),
      teamOutstanding:sumType('TEAM_MEMBER')
    }
  };
}

function recordPayablePayment_(user,data){
  requireFinance_(user);
  requireFields_(data,['payableId','amount','method','date']);
  const p=findOne_('20_PAYABLES','Payable_ID',data.payableId);
  if(!p)throw new Error('Payable not found.');
  if(['PAID','CANCELLED'].includes(String(p.Status||'')))throw new Error('This payable is already closed.');

  const amount=Number(data.amount||0);
  const outstanding=Number(p.Outstanding||0);
  if(!(amount>0))throw new Error('Settlement amount must be greater than zero.');
  if(amount-outstanding>0.01)throw new Error('Settlement cannot exceed the outstanding amount.');

  const paid=Number(p.Paid_Amount||0)+amount;
  const remaining=Math.max(0,outstanding-amount);
  const status=remaining<=0?'PAID':'PARTIALLY_PAID';
  const patch={Paid_Amount:paid,Outstanding:remaining,Status:status,Updated_At:nowIso_()};
  updateObjectRow_('20_PAYABLES',p._row,patch);

  const id='DE-RMB-'+Utilities.formatDate(new Date(),'Asia/Colombo','yyyyMMdd')+'-'+Utilities.getUuid().slice(0,8).toUpperCase();
  const rec={
    Reimbursement_ID:id,
    Payable_ID:p.Payable_ID,
    Party_ID:p.Party_ID||'',
    Amount:amount,
    Payment_Method:data.method||'BANK',
    Payment_Date:data.date,
    Reference:data.reference||'',
    Approved_By:user.User_ID,
    Created_At:nowIso_()
  };
  appendObject_('21_REIMBURSEMENTS',rec);
  audit_(user,'SETTLE_PAYABLE','PAYABLES',p.Payable_ID,p,Object.assign({},p,patch),'',{reimbursementId:id,amount:amount});
  return {payableId:p.Payable_ID,reimbursementId:id,outstanding:remaining,status:status};
}

function updatePayableDueDate_(user,data){
  requireFinance_(user);
  requireFields_(data,['payableId']);
  const p=findOne_('20_PAYABLES','Payable_ID',data.payableId);
  if(!p)throw new Error('Payable not found.');
  const patch={Due_Date:data.dueDate||'',Updated_At:nowIso_()};
  updateObjectRow_('20_PAYABLES',p._row,patch);
  audit_(user,'UPDATE_PAYABLE_DUE_DATE','PAYABLES',p.Payable_ID,{Due_Date:p.Due_Date},{Due_Date:patch.Due_Date},'',{});
  return true;
}

function opsMapInventory_(r){
  return {
    inventoryId:r.Inventory_ID,
    inventoryCode:r.Inventory_Code||'',
    itemName:r.Item_Name||'',
    mainCategory:r.Main_Category||'',
    subCategory:r.Sub_Category||'',
    qtyOwned:Number(r.Qty_Owned||0),
    qtyAvailable:Number(r.Qty_Available||0),
    purchaseDate:formatDateOnly_(r.Purchase_Date),
    purchaseCost:Number(r.Purchase_Cost||0),
    internalCostPerUse:Number(r.Internal_Cost_Per_Use||0),
    defaultCustomerCharge:Number(r.Default_Customer_Charge||0),
    storageLocation:r.Storage_Location||'',
    condition:r.Condition||'GOOD',
    status:r.Status||'ACTIVE',
    photoUrl:r.Photo_URL||''
  };
}

function getInventoryBundle_(user){
  requireFinance_(user);
  const items=getRows_('22_INVENTORY').map(opsMapInventory_);
  const itemById={};items.forEach(i=>itemById[i.inventoryId]=i);
  const events=getRows_('03_EVENTS');
  const eventNames={};events.forEach(e=>eventNames[String(e.Event_ID||'')]=e.Event_Name||e.Event_ID);

  const allocations=getRows_('23_INVENTORY_ALLOCATIONS')
    .sort((a,b)=>String(b.Created_At||'').localeCompare(String(a.Created_At||'')))
    .map(r=>{
      const item=itemById[String(r.Inventory_ID||'')];
      return {
        allocationId:r.Allocation_ID,
        inventoryId:r.Inventory_ID,
        itemName:item?item.itemName:'',
        eventId:r.Event_ID,
        eventName:eventNames[String(r.Event_ID||'')]||'',
        qty:Number(r.Qty||0),
        fromDate:formatDateOnly_(r.From_Date),
        toDate:formatDateOnly_(r.To_Date),
        internalCost:Number(r.Internal_Cost||0),
        customerCharge:Number(r.Customer_Charge||0),
        status:r.Status||'ALLOCATED',
        allocatedBy:r.Allocated_By||'',
        createdAt:r.Created_At||''
      };
    });

  const activeAllocated=allocations.filter(a=>a.status==='ALLOCATED').reduce((a,x)=>a+Number(x.qty||0),0);
  return {
    items:items.sort((a,b)=>String(a.itemName||'').localeCompare(String(b.itemName||''))),
    allocations:allocations,
    summary:{
      itemCount:items.length,
      unitsOwned:items.reduce((a,i)=>a+Number(i.qtyOwned||0),0),
      unitsAvailable:items.reduce((a,i)=>a+Number(i.qtyAvailable||0),0),
      unitsAllocated:activeAllocated
    }
  };
}

function createInventoryItem_(user,data){
  requireFinance_(user);
  requireFields_(data,['itemName','qtyOwned']);
  const qty=Number(data.qtyOwned||0);
  if(qty<0)throw new Error('Quantity owned cannot be negative.');
  const id=nextNumber_('INVENTORY','DE-ITM-',4);
  const rec={
    Inventory_ID:id,
    Inventory_Code:data.inventoryCode||id,
    Item_Name:String(data.itemName||'').trim(),
    Main_Category:data.mainCategory||'',
    Sub_Category:data.subCategory||'',
    Qty_Owned:qty,
    Qty_Available:qty,
    Purchase_Date:data.purchaseDate||'',
    Purchase_Cost:Number(data.purchaseCost||0),
    Internal_Cost_Per_Use:Number(data.internalCostPerUse||0),
    Default_Customer_Charge:Number(data.defaultCustomerCharge||0),
    Storage_Location:data.storageLocation||'',
    Condition:data.condition||'GOOD',
    Status:String(data.status||'ACTIVE').toUpperCase()==='INACTIVE'?'INACTIVE':'ACTIVE',
    Photo_URL:data.photoUrl||'',
    Created_At:nowIso_(),
    Created_By:user.User_ID,
    Updated_At:nowIso_()
  };
  appendObject_('22_INVENTORY',rec);
  appendObject_('24_INVENTORY_TRANSACTIONS',{
    Inventory_Txn_ID:'ITX-'+Utilities.getUuid(),
    Inventory_ID:id,
    Txn_Type:'OPENING_BALANCE',
    Qty:qty,
    Event_ID:'',
    Reference:'Initial inventory quantity',
    Txn_Date:formatDateOnly_(new Date()),
    Notes:'',
    Created_By:user.User_ID,
    Created_At:nowIso_()
  });
  audit_(user,'CREATE_INVENTORY','INVENTORY',id,null,rec,'',{});
  return opsMapInventory_(rec);
}

function updateInventoryItem_(user,data){
  requireFinance_(user);
  requireFields_(data,['inventoryId','itemName','qtyOwned']);
  const r=findOne_('22_INVENTORY','Inventory_ID',data.inventoryId);
  if(!r)throw new Error('Inventory item not found.');

  const owned=Number(data.qtyOwned||0);
  if(owned<0)throw new Error('Quantity owned cannot be negative.');
  const allocated=getRows_('23_INVENTORY_ALLOCATIONS')
    .filter(a=>a.Inventory_ID===r.Inventory_ID&&a.Status==='ALLOCATED')
    .reduce((sum,a)=>sum+Number(a.Qty||0),0);
  if(owned<allocated)throw new Error('Quantity owned cannot be less than the quantity currently allocated.');

  const patch={
    Inventory_Code:data.inventoryCode||r.Inventory_Code||r.Inventory_ID,
    Item_Name:String(data.itemName||'').trim(),
    Main_Category:data.mainCategory||'',
    Sub_Category:data.subCategory||'',
    Qty_Owned:owned,
    Qty_Available:owned-allocated,
    Purchase_Date:data.purchaseDate||'',
    Purchase_Cost:Number(data.purchaseCost||0),
    Internal_Cost_Per_Use:Number(data.internalCostPerUse||0),
    Default_Customer_Charge:Number(data.defaultCustomerCharge||0),
    Storage_Location:data.storageLocation||'',
    Condition:data.condition||'GOOD',
    Status:String(data.status||'ACTIVE').toUpperCase()==='INACTIVE'?'INACTIVE':'ACTIVE',
    Updated_At:nowIso_()
  };
  updateObjectRow_('22_INVENTORY',r._row,patch);
  const updated=Object.assign({},r,patch);
  audit_(user,'UPDATE_INVENTORY','INVENTORY',r.Inventory_ID,r,updated,'',{});
  return opsMapInventory_(updated);
}

function allocateInventory_(user,data){
  requireFinance_(user);
  requireFields_(data,['inventoryId','eventId','qty']);
  const item=findOne_('22_INVENTORY','Inventory_ID',data.inventoryId);
  if(!item)throw new Error('Inventory item not found.');
  if(String(item.Status||'ACTIVE')!=='ACTIVE')throw new Error('This inventory item is inactive.');
  const event=findOne_('03_EVENTS','Event_ID',data.eventId);
  if(!event)throw new Error('Event not found.');

  const qty=Number(data.qty||0);
  if(!(qty>0))throw new Error('Allocation quantity must be greater than zero.');
  const available=Number(item.Qty_Available||0);
  if(qty>available)throw new Error('Only '+available+' unit(s) are available.');

  const fromDate=data.fromDate||formatDateOnly_(event.Event_Date)||formatDateOnly_(new Date());
  const toDate=data.toDate||fromDate;
  if(toDate&&fromDate&&toDate<fromDate)throw new Error('To date cannot be before From date.');

  const defaultInternal=qty*Number(item.Internal_Cost_Per_Use||0);
  const defaultCharge=qty*Number(item.Default_Customer_Charge||0);
  const internalCost=data.internalCost===''||data.internalCost===undefined?defaultInternal:Number(data.internalCost||0);
  const customerCharge=data.customerCharge===''||data.customerCharge===undefined?defaultCharge:Number(data.customerCharge||0);

  const id='DE-IAL-'+Utilities.getUuid().slice(0,8).toUpperCase();
  const rec={
    Allocation_ID:id,
    Inventory_ID:item.Inventory_ID,
    Event_ID:event.Event_ID,
    Qty:qty,
    From_Date:fromDate,
    To_Date:toDate,
    Internal_Cost:internalCost,
    Customer_Charge:customerCharge,
    Status:'ALLOCATED',
    Allocated_By:user.User_ID,
    Created_At:nowIso_()
  };
  appendObject_('23_INVENTORY_ALLOCATIONS',rec);
  updateObjectRow_('22_INVENTORY',item._row,{Qty_Available:available-qty,Updated_At:nowIso_()});
  appendObject_('24_INVENTORY_TRANSACTIONS',{
    Inventory_Txn_ID:'ITX-'+Utilities.getUuid(),
    Inventory_ID:item.Inventory_ID,
    Txn_Type:'ALLOCATE',
    Qty:-qty,
    Event_ID:event.Event_ID,
    Reference:id,
    Txn_Date:formatDateOnly_(new Date()),
    Notes:'',
    Created_By:user.User_ID,
    Created_At:nowIso_()
  });
  audit_(user,'ALLOCATE_INVENTORY','INVENTORY_ALLOCATIONS',id,null,rec,'',{});
  return true;
}

function returnInventoryAllocation_(user,data){
  requireFinance_(user);
  requireFields_(data,['allocationId']);
  const a=findOne_('23_INVENTORY_ALLOCATIONS','Allocation_ID',data.allocationId);
  if(!a)throw new Error('Inventory allocation not found.');
  if(String(a.Status||'')!=='ALLOCATED')throw new Error('This allocation is already closed.');

  const item=findOne_('22_INVENTORY','Inventory_ID',a.Inventory_ID);
  if(!item)throw new Error('Inventory item not found.');
  const returned=Number(a.Qty||0);
  const available=Math.min(Number(item.Qty_Owned||0),Number(item.Qty_Available||0)+returned);

  updateObjectRow_('23_INVENTORY_ALLOCATIONS',a._row,{Status:'RETURNED'});
  updateObjectRow_('22_INVENTORY',item._row,{Qty_Available:available,Updated_At:nowIso_()});
  appendObject_('24_INVENTORY_TRANSACTIONS',{
    Inventory_Txn_ID:'ITX-'+Utilities.getUuid(),
    Inventory_ID:item.Inventory_ID,
    Txn_Type:'RETURN',
    Qty:returned,
    Event_ID:a.Event_ID||'',
    Reference:a.Allocation_ID,
    Txn_Date:formatDateOnly_(new Date()),
    Notes:'',
    Created_By:user.User_ID,
    Created_At:nowIso_()
  });
  audit_(user,'RETURN_INVENTORY','INVENTORY_ALLOCATIONS',a.Allocation_ID,{Status:a.Status},{Status:'RETURNED'},'',{});
  return true;
}
