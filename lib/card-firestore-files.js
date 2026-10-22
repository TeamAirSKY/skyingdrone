// Small (<=2MB) private files use the existing Firestore service account and rules.
// Binary chunks stay below Firestore's 1MiB document limit. A batch commits them atomically.
const crypto=require('node:crypto');
const CHUNK=512*1024;
function createStore(db){
 const ref=(id,i)=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('INVALID_FILE_ID');return db.collection('airsky_card_files').doc(id+'-'+i)};
 return {
  async put(file){
   const id=crypto.randomUUID(),count=Math.ceil(file.buffer.length/CHUNK);if(!count||count>4)throw Error('INVALID_FILE');const batch=db.batch();
   for(let i=0;i<count;i++)batch.create(ref(id,i),{bytes:file.buffer.subarray(i*CHUNK,(i+1)*CHUNK)});
   await batch.commit();return {backend:'firestore',pathname:id,chunks:count,sha256:crypto.createHash('sha256').update(file.buffer).digest('hex'),name:file.name,size:file.buffer.length,contentType:file.contentType};
  },
  async get(file){
   if(!Number.isInteger(file.chunks)||file.chunks<1||file.chunks>4)throw Error('INVALID_FILE');
   const docs=await db.getAll(...Array.from({length:file.chunks},(_,i)=>ref(file.pathname,i)));if(docs.some(doc=>!doc.exists))return null;
   const bytes=Buffer.concat(docs.map(doc=>Buffer.from(doc.data().bytes)));if(bytes.length!==file.size||crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('FILE_CORRUPTED');return bytes;
  },
  async remove(file){if(!Number.isInteger(file.chunks)||file.chunks<1||file.chunks>4)throw Error('INVALID_FILE');const batch=db.batch();for(let i=0;i<file.chunks;i++)batch.delete(ref(file.pathname,i));await batch.commit()}
 };
}
function storage(){return createStore(require('./firestore-storage').database())}
module.exports={createStore,put:file=>storage().put(file),get:file=>storage().get(file),remove:file=>storage().remove(file)};
