const s=require('../lib/server'),audit=require('../lib/admin-audit'),access=require('../lib/admin-access');
module.exports=async(req,res)=>{
 if(!['POST','DELETE','GET','PATCH'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method==='GET'&&req.query?.firebaseHealth==='1')return require('../lib/firebase-health')(req,res);
 if(req.method==='GET'){if(req.query?.accounts==='1')return access.manage(req,res);try{const user=await access.identity(req);return s.send(res,200,{authenticated:Boolean(user),user})}catch{return s.send(res,503,{error:'권한을 확인할 수 없습니다.'})}}
 if(!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1'&&(req.method==='PATCH'||req.method==='POST'&&s.body(req)?.action==='create'||req.method==='DELETE'&&s.body(req)?.id))return s.send(res,503,{error:'서버 이전 중입니다. 잠시 후 다시 시도해주세요.'});
 if(req.method==='POST'&&s.body(req)?.action==='certificate')return require('../lib/certificate-auth')(req,res);
 if(req.method==='POST'&&s.body(req)?.action==='reveal')return access.reveal(req,res);
 if(req.method==='PATCH'||req.method==='POST'&&s.body(req)?.action==='create'||req.method==='DELETE'&&s.body(req)?.id)return access.manage(req,res);
 if(req.method==='DELETE'){
 let auditSaved=true;
 if(s.authorized(req)){try{req.adminIdentity=await access.identity(req);await audit.append(req,res,'logout')}catch{auditSaved=false}}
 require('../lib/card-auth').clear(res);audit.appendCookie(res,s.cookie('',0));audit.appendCookie(res,'air_sky_certificate=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return s.send(res,200,{ok:true,auditSaved});
 }
 return s.send(res,403,{error:'인증서로 로그인해주세요.'});
};
