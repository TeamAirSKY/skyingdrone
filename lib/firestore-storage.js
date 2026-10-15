// Server-only Firestore adapter. No browser receives database credentials.
const crypto=require('node:crypto');
const LISTS=['airsky:admin:audit','airsky:requests','airsky:suggestions','airsky:applications'];
const encode=key=>Buffer.from(key).toString('base64url');
const removable=key=>/^airsky:(request|suggestion|application):[a-f0-9-]{36}$/.test(key);
const live=(record,now)=>record&&(!record.expiresAt||record.expiresAt>now);
function createStorage(db,{now=Date.now,requireReady=true,freshStart=false}={}){
 let ready;
 async function check(){if(!requireReady)return;if(!ready)ready=(freshStart?initializeFresh(db):Promise.resolve()).then(()=>db.doc('airsky_meta/migration').get().then(s=>{if(!s.exists||s.data().status!=='verified'||s.data().schema!==1)throw Error('FIRESTORE_MIGRATION_NOT_VERIFIED')})).catch(error=>{ready=null;throw error});await ready}
 function record(key){if(typeof key!=='string'||!key.startsWith('airsky:'))throw Error('INVALID_KEY');return db.collection('airsky_records').doc(encode(key))}
 function list(key){if(!LISTS.includes(key))throw Error('INVALID_LIST');return db.collection('airsky_lists').doc(encode(key)).collection('entries')}
 async function mutate(key,change){await check();const ref=record(key);return db.runTransaction(async tx=>{const snapshot=await tx.get(ref),raw=snapshot.exists?snapshot.data():null,previous=live(raw,now())?raw:null,next=change(previous);tx.set(ref,{...next,key});return next})}
 async function get(key){await check();const snapshot=await record(key).get(),raw=snapshot.exists?snapshot.data():null;if(!live(raw,now()))return null;try{if(JSON.parse(raw.value)?.deleted)return null}catch{}return raw.value}
 async function range(key,start,end){await check();start=Number(start);end=Number(end);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end-start>499)throw Error('INVALID_RANGE');
  const base=list(key).orderBy('sortKey');if(key==='airsky:admin:audit'){const page=await base.offset(start).limit(end-start+1).get();return page.docs.map(d=>d.data().value)}
  const values=[];let cursor;
  while(values.length<=end){const query=cursor?base.startAfter(cursor):base,page=await query.limit(100).get();if(page.empty)break;for(const doc of page.docs){const data=doc.data();if(live(data,now()))values.push(data.value);if(values.length>end)break}cursor=page.docs.at(-1);if(page.size<100)break}
  return values.slice(start,end+1);
 }
 async function command([op,key,...args]){
  if(op==='GET')return get(key);
  if(op==='MGET'){await check();const keys=[key,...args];if(!keys.length)return [];const snapshots=await db.getAll(...keys.map(record));return snapshots.map(s=>{const raw=s.exists?s.data():null;if(!live(raw,now()))return null;try{if(JSON.parse(raw.value)?.deleted)return null}catch{}return raw.value})}
  if(op==='SET'){if(!['EX','KEEPTTL',undefined].includes(args[1]))throw Error('INVALID_SET');await mutate(key,old=>({value:args[0],expiresAt:args[1]==='EX'?now()+Number(args[2])*1000:args[1]==='KEEPTTL'?old?.expiresAt||null:null}));return 'OK'}
  if(op==='INCR')return (await mutate(key,old=>({value:Number(old?.value||0)+1,expiresAt:old?.expiresAt||now()+86400000}))).value;
  if(op==='EXPIRE'){await mutate(key,old=>({value:old?.value??0,expiresAt:now()+Number(args[0])*1000}));return 1}
  if(op==='DEL'){await remove(key);return 1}
  if(op==='LPUSH'){await check();const collection=list(key),sortKey=String(9999999999999-now()).padStart(13,'0')+'-'+crypto.randomUUID();await collection.doc(sortKey).create({value:args[0],sortKey,expiresAt:key==='airsky:admin:audit'?null:now()+15552000000});return 1}
  if(op==='LRANGE')return range(key,...args);
  throw Error('INVALID_OPERATION');
 }
 async function update(key,change){const result=await mutate(key,old=>{if(!old||JSON.parse(old.value)?.deleted)throw Error('RECORD_NOT_FOUND');return {...old,value:JSON.stringify(change(JSON.parse(old.value)))}});return JSON.parse(result.value)}
 async function upsert(key,defaults,change){const result=await mutate(key,old=>({value:JSON.stringify(change(old?JSON.parse(old.value):structuredClone(defaults))),expiresAt:old?.expiresAt||null}));return JSON.parse(result.value)}
 async function remove(key){if(!removable(key))throw Error('DELETE_FORBIDDEN');await check();const ref=record(key);await db.runTransaction(async tx=>{await tx.get(ref);tx.delete(ref)});return true}
 async function cleanup(){await check();let removed=0;
  const collections=[db.collection('airsky_records'),...LISTS.filter(k=>k!=='airsky:admin:audit').map(list)];
  for(const collection of collections){while(true){const page=await collection.where('expiresAt','>',0).where('expiresAt','<=',now()).limit(100).get();if(page.empty)break;for(const doc of page.docs){const deleted=await db.runTransaction(async tx=>{const fresh=await tx.get(doc.ref),raw=fresh.exists?fresh.data():null;if(raw?.expiresAt&&raw.expiresAt<=now()){tx.delete(doc.ref);return true}return false});if(deleted)removed++}if(page.size<100)break}}
  return removed;
 }
 return {command,update,upsert,remove,cleanup};
}
async function initializeFresh(db){
 const marker=db.doc('airsky_meta/migration');
 return db.runTransaction(async tx=>{
  const current=await tx.get(marker);
  if(current.exists){if(current.data().status==='verified'&&current.data().schema===1)return;throw Error('FIRESTORE_EXISTING_MIGRATION')}
  const records=await tx.get(db.collection('airsky_records').limit(1));
  const lists=await tx.get(db.collectionGroup('entries').limit(1));
  if(!records.empty||!lists.empty)throw Error('FIRESTORE_DESTINATION_NOT_EMPTY');
  const seeds=[['airsky:admin:accounts',{revision:0,users:[]}],['airsky:crew:roster',{revision:0,members:require('./default-crew.json')}]];
  for(const [key,value] of seeds)tx.create(db.collection('airsky_records').doc(encode(key)),{key,value:JSON.stringify(value),expiresAt:null});
  tx.create(marker,{schema:1,status:'verified',mode:'fresh-start',createdAt:new Date().toISOString()});
 });
}
function database(){
 const {getApps,initializeApp,cert,applicationDefault}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
 let app=getApps().find(x=>x.name==='airsky-firestore');
 if(!app){const projectId=process.env.FIREBASE_PROJECT_ID;if(!projectId)throw Error('FIREBASE_PROJECT_ID_REQUIRED');let credential;
  if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON){const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);if(account.project_id!==projectId)throw Error('FIREBASE_PROJECT_MISMATCH');credential=cert(account)}else credential=applicationDefault();
  app=initializeApp({projectId,credential},'airsky-firestore');
 }
 return getFirestore(app,process.env.FIRESTORE_DATABASE_ID||'(default)');
}
let storage;
function configured(){return Boolean(process.env.FIREBASE_PROJECT_ID&&(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_PROJECT_ID.startsWith('demo-')))}
const exportsObject={createStorage,database,configured,initializeFresh};
for(const method of ['command','update','upsert','remove','cleanup'])exportsObject[method]=async(...args)=>{if(!storage)storage=createStorage(database(),{freshStart:process.env.AIRSKY_FIRESTORE_FRESH_START==='1'});return storage[method](...args)};
module.exports=exportsObject;
