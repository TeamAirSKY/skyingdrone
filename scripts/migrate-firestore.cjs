// Never print backup values, credentials, or PINs. Run from a trusted machine.
const fs=require('node:fs/promises'),crypto=require('node:crypto');
const PREFIXES={audit:'airsky:admin:audit',requests:'airsky:requests',suggestions:'airsky:suggestions',applications:'airsky:applications'};
function checksum(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}
function destination(entry){
 const key=entry.pathname.match(/^airsky\/keys\/([A-Za-z0-9_-]+)\.json$/);
 if(key){const decoded=Buffer.from(key[1],'base64url').toString();if(!decoded.startsWith('airsky:')||Buffer.from(decoded).toString('base64url')!==key[1])throw Error('INVALID_RECORD_PATH');return {path:'airsky_records/'+key[1],data:{...entry.body,key:decoded}}}
 const list=entry.pathname.match(/^airsky\/(audit|requests|suggestions|applications)\/([0-9]{13}-[a-f0-9-]+)\.json$/);
 if(!list)throw Error('UNKNOWN_BACKUP_PATH');
 return {path:'airsky_lists/'+Buffer.from(PREFIXES[list[1]]).toString('base64url')+'/entries/'+list[2],data:{...entry.body,sortKey:list[2]}};
}
function validate(backup){
 if(backup.schema!==1||!Array.isArray(backup.entries)||!backup.entries.length||backup.digest!==checksum(backup.entries))throw Error('INVALID_BACKUP');
 const paths=new Set();for(const entry of backup.entries){if(!entry.body||!Object.hasOwn(entry.body,'value')||entry.body.expiresAt!==null&&!Number.isFinite(entry.body.expiresAt)||entry.checksum!==checksum(entry.body))throw Error('BACKUP_CHECKSUM_MISMATCH');const {path}=destination(entry);if(paths.has(path))throw Error('DUPLICATE_BACKUP_PATH');paths.add(path)}
 return backup;
}
async function exportBlob(filename){
 if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('SOURCE_BLOB_CREDENTIAL_REQUIRED');
 const blob=require('@vercel/blob'),entries=[];let cursor;
 do{const page=await blob.list({prefix:'airsky/',limit:1000,...(cursor?{cursor}:{})});
  for(const item of page.blobs){const result=await blob.get(item.pathname,{access:'private',useCache:false});if(!result)throw Error('SOURCE_RECORD_MISSING');const body=await new Response(result.stream).json(),entry={pathname:item.pathname,body,checksum:checksum(body)};destination(entry);entries.push(entry)}
  cursor=page.hasMore?page.cursor:undefined;
 }while(cursor);
 if(!entries.length)throw Error('SOURCE_IS_EMPTY');entries.sort((a,b)=>a.pathname.localeCompare(b.pathname));
 const backup={schema:1,createdAt:new Date().toISOString(),entries,digest:checksum(entries)};validate(backup);
 // No overwrites: retain earlier snapshots for recovery.
 await fs.writeFile(filename,JSON.stringify(backup),{mode:0o600,flag:'wx'});console.log(JSON.stringify({exported:entries.length,digest:backup.digest}));
}
async function load(filename){return validate(JSON.parse(await fs.readFile(filename,'utf8')))}
async function verify(db,backup){
 for(let i=0;i<backup.entries.length;i+=100){const entries=backup.entries.slice(i,i+100),refs=entries.map(e=>db.doc(destination(e).path)),docs=await db.getAll(...refs);docs.forEach((doc,n)=>{if(!doc.exists)throw Error('TARGET_RECORD_MISSING');const raw=doc.data(),expected=entries[n].body;if(checksum({value:raw.value,expiresAt:raw.expiresAt})!==checksum({value:expected.value,expiresAt:expected.expiresAt}))throw Error('TARGET_CHECKSUM_MISMATCH')})}
}
async function importBackup(filename,{write=false}={}){
 const backup=await load(filename),db=require('../lib/firestore-storage').database(),meta=db.doc('airsky_meta/migration');
 if(!write){console.log(JSON.stringify({validated:backup.entries.length,digest:backup.digest,mode:'dry-run',project:process.env.FIREBASE_PROJECT_ID}));return}
 const snapshot=await meta.get();
 if(snapshot.exists&&snapshot.data().digest!==backup.digest)throw Error('TARGET_HAS_ANOTHER_MIGRATION');
 // A verified target is immutable to this tool. Never overwrite live post-cutover data.
 if(snapshot.exists&&snapshot.data().status==='verified')throw Error('TARGET_ALREADY_VERIFIED_USE_VERIFY_COMMAND');
 if(!snapshot.exists){for(const name of ['airsky_records','airsky_lists']){const refs=await db.collection(name).listDocuments();if(refs.length)throw Error('TARGET_NOT_EMPTY')}await meta.create({schema:1,status:'importing',digest:backup.digest,count:backup.entries.length,startedAt:new Date().toISOString()})}
 for(let i=0;i<backup.entries.length;i+=200){const batch=db.batch();for(const entry of backup.entries.slice(i,i+200)){const target=destination(entry);batch.set(db.doc(target.path),target.data)}await batch.commit()}
 await verify(db,backup);
 await meta.set({schema:1,status:'verified',digest:backup.digest,count:backup.entries.length,verifiedAt:new Date().toISOString()});
 console.log(JSON.stringify({imported:backup.entries.length,verified:true,digest:backup.digest,project:process.env.FIREBASE_PROJECT_ID}));
}
async function main(){const [mode,filename,flag]=process.argv.slice(2);if(!filename||!['export','import','verify'].includes(mode))throw Error('USAGE: node scripts/migrate-firestore.cjs export|import|verify /secure/path/backup.json [--write]');
 if(mode==='export')return exportBlob(filename);
 if(mode==='import')return importBackup(filename,{write:flag==='--write'});
 const backup=await load(filename);await verify(require('../lib/firestore-storage').database(),backup);console.log(JSON.stringify({verified:true,count:backup.entries.length,digest:backup.digest}));
}
module.exports={checksum,destination,validate,verify,importBackup,exportBlob};
if(require.main===module)main().catch(error=>{console.error('MIGRATION_FAILED',error.code||error.name);if(/^[A-Z_]+(?::.*)?$/.test(error.message))console.error(error.message);process.exitCode=1});
