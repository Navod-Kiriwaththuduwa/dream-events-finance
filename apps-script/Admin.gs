function adminDateTime_(v){
  if(!v)return '';
  if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,'Asia/Colombo','yyyy-MM-dd HH:mm');
  const d=new Date(v);if(!isNaN(d.getTime()))return Utilities.formatDate(d,'Asia/Colombo','yyyy-MM-dd HH:mm');
  return String(v);
}
function adminSettingsDefaults_(){
  return {
    COMPANY_NAME:'Dream Events',COMPANY_PHONE:'+94 70 628 0480',COMPANY_EMAIL:'',COMPANY_ADDRESS:'',COMPANY_REGISTRATION_NO:'',
    BANK_NAME:'',BANK_BRANCH:'',BANK_ACCOUNT_NAME:'',BANK_ACCOUNT_NUMBER:'',QUOTATION_VALIDITY_DAYS:'14',INVOICE_DUE_DAYS:'7',
    QUOTATION_TERMS:'A booking advance is required to confirm the event. Remaining payment milestones can be agreed according to the event plan.',
    CURRENCY:'LKR',TIMEZONE:'Asia/Colombo'
  };
}
function adminSettingsObject_(rows){const out=adminSettingsDefaults_();(rows||getRows_('00_SETTINGS')).forEach(r=>{if(r.Key)out[String(r.Key)]=String(r.Value??'')});return out;}
function adminMapUser_(u){return {userId:u.User_ID,username:u.Username,fullName:u.Full_Name,role:u.Role,status:u.Status,lastLogin:adminDateTime_(u.Last_Login),createdAt:adminDateTime_(u.Created_At)};}
function getAdminBundle_(user){
  requireFinance_(user);
  const users=getRows_('01_USERS'),settingsRows=getRows_('00_SETTINGS'),sessions=getRows_('30_SESSIONS'),now=new Date();
  const counters=getRows_('29_COUNTERS').filter(r=>Number(r.Year)===now.getFullYear()).sort((a,b)=>String(a.Type||'').localeCompare(String(b.Type||''))).map(r=>({type:r.Type,year:Number(r.Year||0),lastNumber:Number(r.Last_Number||0)}));
  const recentAudit=getRows_('28_AUDIT_LOG').slice(-30).reverse().map(r=>({timestamp:adminDateTime_(r.Timestamp),userId:r.User_ID||'',username:r.Username||'',action:r.Action||'',module:r.Module||'',recordId:r.Record_ID||''}));
  const activeSessions=sessions.filter(s=>String(s.Active).toLowerCase()!=='false'&&(!s.Expires_At||new Date(s.Expires_At)>now)).length;
  return {users:users.map(adminMapUser_),settings:adminSettingsObject_(settingsRows),counters:counters,recentAudit:recentAudit,system:{totalUsers:users.length,activeUsers:users.filter(u=>u.Status==='ACTIVE').length,activeSessions:activeSessions,sheetCount:db_().getSheets().length}};
}
function nextAdminUserId_(){
  return withLock_(()=>{const users=getRows_('01_USERS');let max=0;users.forEach(u=>{const m=String(u.User_ID||'').match(/^USR-(\d+)$/);if(m)max=Math.max(max,Number(m[1]||0));});return 'USR-'+String(max+1).padStart(5,'0');});
}
function adminValidRole_(role){const r=String(role||'').toUpperCase();if(!['FINANCE_HEAD','TEAM_MEMBER'].includes(r))throw new Error('Invalid user role.');return r;}
function createAdminUser_(user,data){
  requireFinance_(user);requireFields_(data,['fullName','username','role']);
  const username=normalizeUsername_(data.username);if(!/^[a-z0-9._-]{3,40}$/.test(username))throw new Error('Username must be 3-40 characters using letters, numbers, dot, underscore or hyphen.');
  if(getRows_('01_USERS').some(u=>normalizeUsername_(u.Username)===username))throw new Error('That username already exists.');
  const role=adminValidRole_(data.role),password=randomPassword_(),salt=randomToken_(16),id=nextAdminUserId_();
  const rec={User_ID:id,Username:username,Password_Hash:hashPassword_(password,salt),Password_Salt:salt,Full_Name:String(data.fullName).trim(),Role:role,Status:'ACTIVE',Failed_Login_Count:0,Locked_Until:'',Last_Login:'',Created_At:nowIso_(),Created_By:user.User_ID,Updated_At:nowIso_()};
  appendObject_('01_USERS',rec);audit_(user,'CREATE_USER','USERS',id,null,{User_ID:id,Username:username,Full_Name:rec.Full_Name,Role:role,Status:'ACTIVE'},'',{});
  return {user:adminMapUser_(rec),temporaryPassword:password};
}
function adminOtherActiveFinanceHeads_(targetId){return getRows_('01_USERS').filter(u=>u.User_ID!==targetId&&u.Role==='FINANCE_HEAD'&&u.Status==='ACTIVE').length;}
function adminInvalidateUserSessions_(userId,keepTokenHash){getRows_('30_SESSIONS').filter(s=>s.User_ID===userId&&String(s.Active).toLowerCase()!=='false'&&(!keepTokenHash||String(s.Token_Hash)!==String(keepTokenHash))).forEach(s=>updateObjectRow_('30_SESSIONS',s._row,{Active:false,Last_Seen:nowIso_()}));}
function updateAdminUser_(user,data){
  requireFinance_(user);requireFields_(data,['userId','fullName','role','status']);const r=findOne_('01_USERS','User_ID',data.userId);if(!r)throw new Error('User not found.');
  const role=adminValidRole_(data.role),status=String(data.status||'').toUpperCase();if(!['ACTIVE','INACTIVE'].includes(status))throw new Error('Invalid user status.');
  if(r.User_ID===user.User_ID&&(role!==r.Role||status!=='ACTIVE'))throw new Error('You cannot remove access or Finance Head permissions from the account you are currently using.');
  if(r.Role==='FINANCE_HEAD'&&r.Status==='ACTIVE'&&(role!=='FINANCE_HEAD'||status!=='ACTIVE')&&adminOtherActiveFinanceHeads_(r.User_ID)<1)throw new Error('At least one active Finance Head account must remain.');
  const patch={Full_Name:String(data.fullName).trim(),Role:role,Status:status,Updated_At:nowIso_()};updateObjectRow_('01_USERS',r._row,patch);if(status!=='ACTIVE')adminInvalidateUserSessions_(r.User_ID,'');
  audit_(user,'UPDATE_USER','USERS',r.User_ID,{Full_Name:r.Full_Name,Role:r.Role,Status:r.Status},patch,'',{});return adminMapUser_(Object.assign({},r,patch));
}
function resetAdminUserPassword_(user,data){
  requireFinance_(user);requireFields_(data,['userId']);const r=findOne_('01_USERS','User_ID',data.userId);if(!r)throw new Error('User not found.');if(r.User_ID===user.User_ID)throw new Error('Use Change My Password for your own account.');
  const password=randomPassword_(),salt=randomToken_(16);updateObjectRow_('01_USERS',r._row,{Password_Salt:salt,Password_Hash:hashPassword_(password,salt),Failed_Login_Count:0,Locked_Until:'',Updated_At:nowIso_()});adminInvalidateUserSessions_(r.User_ID,'');
  audit_(user,'RESET_USER_PASSWORD','USERS',r.User_ID,null,null,'',{});return {temporaryPassword:password};
}
function changeMyPassword_(user,data,rawToken){
  requireFields_(data,['currentPassword','newPassword']);const current=findOne_('01_USERS','User_ID',user.User_ID);if(!current)throw new Error('User not found.');
  if(hashPassword_(data.currentPassword,current.Password_Salt)!==String(current.Password_Hash))throw new Error('Current password is incorrect.');
  if(String(data.newPassword).length<10)throw new Error('New password must be at least 10 characters.');
  const salt=randomToken_(16);updateObjectRow_('01_USERS',current._row,{Password_Salt:salt,Password_Hash:hashPassword_(data.newPassword,salt),Failed_Login_Count:0,Locked_Until:'',Updated_At:nowIso_()});adminInvalidateUserSessions_(current.User_ID,sha256_(rawToken||''));audit_(user,'CHANGE_PASSWORD','USERS',current.User_ID,null,null,'',{});return true;
}
function adminSettingDescriptions_(){return {COMPANY_NAME:'Company display name',COMPANY_PHONE:'Company phone',COMPANY_EMAIL:'Company email',COMPANY_ADDRESS:'Company address',COMPANY_REGISTRATION_NO:'Company registration number',BANK_NAME:'Default bank name',BANK_BRANCH:'Default bank branch',BANK_ACCOUNT_NAME:'Default bank account name',BANK_ACCOUNT_NUMBER:'Default bank account number',QUOTATION_VALIDITY_DAYS:'Default quotation validity in days',INVOICE_DUE_DAYS:'Default invoice due period in days',QUOTATION_TERMS:'Default quotation terms'};}
function saveAdminSettings_(user,data){
  requireFinance_(user);const incoming=data&&data.settings?data.settings:{};if(!String(incoming.COMPANY_NAME||'').trim())throw new Error('Company name is required.');
  const qDays=Number(incoming.QUOTATION_VALIDITY_DAYS||14),iDays=Number(incoming.INVOICE_DUE_DAYS||7);if(!Number.isFinite(qDays)||qDays<1||qDays>90)throw new Error('Quotation validity must be between 1 and 90 days.');if(!Number.isFinite(iDays)||iDays<0||iDays>365)throw new Error('Invoice due days must be between 0 and 365.');
  incoming.QUOTATION_VALIDITY_DAYS=String(Math.round(qDays));incoming.INVOICE_DUE_DAYS=String(Math.round(iDays));
  const allowed=['COMPANY_NAME','COMPANY_PHONE','COMPANY_EMAIL','COMPANY_ADDRESS','COMPANY_REGISTRATION_NO','BANK_NAME','BANK_BRANCH','BANK_ACCOUNT_NAME','BANK_ACCOUNT_NUMBER','QUOTATION_VALIDITY_DAYS','INVOICE_DUE_DAYS','QUOTATION_TERMS'];
  const rows=getRows_('00_SETTINGS'),byKey={};rows.forEach(r=>byKey[String(r.Key||'')]=r);const desc=adminSettingDescriptions_(),changed={};
  allowed.forEach(key=>{const value=String(incoming[key]??'').trim(),old=byKey[key];changed[key]=value;if(old)updateObjectRow_('00_SETTINGS',old._row,{Value:value,Description:desc[key]||old.Description||'',Updated_At:nowIso_(),Updated_By:user.User_ID});else appendObject_('00_SETTINGS',{Key:key,Value:value,Description:desc[key]||'',Updated_At:nowIso_(),Updated_By:user.User_ID});});
  audit_(user,'UPDATE_SETTINGS','ADMIN','BUSINESS_SETTINGS',null,changed,'',{});return {settings:adminSettingsObject_()};
}
