// Private, server-only storage. Conditional writes prevent concurrent lost updates.
const blob=require('@vercel/blob'),crypto=require('node:crypto');
const ROOT='airsky/';
const path=key=>ROOT+'keys/'+Buffer.from(key).toString('base64url')+'.json';
async function read(pathname){
 const result=await blob.get(encodeURI(pathname),{access:'private',useCache:false});
 if(!result)return null;
 return {data:await new Response(result.stream).json(),etag:result.blob.etag};
}
async function mutate(key,change){
 const pathname=path(key);
 for(let attempt=0;attempt<12;attempt++){
  const previous=await read(pathname),active=previous&&(!previous.data.expiresAt||previous.data.expiresAt>Date.now())?previous.data:null;
  const next=change(active);
  try{
   await blob.put(pathname,JSON.stringify(next),{access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:!!previous,...(previous?{ifMatch:previous.etag}:{})});
   return next;
  }catch(error){
   if(error instanceof blob.BlobPreconditionFailedError||(!previous&&await read(pathname)))continue;
   throw error;
  }
 }
 throw Error('STORAGE_CONTENTION');
}
async function entries(prefix){
 const rows=[];let cursor;
 do{const page=await blob.list({prefix:ROOT+prefix,limit:1000,...(cursor?{cursor}:{})});rows.push(...page.blobs);cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 return rows.sort((a,b)=>a.pathname.localeCompare(b.pathname));
}
const listPrefix=key=>key==='airsky:admin:audit'?'audit/':key==='airsky:requests'?'requests/':'suggestions/';
async function command([op,key,...args]){
 if(op==='GET'){const item=await read(path(key));return item&&(!item.data.expiresAt||item.data.expiresAt>Date.now())?item.data.value:null;}
 if(op==='MGET')return Promise.all([key,...args].map(k=>command(['GET',k])));
 if(op==='SET'){
  await mutate(key,old=>({value:args[0],expiresAt:args[1]==='EX'?Date.now()+Number(args[2])*1000:args[1]==='KEEPTTL'?old?.expiresAt||null:null}));return 'OK';
 }
 if(op==='INCR'){return (await mutate(key,old=>({value:Number(old?.value||0)+1,expiresAt:old?.expiresAt||Date.now()+86400000}))).value;}
 if(op==='EXPIRE'){await mutate(key,old=>({...old,expiresAt:Date.now()+Number(args[0])*1000}));return 1;}
 if(op==='DEL'){
  if(!/^airsky:(request|suggestion):[a-f0-9-]{36}$/.test(key))throw Error('DELETE_FORBIDDEN');
  await blob.del(path(key));return 1;
 }
 if(op==='LPUSH'){
  if(!['airsky:admin:audit','airsky:requests','airsky:suggestions'].includes(key))throw Error('INVALID_LIST');
  const order=String(9999999999999-Date.now()).padStart(13,'0');
  await blob.put(ROOT+listPrefix(key)+order+'-'+crypto.randomUUID()+'.json',JSON.stringify({value:args[0],expiresAt:key==='airsky:admin:audit'?null:Date.now()+15552000000}),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});return 1;
 }
 if(op==='LRANGE'){
  const all=await entries(listPrefix(key)),active=all.filter(x=>key==='airsky:admin:audit'||x.uploadedAt.getTime()+15552000000>Date.now());
  const selected=active.slice(Number(args[0]),Number(args[1])+1);
  return (await Promise.all(selected.map(x=>read(x.pathname)))).filter(Boolean).map(x=>x.data.value);
 }
 throw Error('INVALID_OPERATION');
}
async function update(key,change){
 const result=await mutate(key,old=>{
  if(!old)throw Error('RECORD_NOT_FOUND');
  return {...old,value:JSON.stringify(change(JSON.parse(old.value)))};
 });return JSON.parse(result.value);
}
async function cleanup(){
 // Audit paths are deliberately excluded: no expiry, overwrite or delete API.
 let removed=0;
 for(const prefix of ['keys/','requests/','suggestions/']){
  for(const entry of await entries(prefix)){
   const item=await read(entry.pathname);
   if(item?.data.expiresAt&&item.data.expiresAt<=Date.now()){
    try{await blob.del(entry.pathname,{ifMatch:item.etag});removed++;}catch(error){if(!(error instanceof blob.BlobPreconditionFailedError))throw error;}
   }
  }
 }
 return removed;
}
function monitored(fn){return async(...args)=>{try{return await fn(...args)}catch(error){const token=process.env.BLOB_READ_WRITE_TOKEN||'not-set';console.error('BLOB_STORAGE_FAILED',error.name,String(error.message).split(token).join('[redacted]').slice(0,180));throw error;}}}
module.exports={command:monitored(command),update:monitored(update),cleanup:monitored(cleanup)};
