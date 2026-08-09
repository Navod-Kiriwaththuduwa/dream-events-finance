function nowIso_(){ return new Date().toISOString(); }
function normalizeUsername_(u){ return String(u||'').trim().toLowerCase(); }
function requireFields_(data,fields){ fields.forEach(f=>{if(data[f]===undefined||data[f]===null||String(data[f]).trim()==='')throw new Error(f+' is required.');}); }
function randomToken_(bytes){ const parts=[]; for(let i=0;i<(bytes||32);i++)parts.push(('0'+Math.floor(Math.random()*256).toString(16)).slice(-2)); return Utilities.getUuid().replace(/-/g,'')+parts.join(''); }
function randomPassword_(){ return 'DE-'+Utilities.getUuid().replace(/-/g,'').slice(0,12)+'!'; }
function bytesToHex_(bytes){ return bytes.map(b=>('0'+((b<0?b+256:b)&255).toString(16)).slice(-2)).join(''); }
function sha256_(s){ return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8)); }
function hashPassword_(password,salt){ let v=String(password)+':'+String(salt); for(let i=0;i<3500;i++)v=sha256_(v+':'+salt+':'+i); return v; }
function publicUser_(u){ return {userId:u.User_ID,username:u.Username,fullName:u.Full_Name,role:u.Role,status:u.Status}; }
function requireFinance_(u){ if(!u||u.Role!=='FINANCE_HEAD')throw new Error('Finance Head access required.'); }
function audit_(user,action,module,recordId,oldValue,newValue,reason,metadata){ appendObject_('28_AUDIT_LOG',{Audit_ID:'AUD-'+Utilities.getUuid(),Timestamp:nowIso_(),User_ID:user?.User_ID||'',Username:user?.Username||'',Action:action,Module:module,Record_ID:recordId||'',Old_Value:oldValue?JSON.stringify(oldValue).slice(0,5000):'',New_Value:newValue?JSON.stringify(newValue).slice(0,5000):'',Reason:reason||'',Metadata:metadata?JSON.stringify(metadata).slice(0,2000):''}); }
