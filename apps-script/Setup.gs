const SHEET_SCHEMAS = {
  '00_SETTINGS':['Key','Value','Description','Updated_At','Updated_By'],
  '01_USERS':['User_ID','Username','Password_Hash','Password_Salt','Full_Name','Role','Status','Failed_Login_Count','Locked_Until','Last_Login','Created_At','Created_By','Updated_At'],
  '02_CUSTOMERS':['Customer_ID','Customer_Name','Mobile','WhatsApp','Email','Address','Source','Notes','Status','Created_At','Created_By','Updated_At','Updated_By'],
  '03_EVENTS':['Event_ID','Event_Name','Event_Type','Customer_ID','Event_Date','Start_Time','End_Time','Venue','Guest_Count','Coordinator','Status','Package_ID','Quoted_Value','Confirmed_Value','Payment_Plan_Type','Notes','Created_By','Created_At','Updated_By','Updated_At'],
  '04_EVENT_ASSIGNMENTS':['Assignment_ID','Event_ID','User_ID','Role','Status','Created_At','Created_By'],
  '05_BUDGET_HEADERS':['Budget_ID','Event_ID','Version','Status','Estimated_Revenue','Estimated_Cost','Estimated_Profit','Estimated_Margin','Actual_Revenue','Actual_Cost','Actual_Profit','Actual_Margin','Created_By','Created_At','Updated_By','Updated_At'],
  '06_BUDGET_LINES':['Budget_Line_ID','Budget_ID','Event_ID','Level','Parent_Line_ID','Main_Item','Sub_Item','Detailed_Item','Description','Supplier_ID','Estimated_Qty','Unit','Estimated_Unit_Cost','Estimated_Total_Cost','Selling_Price','Actual_Qty','Actual_Unit_Cost','Actual_Total_Cost','Variance','Quotation_Visible','Internal_Notes','Display_Order','Status'],
  '07_PACKAGES':['Package_ID','Package_Name','Event_Type','Description','Default_Selling_Price','Status','Created_At','Created_By','Updated_At','Updated_By'],
  '08_PACKAGE_LINES':['Package_Line_ID','Package_ID','Level','Parent_Line_ID','Main_Item','Sub_Item','Detailed_Item','Description','Default_Qty','Unit','Default_Cost','Default_Selling_Price','Quotation_Visible','Display_Order','Status'],
  '09_QUOTATIONS':['Quotation_ID','Quotation_Number','Event_ID','Customer_ID','Version','Issue_Date','Valid_Until','Subtotal','Discount_Type','Discount_Value','Discount_Amount','Final_Total','Status','Terms','Notes','PDF_File_ID','PDF_URL','Created_By','Created_At'],
  '10_QUOTATION_LINES':['Quotation_Line_ID','Quotation_ID','Level','Main_Item','Sub_Item','Description','Qty','Unit_Price','Amount','Display_Order'],
  '11_INVOICES':['Invoice_ID','Invoice_Number','Event_ID','Customer_ID','Quotation_ID','Invoice_Date','Due_Date','Subtotal','Discount','Final_Total','Amount_Paid','Outstanding','Status','PDF_File_ID','PDF_URL','Created_By','Created_At'],
  '12_INVOICE_LINES':['Invoice_Line_ID','Invoice_ID','Description','Qty','Unit_Price','Amount','Display_Order'],
  '13_PAYMENT_PLANS':['Payment_Plan_ID','Event_ID','Sequence','Milestone_Name','Percentage','Expected_Amount','Due_Date','Received_Amount','Balance','Status'],
  '14_PAYMENTS':['Payment_ID','Event_ID','Customer_ID','Invoice_ID','Payment_Plan_ID','Amount','Payment_Method','Payment_Date','Reference','Status','Created_By','Created_At'],
  '15_RECEIPTS':['Receipt_ID','Receipt_Number','Payment_ID','Event_ID','Customer_ID','Invoice_ID','Amount','Receipt_Date','Payment_Method','Reference','Remaining_Balance','PDF_File_ID','PDF_URL','Created_By','Created_At'],
  '16_INCOME':['Income_ID','Event_ID','Customer_ID','Invoice_ID','Income_Type','Amount','Payment_Method','Payment_Date','Reference','Approval_Status','Entered_By','Approved_By','Approved_At','Receipt_ID','Notes','Created_At'],
  '17_EXPENSES':['Expense_ID','Event_ID','Budget_Line_ID','Expense_Scope','Main_Category','Sub_Category','Description','Supplier_ID','Amount','Payment_Method','Paid_From','Expense_Date','Attachment_URL','Approval_Status','Submitted_By','Submitted_At','Approved_By','Approved_At','Locked','Rejection_Reason','Notes','Created_At'],
  '18_REFUNDS':['Refund_ID','Event_ID','Customer_ID','Payment_ID','Reason','Amount','Refund_Date','Payment_Method','Approval_Status','Approved_By','Created_By','Created_At'],
  '19_SUPPLIERS':['Supplier_ID','Supplier_Name','Category','Contact_Person','Phone','WhatsApp','Email','Address','Bank_Name','Account_Name','Account_Number','Notes','Status','Created_At','Created_By'],
  '20_PAYABLES':['Payable_ID','Payable_Type','Party_ID','Party_Name','Event_ID','Related_Expense_ID','Original_Amount','Paid_Amount','Outstanding','Due_Date','Status','Created_At','Created_By','Updated_At'],
  '21_REIMBURSEMENTS':['Reimbursement_ID','Payable_ID','Party_ID','Amount','Payment_Method','Payment_Date','Reference','Approved_By','Created_At'],
  '22_INVENTORY':['Inventory_ID','Inventory_Code','Item_Name','Main_Category','Sub_Category','Qty_Owned','Qty_Available','Purchase_Date','Purchase_Cost','Internal_Cost_Per_Use','Default_Customer_Charge','Storage_Location','Condition','Status','Photo_URL','Created_At','Created_By','Updated_At'],
  '23_INVENTORY_ALLOCATIONS':['Allocation_ID','Inventory_ID','Event_ID','Qty','From_Date','To_Date','Internal_Cost','Customer_Charge','Status','Allocated_By','Created_At'],
  '24_INVENTORY_TRANSACTIONS':['Inventory_Txn_ID','Inventory_ID','Txn_Type','Qty','Event_ID','Reference','Txn_Date','Notes','Created_By','Created_At'],
  '25_STAFF':['Staff_ID','Name','Role','Hourly_Cost','Daily_Cost','Status','Created_At','Created_By'],
  '26_EVENT_LABOUR':['Event_Labour_ID','Event_ID','Staff_ID','Hours','Days','Rate_Type','Rate','Calculated_Cost','Notes','Created_At','Created_By'],
  '27_ATTACHMENTS':['Attachment_ID','Module','Record_ID','Event_ID','File_Name','Mime_Type','Drive_File_ID','Drive_URL','Uploaded_By','Uploaded_At'],
  '28_AUDIT_LOG':['Audit_ID','Timestamp','User_ID','Username','Action','Module','Record_ID','Old_Value','New_Value','Reason','Metadata'],
  '29_COUNTERS':['Type','Year','Last_Number','Updated_At'],
  '30_SESSIONS':['Session_ID','Token_Hash','User_ID','Created_At','Expires_At','Active','Last_Seen','User_Agent']
};

