const crypto=require('node:crypto'),s=require('../lib/server');
module.exports=async(req,res)=>{
 if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1'&&req.method!=='GET')return s.send(res,503,{error:'서버 이전 중입니다. 잠시 후 다시 시도해주세요.'});
 if(!['POST','GET','PATCH','DELETE'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method!=='GET'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(req.method!=='POST'&&!await require('../lib/admin-access').requireAccess(req,res,'filming'))return;
 if(!s.configured())return s.send(res,503,{error:'신청 접수가 아직 준비 중입니다. 잠시 후 다시 방문해주세요.'});
 try {
 if(req.method==='DELETE')return await require('../lib/record-management').remove(req,res,'filming');
 if(req.method==='POST'){
 const settings=await require('../lib/site-settings').read();if(!settings.filmingOpen)return s.send(res,403,{error:settings.filmingMessage});
 const data=s.body(req);
 if(data?.website)return s.send(res,400,{error:'입력 내용을 확인해주세요.'});
 if(!/^[0-9]{4}$/.test(data?.receiptPin||''))return s.send(res,400,{error:'확인용 비밀번호는 숫자 4자리로 입력해주세요.'});
 const result=s.validateRequest(data);if(result.error)return s.send(res,400,{error:result.error});
 if(await s.limited(req,'submit',5,3600))return s.send(res,429,{error:'신청이 많습니다. 잠시 후 다시 시도해주세요.'});
 const hostname=new URL(req.headers.origin).hostname;
 const verification=await require('../lib/recaptcha').verify(data.recaptchaToken,hostname);
 if(!verification.ok)return s.send(res,verification.status,{error:verification.error});
 if(!s.sessionConfigured())return s.send(res,503,{error:'신청 확인 기능이 준비 중입니다.'});
 const receipts=require('../lib/filming-receipts'),id=crypto.randomUUID(),number=await receipts.reserve(id),record={id,number,receiptPinHash:receipts.hash(id,data.receiptPin),...result.value,status:'pending',createdAt:new Date().toISOString()};
 try{await s.redis(['SET',`airsky:request:${id}`,JSON.stringify(record),'EX',15552000]);await s.redis(['LPUSH','airsky:requests',id])}catch{await s.deleteRecord(`airsky:request:${id}`);await receipts.release(id);throw new Error('STORAGE_UNAVAILABLE')}
 return s.send(res,201,{ok:true,id,number});
 }
 if(req.method==='GET'){
 const page=await require('../lib/record-management').list('filming',req.query);
 for(let i=0;i<page.records.length;i++){const item=page.records[i];if(!item.number){const receipts=require('../lib/filming-receipts'),number=await receipts.reserve(item.id,new Date(item.createdAt).getTime()+15552000000);try{page.records[i]=await s.updateRecord('airsky:request:'+item.id,current=>({...current,number:current.number||number}))}catch(error){if(error.message==='RECORD_NOT_FOUND')await receipts.release(item.id);throw error}}}
 return s.send(res,200,{requests:page.records.map(require('../lib/filming-receipts').clean),nextOffset:page.nextOffset});
 }
 const data=s.body(req);
 if(!data||! /^[a-f0-9-]{36}$/.test(data.id)||!['pending','accepted','rejected','completed'].includes(data.status))return s.send(res,400,{error:'변경 내용을 확인해주세요.'});
 const key=`airsky:request:${data.id}`,raw=await s.redis(['GET',key]);if(!raw)return s.send(res,404,{error:'신청을 찾을 수 없습니다.'});
 const fields=require('../lib/admin-fields').validate(data);if(fields.error)return s.send(res,400,{error:fields.error});
 const record=await s.updateRecord(key,current=>{Object.assign(current,fields.value);current.status=data.status;current.updatedAt=new Date().toISOString();
 if(['completed','rejected'].includes(data.status)){delete current.instagram;delete current.instagramConsentAt;}return current;});
 return s.send(res,200,{ok:true,request:require('../lib/filming-receipts').clean(record)});
 }catch{return s.send(res,503,{error:'현재 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
