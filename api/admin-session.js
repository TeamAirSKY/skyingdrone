const s=require('../lib/server'),audit=require('../lib/admin-audit');
module.exports=async(req,res)=>{
 if(!['POST','DELETE','GET'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method==='GET')return s.send(res,200,{authenticated:s.authorized(req)});
 if(!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(req.method==='DELETE'){
 let auditSaved=true;
 if(s.authorized(req)){try{await audit.append(req,res,'logout')}catch{auditSaved=false}}
 audit.appendCookie(res,s.cookie('',0));return s.send(res,200,{ok:true,auditSaved});
 }
 if(!s.sessionConfigured()||!s.configured())return s.send(res,503,{error:'관리자 기능 설정이 아직 완료되지 않았습니다.'});
 try{
 if(await s.limited(req,'login',8,900)){await audit.append(req,res,'login_limited');return s.send(res,429,{error:'로그인 시도가 많습니다. 15분 후 다시 시도해주세요.'})}
 const data=s.body(req);
 if(!s.validPin(data?.pin)||!s.safeEqual(data.pin,process.env.ADMIN_PIN)){await audit.append(req,res,'login_failed');return s.send(res,401,{error:'비밀번호가 맞지 않습니다.'})}
 // Authentication is not granted if its access record cannot be saved.
 await audit.append(req,res,'login_success');audit.appendCookie(res,s.cookie(s.session()));return s.send(res,200,{ok:true});
 }catch{return s.send(res,503,{error:'접속 기록을 저장할 수 없어 현재 로그인할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