function setupDreamEvents() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(DE.DB_PROP);
  let ss;
  if (ssId) ss = SpreadsheetApp.openById(ssId);
  else {
    ss = SpreadsheetApp.create('Dream Events Finance DB');
    props.setProperty(DE.DB_PROP, ss.getId());
  }
  Object.keys(SHEET_SCHEMAS).forEach(name => ensureSheet_(ss, name, SHEET_SCHEMAS[name]));
  const first = ss.getSheetByName('Sheet1');
  if (first && Object.keys(SHEET_SCHEMAS).length > 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  ['01_USERS','28_AUDIT_LOG','29_COUNTERS','30_SESSIONS'].forEach(name=>{const sh=ss.getSheetByName(name);if(sh)sh.hideSheet();});
  seedSettings_(ss);
  seedCounters_(ss);
  const folder = ensureRootFolder_();
  let admin = getRows_('01_USERS').find(u=>u.Role==='FINANCE_HEAD' && u.Status==='ACTIVE');
  let temporaryPassword = '';
  if (!admin) {
    temporaryPassword = randomPassword_();
    const salt=randomToken_(16);
    admin={User_ID:'USR-00001',Username:'finance',Password_Hash:hashPassword_(temporaryPassword,salt),Password_Salt:salt,Full_Name:'Finance Head',Role:'FINANCE_HEAD',Status:'ACTIVE',Failed_Login_Count:0,Locked_Until:'',Last_Login:'',Created_At:nowIso_(),Created_By:'SETUP',Updated_At:nowIso_()};
    appendObject_('01_USERS',admin);
  }
  return {databaseId:ss.getId(),databaseUrl:ss.getUrl(),driveFolderId:folder.getId(),driveFolderUrl:folder.getUrl(),adminUsername:'finance',temporaryPassword:temporaryPassword || '(existing admin retained)',next:'Set DREAM_EVENTS_FRONTEND_ORIGIN in Script Properties, deploy as Web App, then paste /exec URL into assets/js/config.js.'};
}

function ensureSheet_(ss,name,headers){ let sh=ss.getSheetByName(name); if(!sh)sh=ss.insertSheet(name); if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#171511').setFontColor('#ffffff');sh.autoResizeColumns(1,headers.length);return;} const current=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const missing=headers.filter(h=>!current.includes(h)); if(missing.length){const start=sh.getLastColumn()+1;sh.getRange(1,start,1,missing.length).setValues([missing]);sh.getRange(1,start,1,missing.length).setFontWeight('bold').setBackground('#171511').setFontColor('#ffffff');sh.autoResizeColumns(start,missing.length);} }
function seedSettings_(){ if(getRows_('00_SETTINGS').length)return; [['COMPANY_NAME','Dream Events','Company display name'],['CURRENCY','LKR','System currency'],['QUOTATION_VALIDITY_DAYS','14','Default quotation validity'],['TIMEZONE','Asia/Colombo','Business timezone']].forEach(r=>appendRow_('00_SETTINGS',[r[0],r[1],r[2],nowIso_(),'SETUP'])); }
function seedCounters_(){ const y=new Date().getFullYear(); const existing=getRows_('29_COUNTERS'); ['EVENT','QUOTE','INVOICE','RECEIPT','EXPENSE','INCOME','CUSTOMER','SUPPLIER','INVENTORY','PAYABLE','BUDGET','BUDGET_LINE'].forEach(t=>{if(!existing.some(r=>r.Type===t&&Number(r.Year)===y))appendRow_('29_COUNTERS',[t,y,0,nowIso_()]);}); }
function ensureRootFolder_(){ const props=PropertiesService.getScriptProperties(); const id=props.getProperty(DE.DRIVE_PROP); if(id){try{return DriveApp.getFolderById(id)}catch(e){}} const f=DriveApp.createFolder('Dream Events Finance'); ['Events','Business Expenses','Inventory','System Documents'].forEach(n=>f.createFolder(n)); props.setProperty(DE.DRIVE_PROP,f.getId()); return f; }
