function db_(){ const id=PropertiesService.getScriptProperties().getProperty(DE.DB_PROP); if(!id)throw new Error('Database is not initialized. Run setupDreamEvents() first.'); return SpreadsheetApp.openById(id); }
function sheet_(name){ const sh=db_().getSheetByName(name); if(!sh)throw new Error('Missing sheet: '+name); return sh; }
function headers_(name){ const sh=sheet_(name); return sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); }
function getRows_(name){ const sh=sheet_(name); if(sh.getLastRow()<2)return []; const h=headers_(name); return sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues().map((row,i)=>{const o={_row:i+2};h.forEach((k,j)=>o[k]=row[j]);return o;}); }
function appendObject_(name,obj){ const h=headers_(name); const row=h.map(k=>obj[k]===undefined?'':obj[k]); appendRow_(name,row); return obj; }
function appendRow_(name,row){ const sh=sheet_(name); sh.appendRow(row); return sh.getLastRow(); }
function updateObjectRow_(name,rowNumber,patch){ const sh=sheet_(name), h=headers_(name); const old=sh.getRange(rowNumber,1,1,h.length).getValues()[0]; h.forEach((k,j)=>{if(Object.prototype.hasOwnProperty.call(patch,k))old[j]=patch[k]}); sh.getRange(rowNumber,1,1,h.length).setValues([old]); }
function findOne_(name,key,value){ return getRows_(name).find(r=>String(r[key])===String(value)); }
function withLock_(fn){ const lock=LockService.getScriptLock(); lock.waitLock(10000); try{return fn();}finally{lock.releaseLock();} }
function nextNumber_(type,prefix,digits){ return withLock_(()=>{const y=new Date().getFullYear();let row=getRows_('29_COUNTERS').find(r=>r.Type===type && Number(r.Year)===y);if(!row){appendRow_('29_COUNTERS',[type,y,1,nowIso_()]);return prefix+y+'-'+String(1).padStart(digits,'0');}const n=Number(row.Last_Number||0)+1;updateObjectRow_('29_COUNTERS',row._row,{Last_Number:n,Updated_At:nowIso_()});return prefix+y+'-'+String(n).padStart(digits,'0');}); }
