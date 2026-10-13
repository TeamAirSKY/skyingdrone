const s=require('../lib/server');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 const data=s.body(req),kind=data?.kind,id=typeof data?.id==='string'?data.id.trim():'';
 if(!['filming','crew'].includes(kind)||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))return s.send(res,400,{error:'신청 종류와 접수 번호를 확인해주세요.'});
 try{
 if(await s.limited(req,'receipt-status',30,600))return s.send(res,429,{error:'조회 요청이 많습니다. 잠시 후 다시 시도해주세요.'});
 const raw=await s.redis(['GET',`airsky:${kind==='filming'?'request':'application'}:${id}`]);if(!raw)return s.send(res,404,{error:'해당 접수를 찾을 수 없습니다. 종류·번호를 확인해주세요. 보관 기간이 지난 접수는 조회할 수 없습니다.'});
 const record=JSON.parse(raw);return s.send(res,200,{kind,status:record.status});
 }catch{return s.send(res,503,{error:'현재 조회할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
