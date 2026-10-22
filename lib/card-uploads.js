// Authenticated, expiring staging records. Each request/document stays below platform limits.
const crypto=require('node:crypto'),s=require('./server'),files=require('./card-files');
const CHUNK=512*1024,TTL=1800;
const actorKey=actor=>crypto.createHash('sha256').update(actor).digest('hex');
async function handle(data,{actor,userId,slot,revision,publicURL}){
 const prefix='airsky:card:upload:'+actorKey(actor)+':';
 if(data.action==='upload-init'){
  if(!Number.isSafeInteger(data.size)||data.size<1||data.size>files.LIMIT||typeof data.filename!=='string'||data.filename.length>200||!(slot==='wallet'?/\.pkpass$/i:/\.(jpe?g|png|webp)$/i).test(data.filename))throw Error('INVALID_FILE');
  const uploadId=crypto.randomUUID(),meta={userId,slot,revision,filename:data.filename,size:data.size,total:Math.ceil(data.size/CHUNK)};
  await s.redis(['SET',prefix+uploadId,JSON.stringify(meta),'EX',TTL]);return {response:{uploadId,chunkSize:CHUNK}};
 }
 if(!/^[a-f0-9-]{36}$/.test(data.uploadId||''))throw Error('INVALID_UPLOAD');
 const key=prefix+data.uploadId,raw=await s.redis(['GET',key]);if(!raw)throw Error('INVALID_UPLOAD');
 const meta=JSON.parse(raw);if(meta.userId!==userId||meta.slot!==slot||meta.revision!==revision||meta.size>files.LIMIT||meta.total!==Math.ceil(meta.size/CHUNK))throw Error('INVALID_UPLOAD');
 const cleanup=async()=>{await s.redis(['SET',key,'','EX',1]);await Promise.all(Array.from({length:meta.total},(_,i)=>s.redis(['SET',key+':'+i,'','EX',1])))};
 if(data.action==='upload-cancel'){await cleanup();return {response:{ok:true}}}
 if(data.action==='upload-part'){
  if(!Number.isSafeInteger(data.index)||data.index<0||data.index>=meta.total||typeof data.base64!=='string'||data.base64.length>Math.ceil(CHUNK/3)*4)throw Error('INVALID_UPLOAD');
  const part=files.bytes(data.base64),expected=Math.min(CHUNK,meta.size-data.index*CHUNK);if(part.length!==expected)throw Error('INVALID_UPLOAD');
  await s.redis(['SET',key+':'+data.index,data.base64,'EX',TTL]);return {response:{ok:true}};
 }
 if(data.action!=='upload-complete')throw Error('INVALID_UPLOAD');
 const chunks=await Promise.all(Array.from({length:meta.total},(_,i)=>s.redis(['GET',key+':'+i])));
 const buffers=chunks.map((value,i)=>{if(!value)throw Error('INVALID_UPLOAD');const b=files.bytes(value);if(b.length!==Math.min(CHUNK,meta.size-i*CHUNK))throw Error('INVALID_UPLOAD');return b});
 const buffer=Buffer.concat(buffers);if(buffer.length!==meta.size)throw Error('INVALID_UPLOAD');
 return {prepared:await files.prepare(slot,buffer.toString('base64'),meta.filename,publicURL),cleanup};
}
module.exports={handle,CHUNK};
