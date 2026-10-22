const crypto=require('node:crypto'),s=require('./server'),access=require('./admin-access'),audit=require('./admin-audit');
const COOKIE='air_sky_cards';
function signature(value){return crypto.createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update('business-card:'+value).digest('base64url')}
function token(user){const value=Buffer.from(JSON.stringify({id:user.id,version:user.version,exp:Date.now()+3600000,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');return value+'.'+signature(value)}
async function identity(req){
 if(!s.sessionConfigured())return null;
 const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));if(!raw)return null;
 let data;try{const parts=raw.slice(COOKIE.length+1).split('.');if(parts.length!==2||!s.safeEqual(parts[1],signature(parts[0])))return null;data=JSON.parse(Buffer.from(parts[0],'base64url'));if(typeof data.id!=='string'||!Number.isSafeInteger(data.version)||data.exp<=Date.now()||!Number.isFinite(data.exp))return null}catch{return null}
 // Reuse account activation/version checks without issuing an administrator cookie.
 return access.identity({headers:{cookie:'air_sky_admin='+s.session(data)}});
}
async function exchange(req,res){const certificate=require('./certificate-auth');const user=await certificate.identity(req)||await access.identity(req);if(!user)return null;audit.appendCookie(res,s.cookie(token(user)).replace('air_sky_admin=',COOKIE+'='));return user}
function clear(res){audit.appendCookie(res,`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)}
module.exports={identity,exchange,clear,token};
