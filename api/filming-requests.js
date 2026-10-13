const crypto=require('node:crypto'),s=require('../lib/server');
module.exports=async(req,res)=>{
 if(!['POST','GET','PATCH'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method!=='GET'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(req.method!=='POST'&&!s.authorized(req))return s.send(res,401,{error:'관리자 로그인이 필요합니다.'});
 if(!s.configured())return s.send(res,503,{error:'신청 접수가 아직 준비 중입니다. 잠시 후 다시 방문해주세요.'});
 try {
 if(req.method==='POST'){
 const settings=await require('../lib/site-settings').read();if(!settings.filmingOpen)return s.send(res,403,{error:settings.filmingMessage});
 const data=s.body(req);
 if(data?.website)return s.send(res,400,{error:'입력 내용을 확인해주세요.'});
 const result=s.validateRequest(data);if(result.error)return s.send(res,400,{error:result.error});
 if(await s.limited(req,'submit',5,3600))return s.send(res,429,{error:'신청이 많습니다. 잠시 후 다시 시도해주세요.'});
 const hostname=new URL(req.headers.origin).hostname;
 const verification=await require('../lib/recaptcha').verify(data.recaptchaToken,hostname);
 if(!verification.ok)return s.send(res,verification.status,{error:verification.error});
 const id=crypto.randomUUID(),record={id,...result.value,status:'pending',createdAt:new Date().toISOString()};
 await s.redis(['SET',`airsky:request:${id}`,JSON.stringify(record),'EX',15552000]);
 try{await s.redis(['LPUSH','airsky:requests',id])}catch{await s.redis(['DEL',`airsky:request:${id}`]);throw new Error('STORAGE_UNAVAILABLE')}
 return s.send(res,201,{ok:true,id});
 }
 if(req.method==='GET'){
 const raw=Number(req.query?.offset||0),offset=Number.isSafeInteger(raw)&&raw>=0?raw:0;
 const ids=await s.redis(['LRANGE','airsky:requests',offset,offset+49]);
 const values=ids.length?await s.redis(['MGET',...ids.map(id=>`airsky:request:${id}`)]):[];
 return s.send(res,200,{requests:values.filter(Boolean).map(v=>JSON.parse(v)),nextOffset:ids.length===50?offset+50:null});
 }
 const data=s.body(req);
 if(!data||! /^[a-f0-9-]{36}$/.test(data.id)||!['pending','accepted','rejected','completed'].includes(data.status))return s.send(res,400,{error:'변경 내용을 확인해주세요.'});
 const key=`airsky:request:${data.id}`,raw=await s.redis(['GET',key]);if(!raw)return s.send(res,404,{error:'신청을 찾을 수 없습니다.'});
 const fields=require('../lib/admin-fields').validate(data);if(fields.error)return s.send(res,400,{error:fields.error});
 const record=await s.updateRecord(key,current=>{Object.assign(current,fields.value);current.status=data.status;current.updatedAt=new Date().toISOString();
 if(['completed','rejected'].includes(data.status)){delete current.instagram;delete current.instagramConsentAt;}return current;});
 return s.send(res,200,{ok:true,request:record});
 }catch{return s.send(res,503,{error:'현재 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
