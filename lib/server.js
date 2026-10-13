const crypto = require('node:crypto');
const SESSION_SECONDS = 3600;
function send(res, status, data) { res.setHeader('Cache-Control','no-store'); return res.status(status).json(data); }
function configured() { return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || (process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN)); }
async function redis(command) {
 if (!configured()) throw new Error('STORAGE_NOT_CONFIGURED');
 if(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID)return require('./blob-storage').command(command);
 const response = await fetch(process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL, {method:'POST',headers:{Authorization:`Bearer ${process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
 if (!response.ok) throw new Error('STORAGE_UNAVAILABLE');
 const data = await response.json(); if(data.error) throw new Error('STORAGE_UNAVAILABLE'); return data.result;
}
async function updateRecord(key,change){
 if(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID)return require('./blob-storage').update(key,change);
 const raw=await redis(['GET',key]);if(!raw)throw Error('RECORD_NOT_FOUND');
 const record=change(JSON.parse(raw));await redis(['SET',key,JSON.stringify(record),'KEEPTTL']);return record;
}
function sameOrigin(req) {
 const origin=req.headers.origin, host=req.headers['x-forwarded-host']||req.headers.host;
 if(!origin||!host)return false;
 try { return new URL(origin).host === host; } catch { return false; }
}
function body(req) { if(typeof req.body==='string') { try{return JSON.parse(req.body)}catch{return null} } return req.body; }
function validPin(pin) { return typeof pin==='string' && /^\d{6}$/.test(pin); }
function sessionConfigured() { return validPin(process.env.ADMIN_PIN) && (process.env.ADMIN_SESSION_SECRET||'').length>=32; }
function safeEqual(a,b) { const aa=crypto.createHash('sha256').update(a).digest(),bb=crypto.createHash('sha256').update(b).digest();return crypto.timingSafeEqual(aa,bb); }
function signature(data) { return crypto.createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(data).digest('base64url'); }
function session() { const data=Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+SESSION_SECONDS,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');return `${data}.${signature(data)}`; }
function authorized(req) {
 if(!sessionConfigured())return false;
 const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('air_sky_admin='));
 if(!cookie)return false;const token=cookie.slice('air_sky_admin='.length),parts=token.split('.');
 if(parts.length!==2||!safeEqual(parts[1],signature(parts[0])))return false;
 try{return JSON.parse(Buffer.from(parts[0],'base64url').toString()).exp>Math.floor(Date.now()/1000)}catch{return false}
}
function cookie(value,age=SESSION_SECONDS) { return `air_sky_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
async function limited(req,scope,limit,windowSeconds) {
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const bucket=Math.floor(Date.now()/1000/windowSeconds);
 const digest=crypto.createHash('sha256').update(`${scope}:${ip}`).digest('hex');
 const key=`airsky:rate:${digest}:${bucket}`,count=await redis(['INCR',key]);
 if(count===1)await redis(['EXPIRE',key,windowSeconds+10]);return count>limit;
}
function validateRequest(data) {
 if(!data||typeof data!=='object')return {error:'입력 내용을 확인해주세요.'};
 const nickname=typeof data.nickname==='string'?data.nickname.trim():'';
 const address=typeof data.address==='string'?data.address.trim():'';
 const instagram=typeof data.instagram==='string'?data.instagram.trim().replace(/^@/,''):'';
 if(instagram&&!/^[A-Za-z0-9._]{1,30}$/.test(instagram))return {error:'인스타그램 아이디를 확인해주세요. 아이디만 입력해주세요.'};
 if(instagram&&data.instagramAgreed!==true)return {error:'인스타그램 아이디 수집·이용 동의를 확인해주세요.'};
 const details=typeof data.details==='string'?data.details.trim():'';
 const notes=typeof data.notes==='string'?data.notes.trim():'';
 if(nickname.length<1||nickname.length>30)return {error:'닉네임은 1~30자로 입력해주세요.'};
 if(address.length<5||address.length>200)return {error:'촬영 주소를 확인해주세요.'};
 if(details.length>200||notes.length>2000)return {error:'추가 입력 내용이 너무 깁니다.'};
 if(data.agreed!==true)return {error:'촬영 신청 안내를 확인하고 동의해주세요.'};
 return {value:{nickname,address,details,notes,...(instagram?{instagram,instagramConsentAt:new Date().toISOString()}: {})}};
}
module.exports={send,redis,updateRecord,configured,sameOrigin,body,validPin,sessionConfigured,safeEqual,session,authorized,cookie,limited,validateRequest};
