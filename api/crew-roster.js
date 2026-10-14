const s=require('../lib/server'),roster=require('../lib/crew-roster'),catalog=require('../assets/drone-catalog.json');
module.exports=async(req,res)=>{
 if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1'&&req.method!=='GET')return s.send(res,503,{error:'서버 이전 중입니다. 잠시 후 다시 시도해주세요.'});
 if(!['GET','PATCH'].includes(req.method))return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(req.method==='PATCH'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 const admin=req.method==='PATCH'||req.query?.admin==='1';if(admin&&!await require('../lib/admin-access').requireAccess(req,res,'crew'))return;
 try{
 if(req.method==='GET'){const saved=await roster.read();return s.send(res,200,admin?{...saved,catalog}:{catalog,members:saved.members.filter(x=>x.active),count:saved.members.filter(x=>x.active).length})}
 const data=s.body(req),result=roster.validate(data);if(result.error)return s.send(res,400,{error:result.error});
 const saved=await s.upsertRecord(roster.KEY,{revision:0,members:roster.defaults},current=>{if(current.revision!==data.revision)throw Error('RECORD_CONFLICT');return {revision:current.revision+1,members:result.value}});return s.send(res,200,{...saved,catalog});
 }catch(error){return s.send(res,error.message==='RECORD_CONFLICT'?409:503,{error:error.message==='RECORD_CONFLICT'?'다른 변경이 먼저 반영됐습니다. 새로고침 후 다시 수정해주세요.':'크루 목록을 처리할 수 없습니다.'})}
};
