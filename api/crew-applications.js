const crypto=require('node:crypto'),s=require('../lib/server');
function validate(data){
 if(!data||typeof data!=='object')return {error:'지원 내용을 확인해주세요.'};
 const name=typeof data.name==='string'?data.name.trim():'',introduction=typeof data.introduction==='string'?data.introduction.trim():'';
 if(!name||name.length>30||!introduction||introduction.length>1000)return {error:'이름은 1~30자, 소개는 1~1,000자로 입력해주세요.'};
 if(data.agreed!==true)return {error:'크루 지원 정보 수집·이용에 동의해주세요.'};
 return {value:{name,introduction}};
}
module.exports=async(req,res)=>{
 if(!['POST','GET','PATCH'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method!=='GET'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(req.method!=='POST'&&!s.authorized(req))return s.send(res,401,{error:'관리자 로그인이 필요합니다.'});
 if(!s.configured())return s.send(res,503,{error:'크루 지원 접수가 아직 준비 중입니다.'});
 try{
  if(req.method==='POST'){
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
    do{ids=await s.redis(['LRANGE','airsky:applications',offset,offset+49]);const values=ids.length?await s.redis(['MGET',...ids.map(id=>`airsky:application:${id}`)]):[];pending+=values.filter(Boolean).map(JSON.parse).filter(x=>x.status==='pending').length;offset+=50;}while(ids.length===50);
    return s.send(res,200,{pending});
   }
   const raw=Number(req.query?.offset||0),offset=Number.isSafeInteger(raw)&&raw>=0?raw:0;
   const ids=await s.redis(['LRANGE','airsky:applications',offset,offset+49]),values=ids.length?await s.redis(['MGET',...ids.map(id=>`airsky:application:${id}`)]):[];
   return s.send(res,200,{applications:values.filter(Boolean).map(JSON.parse),nextOffset:ids.length===50?offset+50:null});
  }
  const data=s.body(req);if(!data||!/^[a-f0-9-]{36}$/.test(data.id)||!['pending','reviewed','accepted','rejected'].includes(data.status))return s.send(res,400,{error:'변경 내용을 확인해주세요.'});
  const key=`airsky:application:${data.id}`;if(!await s.redis(['GET',key]))return s.send(res,404,{error:'지원을 찾을 수 없습니다.'});
  await s.updateRecord(key,record=>({...record,status:data.status,updatedAt:new Date().toISOString()}));return s.send(res,200,{ok:true});
 }catch{return s.send(res,503,{error:'현재 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
module.exports.validate=validate;
