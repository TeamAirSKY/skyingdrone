// Runs only against a local emulator; never use an actual Firebase project.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('FIRESTORE_EMULATOR_HOST_REQUIRED');
process.env.FIREBASE_PROJECT_ID='demo-airsky';
const {createStorage,database}=require('../lib/firestore-storage'),db=database(),store=createStorage(db,{requireReady:false}),id='11111111-1111-1111-1111-111111111111';
before(async()=>{await db.recursiveDelete(db.collection('airsky_records'));await db.recursiveDelete(db.collection('airsky_lists'));await db.doc('airsky_meta/migration').delete()});
after(async()=>db.terminate());
test('an empty or unverified destination fails closed',async()=>{await assert.rejects(createStorage(db).command(['GET','airsky:admin:accounts']),/MIGRATION_NOT_VERIFIED/)});
test('fresh start seeds only an empty destination, is concurrent-safe and never resets live data',async()=>{
 const {initializeFresh}=require('../lib/firestore-storage');
 await store.command(['SET','airsky:existing','keep']);
 await assert.rejects(initializeFresh(db),/DESTINATION_NOT_EMPTY/);
 assert.equal(await store.command(['GET','airsky:existing']),'keep');
 await db.recursiveDelete(db.collection('airsky_records'));
 const fresh=createStorage(db,{freshStart:true});
 await Promise.all([fresh.command(['GET','airsky:admin:accounts']),initializeFresh(db)]);
 assert.deepEqual(JSON.parse(await fresh.command(['GET','airsky:admin:accounts'])),{revision:0,users:[]});
 const roster=JSON.parse(await fresh.command(['GET','airsky:crew:roster']));assert(roster.members.some(x=>x.name==='Se7'&&x.owner));
 await fresh.upsert('airsky:admin:accounts',{},()=>({revision:9,users:[{name:'preserve'}]}));
 await initializeFresh(db);assert.equal(JSON.parse(await fresh.command(['GET','airsky:admin:accounts'])).revision,9);
 await db.recursiveDelete(db.collection('airsky_records'));await db.doc('airsky_meta/migration').delete();
});
test('transactional counters and revision checks prevent concurrent lost changes',async()=>{
 const results=await Promise.all(Array.from({length:8},()=>store.command(['INCR','airsky:rate:test'])));assert.deepEqual(results.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
 const writes=await Promise.allSettled([0,1].map(()=>store.upsert('airsky:site:settings',{revision:0},old=>{if(old.revision!==0)throw Error('RECORD_CONFLICT');return {revision:1}})));assert.equal(writes.filter(x=>x.status==='fulfilled').length,1);
});
test('PIN hashes, sealed PINs and member fields survive updates with expiry retained',async()=>{
 const key='airsky:request:'+id;await store.command(['SET',key,JSON.stringify({name:'Se7',pinHash:'hash',pinSealed:'sealed',phone:'private'}),'EX',3600]);
 await store.update(key,old=>({...old,status:'completed'}));const rows=await store.command(['MGET',key,'airsky:missing']);assert.equal(rows[1],null);assert.equal(JSON.parse(rows[0]).pinSealed,'sealed');assert.equal(JSON.parse(rows[0]).phone,'private');
});
test('list order and pagination are stable; expired records are hidden; audit is never deleted',async()=>{
 await store.command(['LPUSH','airsky:admin:audit','original signed audit']);await new Promise(r=>setTimeout(r,2));await store.command(['LPUSH','airsky:admin:audit','new signed audit']);assert.deepEqual(await store.command(['LRANGE','airsky:admin:audit',0,0]),['new signed audit']);assert.deepEqual(await store.command(['LRANGE','airsky:admin:audit',1,49]),['original signed audit']);
 await store.command(['SET','airsky:expired','private','EX',-1]);assert.equal(await store.command(['GET','airsky:expired']),null);assert.equal(await store.cleanup(),1);assert.equal((await store.command(['LRANGE','airsky:admin:audit',0,49])).length,2);await assert.rejects(store.command(['DEL','airsky:admin:audit']),/DELETE_FORBIDDEN/);
 await store.remove('airsky:request:'+id);await assert.rejects(store.update('airsky:request:'+id,x=>x),/RECORD_NOT_FOUND/);
});
test('backup imports and verifies every value without altering audit signatures or allowing re-import over live data',async()=>{
 const {checksum,destination,validate,importBackup}=require('../scripts/migrate-firestore.cjs'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
 // Clear emulator-only data so the import-empty-target check is exercised.
 await db.recursiveDelete(db.collection('airsky_records'));await db.recursiveDelete(db.collection('airsky_lists'));
 const body={value:JSON.stringify({signature:'unchanged',event:'certificate_success',actor:{id:'member'}}),expiresAt:null};const entry={pathname:'airsky/audit/8000000000000-11111111-1111-1111-1111-111111111111.json',body,checksum:checksum(body)},entries=[entry],backup={schema:1,entries,digest:checksum(entries)};
 validate(backup);assert.match(destination(entry).path,/entries/);const file=path.join(os.tmpdir(),'airsky-firestore-test-'+crypto.randomUUID()+'.json');await fs.writeFile(file,JSON.stringify(backup),{mode:0o600});try{await importBackup(file,{write:true});assert.equal((await db.doc('airsky_meta/migration').get()).data().status,'verified');assert.deepEqual(await createStorage(db).command(['LRANGE','airsky:admin:audit',0,49]),[body.value]);await assert.rejects(importBackup(file,{write:true}),/ALREADY_VERIFIED/)}finally{await fs.unlink(file)}
});
test('Firebase health check reads only migration readiness and exposes no private data',async()=>{
 const handler=require('../api/admin-session'),r={setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}};
 await handler({method:'GET',query:{firebaseHealth:'1'}},r);assert.equal(r.code,200);assert.deepEqual(r.data,{ok:true,firebase:true,migrationReady:true});
});
test('real admin handlers use Firestore for account creation, certificate authentication, PIN change and session revocation',async()=>{
 process.env.AIRSKY_STORAGE_BACKEND='firestore';process.env.ADMIN_PIN='123789';process.env.ADMIN_SESSION_SECRET=crypto.randomBytes(32).toString('hex');
 const s=require('../lib/server'),handler=require('../api/admin-session');
 const response=()=>({headers:{},getHeader(k){return this.headers[k]},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(data){this.data=data;return this}});
 const call=async(body,cookie='')=>{const r=response();await handler({method:'POST',body,query:{},headers:{host:'air.example',origin:'https://air.example',cookie,'x-forwarded-for':'203.0.113.1'}},r);return r};
 let r=await call({action:'create',revision:0,name:'이전 검증 회원',permissions:['crew'],pin:'007777'},'air_sky_admin='+s.session());assert.equal(r.code,200);const memberId=r.data.users[0].id;
 let cookie='';for(const [step,extra] of [['begin',{}],['unlock',{pin:'007777',admin:true}],['change-pin',{currentPin:'007777',newPin:'008888',confirmPin:'008888'}],['verify',{}],['complete',{}]]){r=await call({action:'certificate',step,...extra},cookie);assert.equal(r.code,200);for(const header of r.headers['Set-Cookie']||[])if(header.startsWith('air_sky_certificate='))cookie=header.split(';')[0]}
 assert.equal(r.data.user.id,memberId);assert.equal(r.data.user.version,2);assert.equal(await require('../lib/admin-access').authenticate('007777'),null);assert.equal((await require('../lib/admin-access').authenticate('008888')).id,memberId);
 const logs=await require('../lib/admin-audit').read(0);assert(logs.logs.some(x=>x.actor?.id===memberId&&x.event==='certificate_success'&&x.verified));
 delete process.env.AIRSKY_STORAGE_BACKEND;
});
