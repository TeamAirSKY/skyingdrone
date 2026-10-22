const crypto=require('node:crypto'),s=require('./server'),access=require('./admin-access'),audit=require('./admin-audit'),roster=require('./crew-roster');
const COOKIE='air_sky_certificate';
function sign(value){return crypto.createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update('certificate:'+value).digest('base64url')}
function write(res,data){const value=Buffer.from(JSON.stringify({...data,exp:Date.now()+300000})).toString('base64url');audit.appendCookie(res,`${COOKIE}=${value}.${sign(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`)}
function read(req){try{const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';const [value,mac]=raw.split('.');if(!mac||!s.safeEqual(mac,sign(value)))return null;const data=JSON.parse(Buffer.from(value,'base64url'));return data.exp>Date.now()?data:null}catch{return null}}
async function current(data){if(!data?.id)return null;return access.identity({headers:{cookie:'air_sky_admin='+s.session({id:data.id,version:data.version})}})}
function memberKey(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[\s._-]+/g,'')}
async function profile(user){
 const key=memberKey(user.name),matches=(await roster.read()).members.filter(x=>memberKey(x.name)===key||memberKey(x.id)===key);
 const member=matches.length===1?matches[0]:null;
 if(!member)return {name:user.name,role:'부서 미지정'};
 // A team owner has no department. Admin permissions do not determine team roles.
 if(member.owner)return {name:user.name,role:'OWNER'};
 const teams=[['filming',/(?:촬영|찰영)\s*팀/],['planning',/기획\s*팀/],['editing',/편집\s*팀/]].filter(([,pattern])=>pattern.test(member.bio||''));
 const department={filming:'촬영팀',planning:'기획팀',editing:'편집팀'}[teams.length===1?teams[0][0]:member.department]||'';
 return {name:user.name,role:member.coOwner?['CO-OWNER',department].filter(Boolean).join('-'):department||'부서 미지정'};
}
module.exports=async(req,res)=>{
 if(!s.sessionConfigured()||!s.configured())return s.send(res,503,{error:'관리자 기능 설정이 아직 완료되지 않았습니다.'});
 const data=s.body(req)||{};
 try{
  const pending=read(req);
  if(data.step==='begin'){const returnTo=typeof data.returnTo==='string'&&/^\/board\.html\?board=(notices|general|filming|planning|editing)&compose=1$/.test(data.returnTo)?data.returnTo:null;write(res,{stage:'request',admin:true,...(returnTo?{returnTo}:{})});return s.send(res,200,{ok:true})}
  if(data.step==='unlock'){
   const user=await access.authenticate(data.pin);
   if(!user){await audit.append(req,res,'login_failed');return s.send(res,401,{error:'비밀번호가 맞지 않습니다.'})}
   const certificate=await profile(user),admin=data.admin===true&&pending?.admin===true;
   write(res,{stage:'unlocked',id:user.id,version:user.version,admin,...(admin&&pending?.returnTo?{returnTo:pending.returnTo}:{})});return s.send(res,200,{ok:true,certificate,admin});
  }
  const user=await current(pending);
  if(!user)return s.send(res,401,{error:'비밀번호를 입력해 다시 인증해주세요.'});
  req.adminIdentity=user;
  if(data.step==='change-pin'){
   if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1')return s.send(res,503,{error:'서버 이전 중입니다. 잠시 후 다시 시도해주세요.'});
   if(!s.validPin(data.currentPin)||!s.validPin(data.newPin)||data.newPin!==data.confirmPin)return s.send(res,400,{error:'비밀번호는 숫자 6자리이며 새 비밀번호와 확인이 같아야 합니다.'});
   try{await access.changePin(user,data.currentPin,data.newPin)}catch(error){
    const messages={WRONG_PIN:'현재 비밀번호가 맞지 않습니다.',SAME_PIN:'현재와 다른 새 비밀번호를 입력해주세요.',PIN_DUPLICATE:'사용할 수 없는 비밀번호입니다. 다른 번호를 입력해주세요.',STALE_ACCOUNT:'회원 정보가 변경됐습니다. 비밀번호를 입력해 다시 인증해주세요.'};
    if(messages[error.message])return s.send(res,error.message==='STALE_ACCOUNT'?401:400,{error:messages[error.message]});throw error;
   }
   write(res,{...pending,version:user.version+1});return s.send(res,200,{ok:true});
  }
  if(data.step==='history'){
   const offset=Number.isSafeInteger(data.offset)&&data.offset>=0?data.offset:0,result=await audit.read(offset);
   return s.send(res,200,{logs:result.logs.filter(x=>x.verified&&x.event==='certificate_success'&&x.actor?.id===user.id),nextOffset:result.nextOffset});
  }
  if(data.step==='verify'&&pending.stage==='unlocked'&&pending.admin){
   await audit.append(req,res,'certificate_success');write(res,{...pending,stage:'verified'});return s.send(res,200,{ok:true});
  }
  if(data.step==='complete'&&pending.stage==='verified'&&pending.admin){
   await audit.append(req,res,'login_success');audit.appendCookie(res,s.cookie(s.session(user)));audit.appendCookie(res,`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);return s.send(res,200,{ok:true,user,...(pending.returnTo?{redirect:pending.returnTo}:{})});
  }
  return s.send(res,400,{error:'관리자 페이지에서 인증을 다시 시작해주세요.'});
 }catch{return s.send(res,503,{error:'인증 정보 또는 기록을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'})}
};

module.exports.identity=async req=>current(read(req));
