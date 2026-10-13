const s=require('../lib/server');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 const data=s.body(req),kind=data?.kind,id=typeof data?.id==='string'?data.id.trim():'';

 const numeric=kind==='filming'&&/^[1-9][0-9]{0,8}$/.test(id),legacy=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
 if(!['filming','crew'].includes(kind)||!numeric&&!legacy||numeric&&!/^[0-9]{4}$/.test(data?.pin||''))return s.send(res,400,{error:'신청 번호와 4자리 비밀번호를 확인해주세요.'});
 try{
 if(await s.limited(req,'receipt-status',30,600))return s.send(res,429,{error:'조회 요청이 많습니다. 잠시 후 다시 시도해주세요.'});
 if(numeric&&await s.limited(req,'receipt-number:'+id,5,600))return s.send(res,429,{error:'조회 요청이 많습니다. 잠시 후 다시 시도해주세요.'});
 const lookupId=numeric?await require('../lib/filming-receipts').find(id):id;
 const raw=lookupId?await s.redis(['GET',`airsky:${kind==='filming'?'request':'application'}:${lookupId}`]):null;if(!raw)return s.send(res,404,{error:'해당 접수를 찾을 수 없습니다. 종류·번호를 확인해주세요. 보관 기간이 지난 접수는 조회할 수 없습니다.'});
 const record=JSON.parse(raw);if(numeric&&!record.receiptPinHash)return s.send(res,404,{error:'이전 신청은 처음 받은 접수 번호로 확인해주세요.'});if(record.receiptPinHash&&(!numeric||!s.safeEqual(record.receiptPinHash,require('../lib/filming-receipts').hash(record.id,data.pin))))return s.send(res,404,{error:'신청 번호 또는 비밀번호가 올바르지 않습니다.'});return s.send(res,200,{kind,status:record.status});
 }catch{return s.send(res,503,{error:'현재 조회할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
