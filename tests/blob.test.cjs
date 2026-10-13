const {test}=require('node:test'),assert=require('node:assert/strict');
const sdk=require('@vercel/blob');let files=new Map(),revision=0;
sdk.get=async path=>{const value=files.get(path);return value?{stream:new Response(value.body).body,blob:{etag:value.etag}}:null};
sdk.put=async(path,body,options)=>{
 assert.equal(options.access,'private');assert.equal(options.addRandomSuffix,false);
 const old=files.get(path);
 if(options.ifMatch&&old?.etag!==options.ifMatch)throw new sdk.BlobPreconditionFailedError();
 if(old&&!options.allowOverwrite)throw Error('already exists');
 files.set(path,{body,etag:String(++revision),uploadedAt:new Date()});
};
sdk.list=async({prefix})=>({blobs:[...files].filter(([k])=>k.startsWith(prefix)).map(([pathname,v])=>({pathname,uploadedAt:v.uploadedAt})),hasMore:false});
sdk.del=async(path,options={})=>{if(options.ifMatch&&files.get(path)?.etag!==options.ifMatch)throw new sdk.BlobPreconditionFailedError();files.delete(path)};
const storage=require('../lib/blob-storage');
test('conditional counter writes preserve concurrent increments',async()=>{files.clear();const counts=await Promise.all(Array.from({length:10},()=>storage.command(['INCR','airsky:rate:test:1'])));assert.deepEqual(counts.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10])});
test('concurrent record changes preserve removed contact and expiry',async()=>{files.clear();const key='airsky:request:11111111-1111-1111-1111-111111111111';await storage.command(['SET',key,JSON.stringify({instagram:'example',status:'pending'}),'EX',15552000]);await Promise.all([storage.update(key,r=>{delete r.instagram;return r}),storage.update(key,r=>({...r,status:'accepted'}))]);assert.deepEqual(JSON.parse(await storage.command(['GET',key])),{status:'accepted'});assert(JSON.parse([...files.values()][0].body).expiresAt>Date.now())});
test('expired private data is inaccessible and cleanup never deletes audit',async()=>{files.clear();await storage.command(['SET','airsky:request:11111111-1111-1111-1111-111111111111','private','EX',-1]);await storage.command(['LPUSH','airsky:admin:audit','signed audit']);assert.equal(await storage.command(['GET','airsky:request:11111111-1111-1111-1111-111111111111']),null);assert.equal(await storage.cleanup(),1);assert.deepEqual(await storage.command(['LRANGE','airsky:admin:audit',0,49]),['signed audit']);await assert.rejects(storage.command(['DEL','airsky:admin:audit']),/DELETE_FORBIDDEN/)});
test('storage cleanup requires cron authentication',async()=>{const handler=require('../api/storage-cleanup');const res={setHeader(){},status(n){this.code=n;return this},json(){return this}};await handler({method:'GET',headers:{}},res);assert.equal(res.code,401)});
