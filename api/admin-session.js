const s=require('../lib/server'),audit=require('../lib/admin-audit'),access=require('../lib/admin-access');
module.exports=async(req,res)=>{
 if(!['POST','DELETE','GET','PATCH'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method==='GET'){if(req.query?.accounts==='1')return access.manage(req,res);try{const user=await access.identity(req);return s.send(res,200,{authenticated:Boolean(user),user})}catch{return s.send(res,503,{error:'권한을 확인할 수 없습니다.'})}}
 if(!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1'&&(req.method==='PATCH'||req.method==='POST'&&s.body(req)?.action==='create'||req.method==='DELETE'&&s.body(req)?.id))return s.send(res,503,{error:'서버 이전 중입니다. 잠시 후 다시 시도해주세요.'});
 if(req.method==='POST'&&s.body(req)?.action==='reveal')return access.reveal(req,res);
 if(req.method==='PATCH'||req.method==='POST'&&s.body(req)?.action==='create'||req.method==='DELETE'&&s.body(req)?.id)return access.manage(req,res);
 if(req.method==='DELETE'){
 let auditSaved=true;
 if(s.authorized(req)){try{req.adminIdentity=await access.identity(req);await audit.append(req,res,'logout')}catch{auditSaved=false}}
 audit.appendCookie(res,s.cookie('',0));return s.send(res,200,{ok:true,auditSaved});
 }
 if(!s.sessionConfigured()||!s.configured())return s.send(res,503,{error:'관리자 기능 설정이 아직 완료되지 않았습니다.'});
 try{
 if(await s.limited(req,'login',8,900)){await audit.append(req,res,'login_limited');return s.send(res,429,{error:'로그인 시도가 많습니다. 15분 후 다시 시도해주세요.'})}
 const data=s.body(req);
 let user=null;if(s.validPin(data?.pin)){if(s.safeEqual(data.pin,process.env.ADMIN_PIN))user={id:'owner',version:0};else{const users=(await access.read()).users;user=users.find(x=>x.active&&s.safeEqual(x.pinHash,access.hash(data.pin)))}}
 if(!user){await audit.append(req,res,'login_failed');return s.send(res,401,{error:'비밀번호가 맞지 않습니다.'})}
 // Authentication is not granted if its access record cannot be saved.
 req.adminIdentity=user.id==='owner'?{id:'owner',name:'ANT'}:user;await audit.append(req,res,'login_success');audit.appendCookie(res,s.cookie(s.session(user)));const identity={id:user.id,name:user.id==='owner'?'ANT':user.name,owner:user.id==='owner'||user.owner===true,permissions:user.id==='owner'||user.owner===true?Object.keys(access.permissions):user.permissions};return s.send(res,200,{ok:true,user:identity});
 }catch{return s.send(res,503,{error:'접속 기록을 저장할 수 없어 현재 로그인할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
