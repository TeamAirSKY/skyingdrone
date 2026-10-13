const s=require('./server');
const sources={filming:{list:'airsky:requests',prefix:'airsky:request:'},suggestion:{list:'airsky:suggestions',prefix:'airsky:suggestion:'},application:{list:'airsky:applications',prefix:'airsky:application:'}};
async function list(kind,query={}){
 const source=sources[kind],raw=Number(query.offset||0);let cursor=Number.isSafeInteger(raw)&&raw>=0?raw:0;
 const view=['active','archived','all'].includes(query.view)?query.view:'active',records=[];
 while(true){
  const ids=await s.redis(['LRANGE',source.list,cursor,cursor+49]);
  if(!ids.length)return {records,nextOffset:null};
  const values=await s.redis(['MGET',...ids.map(id=>source.prefix+id)]);
  for(let i=0;i<ids.length;i++){
   if(!values[i])continue;const record=JSON.parse(values[i]);
   if(record.deleted||view==='active'&&record.archived||view==='archived'&&!record.archived)continue;
   if(records.length===50)return {records,nextOffset:cursor+i};records.push(record);
  }
  cursor+=ids.length;if(ids.length<50)return {records,nextOffset:null};
 }
}
async function remove(req,res,kind){
 const data=s.body(req);if(!data||typeof data.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(data.id))return s.send(res,400,{error:'삭제할 항목을 확인해주세요.'});
 await s.deleteRecord(sources[kind].prefix+data.id);return s.send(res,200,{ok:true});
}
module.exports={list,remove};
