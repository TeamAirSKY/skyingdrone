const crypto=require('node:crypto'),s=require('../lib/server');
function validate(data){
 if(!data||!['site','channel'].includes(data.category))return {error:'사이트 또는 채널을 선택해주세요.'};
 const nickname=typeof data.nickname==='string'?data.nickname.trim():'',content=typeof data.content==='string'?data.content.trim():'';
 if(nickname.length>30||content.length<5||content.length>2000)return {error:'건의 내용은 5~2,000자, 닉네임은 30자 이내로 입력해주세요.'};
 if(data.agreed!==true)return {error:'건의사항 정보 수집·이용에 동의해주세요.'};
 return {value:{category:data.category,nickname,content}};
}
module.exports=async(req,res)=>{
 if(!['POST','GET','PATCH'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method!=='GET'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(req.method!=='POST'&&!s.authorized(req))return s.send(res,401,{error:'관리자 로그인이 필요합니다.'});
 if(!s.configured())return s.send(res,503,{error:'건의사항 접수가 아직 준비 중입니다.'});
 try{
 if(req.method==='POST'){
 const data=s.body(req);if(data?.website)return s.send(res,400,{error:'입력 내용을 확인해주세요.'});
 const result=validate(data);if(result.error)return s.send(res,400,{error:result.error});
 if(await s.limited(req,'suggestions',5,3600))return s.send(res,429,{error:'건의가 많습니다. 잠시 후 다시 시도해주세요.'});
 const id=crypto.randomUUID(),record={id,...result.value,status:'pending',createdAt:new Date().toISOString()};
 await s.redis(['SET',`airsky:suggestion:${id}`,JSON.stringify(record),'EX',15552000]);
 try{await s.redis(['LPUSH','airsky:suggestions',id])}catch{await s.redis(['DEL',`airsky:suggestion:${id}`]);throw Error('STORAGE_UNAVAILABLE')}
 return s.send(res,201,{ok:true,id});
 }
 if(req.method==='GET'){
 const raw=Number(req.query?.offset||0),offset=Number.isSafeInteger(raw)&&raw>=0?raw:0;
 const ids=await s.redis(['LRANGE','airsky:suggestions',offset,offset+49]);
 const values=ids.length?await s.redis(['MGET',...ids.map(id=>`airsky:suggestion:${id}`)]):[];
 return s.send(res,200,{suggestions:values.filter(Boolean).map(JSON.parse),nextOffset:ids.length===50?offset+50:null});
 }
 const data=s.body(req);if(!data||!/^[a-f0-9-]{36}$/.test(data.id)||!['pending','reviewed'].includes(data.status))return s.send(res,400,{error:'변경 내용을 확인해주세요.'});
 const key=`airsky:suggestion:${data.id}`,raw=await s.redis(['GET',key]);if(!raw)return s.send(res,404,{error:'건의사항을 찾을 수 없습니다.'});
 const record=JSON.parse(raw);record.status=data.status;record.updatedAt=new Date().toISOString();await s.redis(['SET',key,JSON.stringify(record),'KEEPTTL']);return s.send(res,200,{ok:true});
 }catch{return s.send(res,503,{error:'현재 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
module.exports.validate=validate;
