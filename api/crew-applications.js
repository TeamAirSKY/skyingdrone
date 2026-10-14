const crypto=require('node:crypto'),s=require('../lib/server');
function normalizePhone(value){
 if(typeof value!=='string'||value.trim().length>25||! /^[+0-9()\s-]+$/.test(value))return null;
 let phone=value.trim().replace(/[()\s-]/g,'');
 if(phone.startsWith('+82'))phone='0'+phone.slice(3).replace(/^0/,'');
 else if(phone.startsWith('0082'))phone='0'+phone.slice(4).replace(/^0/,'');
 return /^(?:010\d{8}|01[16789]\d{7,8})$/.test(phone)?phone:null;
}
function validate(data){
 if(!data||typeof data!=='object')return {error:'지원 내용을 확인해주세요.'};
 const name=typeof data.name==='string'?data.name.trim():'',introduction=typeof data.introduction==='string'?data.introduction.trim():'';
 if(!name||name.length>30||!introduction||introduction.length>1000)return {error:'이름은 1~30자, 소개는 1~1,000자로 입력해주세요.'};
 const phone=normalizePhone(data.phone);if(!phone)return {error:'알림을 받을 휴대전화번호를 정확히 입력해주세요.'};
 if(data.agreed!==true)return {error:'크루 지원 정보 수집·이용에 동의해주세요.'};
 const department=data.department||'undecided';if(!['filming','planning','editing','undecided'].includes(department))return {error:'희망 부서를 확인해주세요.'};
 return {value:{name,introduction,department,phone}};
}
module.exports=async(req,res)=>{
 if(!['POST','GET','PATCH','DELETE'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method!=='GET'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(req.method!=='POST'&&!await require('../lib/admin-access').requireAccess(req,res,'application'))return;
 if(!s.configured())return s.send(res,503,{error:'크루 지원 접수가 아직 준비 중입니다.'});
 try{
 if(req.method==='DELETE')return await require('../lib/record-management').remove(req,res,'application');
  if(req.method==='POST'){
 const settings=await require('../lib/site-settings').read();if(!settings.crewOpen)return s.send(res,403,{error:settings.crewMessage});
   const data=s.body(req);if(data?.website)return s.send(res,400,{error:'지원 내용을 확인해주세요.'});
   const result=validate(data);if(result.error)return s.send(res,400,{error:result.error});
   if(await s.limited(req,'crew-apply',5,3600))return s.send(res,429,{error:'지원 요청이 많습니다. 잠시 후 다시 시도해주세요.'});
   const id=crypto.randomUUID(),record={id,...result.value,status:'pending',createdAt:new Date().toISOString()};
   await s.redis(['SET',`airsky:application:${id}`,JSON.stringify(record),'EX',15552000]);
   try{await s.redis(['LPUSH','airsky:applications',id])}catch{await s.redis(['DEL',`airsky:application:${id}`]);throw Error('STORAGE_UNAVAILABLE')}
   return s.send(res,201,{ok:true,id});
  }
  if(req.method==='GET'){
   if(req.query?.summary==='1'){
    let offset=0,pending=0,ids;
    do{ids=await s.redis(['LRANGE','airsky:applications',offset,offset+49]);const values=ids.length?await s.redis(['MGET',...ids.map(id=>`airsky:application:${id}`)]):[];pending+=values.filter(Boolean).map(JSON.parse).filter(x=>x.status==='pending'&&!x.archived&&!x.deleted).length;offset+=50;}while(ids.length===50);
    return s.send(res,200,{pending});
   }
   const page=await require('../lib/record-management').list('application',req.query);
 return s.send(res,200,{applications:page.records,nextOffset:page.nextOffset});
  }
  const data=s.body(req);if(!data||!/^[a-f0-9-]{36}$/.test(data.id)||!['pending','reviewed','accepted','rejected'].includes(data.status))return s.send(res,400,{error:'변경 내용을 확인해주세요.'});
  const key=`airsky:application:${data.id}`;if(!await s.redis(['GET',key]))return s.send(res,404,{error:'지원을 찾을 수 없습니다.'});
  const fields=require('../lib/admin-fields').validate(data);if(fields.error)return s.send(res,400,{error:fields.error});
  await s.updateRecord(key,record=>({...record,...fields.value,status:data.status,updatedAt:new Date().toISOString()}));return s.send(res,200,{ok:true});
 }catch{return s.send(res,503,{error:'현재 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
module.exports.validate=validate;

module.exports.normalizePhone=normalizePhone;
