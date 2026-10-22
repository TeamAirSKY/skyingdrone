const s=require('../lib/server'),roster=require('../lib/crew-roster'),catalog=require('../assets/drone-catalog.json');
module.exports=async(req,res)=>{
 if(req.query?.board)return require('../lib/boards')(req,res);
 if(req.query?.stats==='youtube')return require('../lib/channel-stats')(req,res);
 // Preview deployments read only the already-public roster, never production storage.
 if(process.env.VERCEL_ENV==='preview'){
  if(req.method!=='GET'||req.query?.admin==='1')return s.send(res,503,{error:'임시 사이트에서는 크루 정보를 수정할 수 없습니다. 운영 반영 후 어드민에서 관리해주세요.'});
  try{const response=await fetch('https://skying-drone.kro.kr/api/crew-roster',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('PUBLIC_ROSTER_UNAVAILABLE');const data=await response.json(),result=roster.validate({revision:0,members:data.members});if(result.error)throw Error('PUBLIC_ROSTER_INVALID');const members=result.value.filter(x=>x.active);if(req.query?.card!==undefined){const member=typeof req.query.card==='string'&&members.find(x=>x.id===req.query.card);return member?s.send(res,200,{member,catalog,preview:true}):s.send(res,404,{error:'명함을 찾을 수 없거나 비공개 상태입니다.'})}return s.send(res,200,{members,count:members.length,catalog,preview:true})}catch{return s.send(res,503,{error:'공개 크루 정보를 불러오지 못했습니다.'})}
 }
 if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1'&&req.method!=='GET')return s.send(res,503,{error:'서버 이전 중입니다. 잠시 후 다시 시도해주세요.'});
 if(!['GET','PATCH'].includes(req.method))return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(req.method==='PATCH'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 const admin=req.method==='PATCH'||req.query?.admin==='1';if(admin&&!await require('../lib/admin-access').requireAccess(req,res,'crew'))return;
 try{
 if(req.method==='GET'){const saved=await roster.read();if(!admin&&req.query?.card!==undefined){const member=typeof req.query.card==='string'&&saved.members.find(x=>x.active&&x.id===req.query.card);return member?s.send(res,200,{member,catalog}):s.send(res,404,{error:'명함을 찾을 수 없거나 비공개 상태입니다.'})}return s.send(res,200,admin?{...saved,catalog}:{catalog,members:saved.members.filter(x=>x.active),count:saved.members.filter(x=>x.active).length})}
 const data=s.body(req),result=roster.validate(data);if(result.error)return s.send(res,400,{error:result.error});
 const saved=await s.upsertRecord(roster.KEY,{revision:0,members:roster.defaults},current=>{if(current.revision!==data.revision)throw Error('RECORD_CONFLICT');return {revision:current.revision+1,members:result.value}});return s.send(res,200,{...saved,catalog});
 }catch(error){return s.send(res,error.message==='RECORD_CONFLICT'?409:503,{error:error.message==='RECORD_CONFLICT'?'다른 변경이 먼저 반영됐습니다. 새로고침 후 다시 수정해주세요.':'크루 목록을 처리할 수 없습니다.'})}
};
