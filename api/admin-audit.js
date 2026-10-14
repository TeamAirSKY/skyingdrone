const s=require('../lib/server'),audit=require('../lib/admin-audit');
module.exports=async(req,res)=>{
 if(!['POST','GET'].includes(req.method))return s.send(res,405,{error:'접속 기록은 수정하거나 삭제할 수 없습니다.'});
 if(req.method==='GET'&&!await require('../lib/admin-access').requireAccess(req,res,'audit'))return;
 if(req.method==='POST'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(!s.configured()||!s.sessionConfigured())return s.send(res,503,{error:'접속 기록 저장소 설정이 아직 완료되지 않았습니다.'});
 try{
 if(req.method==='POST'){
 if(s.body(req)?.event!=='visit')return s.send(res,400,{error:'허용되지 않는 기록입니다.'});
 if(await s.limited(req,'admin-visit',30,60))return s.send(res,429,{error:'접속 요청이 많습니다. 잠시 후 다시 시도해주세요.'});
 await audit.append(req,res,'visit');return s.send(res,201,{ok:true});
 }
 const raw=Number(req.query?.offset||0),offset=Number.isSafeInteger(raw)&&raw>=0?raw:0;
 return s.send(res,200,await audit.read(offset));
 }catch{return s.send(res,503,{error:'접속 기록을 저장하거나 불러올 수 없습니다.'})}
};
