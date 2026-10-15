const crypto=require('node:crypto'),s=require('./server');
const KEY='airsky:admin:audit';
function secret(){return process.env.ADMIN_AUDIT_SECRET||process.env.ADMIN_SESSION_SECRET}
function mac(value){return crypto.createHmac('sha256',secret()).update('air-sky-audit:'+value).digest('base64url')}
function appendCookie(res,value){const previous=res.getHeader?.('Set-Cookie');res.setHeader('Set-Cookie',previous?[...(Array.isArray(previous)?previous:[previous]),value]:[value])}
function device(req,res){
 const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('air_sky_device='))?.slice(15)||'';
 const [id,sig]=raw.split('.');let deviceId=id;
 if(!/^[a-f0-9-]{36}$/.test(id||'')||!sig||!s.safeEqual(sig,mac('device:'+id))){deviceId=crypto.randomUUID();appendCookie(res,`air_sky_device=${deviceId}.${mac('device:'+deviceId)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`)}
 return mac('identifier:'+deviceId).slice(0,16);
}
function describe(ua=''){
 ua=String(ua).slice(0,512);
 let os=/iPhone|iPod/.test(ua)?'iOS':/iPad|Macintosh.*Mobile/.test(ua)?'iPadOS':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Macintosh|Mac OS X/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'알 수 없음';
 const candidates=[['Edge',/Edg(?:e|A|iOS)?\/(\d+)/],['Opera',/OPR\/(\d+)/],['Chrome',/(?:Chrome|CriOS)\/(\d+)/],['Firefox',/(?:Firefox|FxiOS)\/(\d+)/],['Safari',/Version\/(\d+).*Safari/]];
 const found=candidates.map(([name,re])=>{const m=ua.match(re);return m?name+' '+m[1]:null}).find(Boolean);
 return {os,browser:found||'알 수 없음'};
}
async function append(req,res,event){
 if(!s.configured()||!s.sessionConfigured())throw Error('AUDIT_NOT_CONFIGURED');
 if(!['visit','login_success','login_failed','login_limited','logout','certificate_success'].includes(event))throw Error('INVALID_EVENT');
 const record={id:crypto.randomUUID(),createdAt:new Date().toISOString(),event,deviceId:device(req,res),...describe(req.headers['user-agent'])};
 if(req.adminIdentity)record.actor={id:req.adminIdentity.id,name:req.adminIdentity.name};
 record.signature=mac(JSON.stringify(record));
 // Append only: no expiry, trim, overwrite or deletion operation for this key.
 await s.redis(['LPUSH',KEY,JSON.stringify(record)]);
}
async function read(offset){
 const rows=await s.redis(['LRANGE',KEY,offset,offset+49]);
 return {logs:rows.map(raw=>{try{const data=JSON.parse(raw),{signature,...record}=data;return {...record,verified:typeof signature==='string'&&s.safeEqual(signature,mac(JSON.stringify(record)))}}catch{return {event:'unverified',verified:false}}}),nextOffset:rows.length===50?offset+50:null};
}
module.exports={append,read,describe,appendCookie};
