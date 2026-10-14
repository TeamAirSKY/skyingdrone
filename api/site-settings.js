const s=require('../lib/server'),settings=require('../lib/site-settings');
module.exports=async(req,res)=>{
 if(!['GET','PATCH'].includes(req.method))return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(req.method==='PATCH'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(!await require('../lib/admin-access').requireAccess(req,res,'settings'))return;
 try{
 if(req.method==='GET')return s.send(res,200,await settings.read());
 const data=s.body(req),result=settings.validate(data);if(result.error)return s.send(res,400,{error:result.error});
 const saved=await s.upsertRecord(settings.KEY,settings.defaults,current=>{if(current.revision!==data.revision)throw Error('RECORD_CONFLICT');return {...current,...result.value,revision:current.revision+1}});return s.send(res,200,saved);
 }catch(error){return s.send(res,error.message==='RECORD_CONFLICT'?409:503,{error:error.message==='RECORD_CONFLICT'?'다른 변경이 먼저 반영됐습니다. 새로고침 후 다시 수정해주세요.':'설정을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
