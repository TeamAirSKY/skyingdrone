const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.ADMIN_PIN='872164';process.env.ADMIN_SESSION_SECRET=crypto.randomBytes(32).toString('hex');process.env.ADMIN_AUDIT_SECRET=crypto.randomBytes(32).toString('hex');process.env.KV_REST_API_URL='https://test.invalid';process.env.KV_REST_API_TOKEN='fixture';delete process.env.BLOB_READ_WRITE_TOKEN;delete process.env.BLOB_STORE_ID;delete process.env.AIRSKY_STORAGE_BACKEND;
const s=require('../lib/server'),access=require('../lib/admin-access'),cards=require('../lib/business-cards'),files=require('../lib/card-files'),handler=require('../lib/business-card-api'),login=require('../api/admin-session'),{pass,zip}=require('./helpers/card-fixtures.cjs');
const db=new Map(),binary=new Map();let unavailable=false;
global.fetch=async(_url,opts)=>{if(unavailable)throw Error('unavailable');const [op,key,...args]=JSON.parse(opts.body);let result;if(op==='GET')result=db.get(key)||null;else if(op==='SET'){db.set(key,args[0]);result='OK'}else if(op==='INCR'){result=(db.get(key)||0)+1;db.set(key,result)}else if(op==='EXPIRE')result=1;else if(op==='LPUSH'){const rows=db.get(key)||[];rows.unshift(args[0]);db.set(key,rows);result=rows.length}else if(op==='LRANGE')result=(db.get(key)||[]).slice(args[0],args[1]+1);else throw Error(op);return {ok:true,json:async()=>({result})}};
files.put=async(id,slot,file)=>{const pathname=id+'/'+slot+'/'+crypto.randomUUID();binary.set(pathname,file.buffer);return {pathname,name:file.name,size:file.buffer.length,contentType:file.contentType}};files.get=async file=>binary.get(file.pathname)||null;files.remove=async file=>file&&binary.delete(file.pathname);
function req(method='GET',body,cookie='',query={}){return {method,body,query,headers:{host:'air.test',origin:'https://air.test',cookie,'x-forwarded-for':'192.0.2.3'}}}
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},getHeader(k){return this.headers[k]},status(n){this.code=n;return this},json(data){this.data=data;return this},end(buffer){this.buffer=buffer;return this}}}
async function call(method,body,cookie,query){const r=res();await handler(req(method,body,cookie,query),r);return r}
async function adminCall(method,body){const r=res();await require('../api/site-settings')(req(method,{...body,userId:'one'},'air_sky_admin='+s.session(),{wallet:'1'}),r);if(r.code===200&&method!=='GET'){r.data={...r.data,card:cards.managerView(await cards.read('one'))}}return r}
function cookie(id='one',version=1){return 'air_sky_cards='+require('../lib/card-auth').token({id,version})}
beforeEach(()=>{db.clear();binary.clear();unavailable=false;delete process.env.AIRSKY_MIGRATION_READ_ONLY;db.set('airsky:admin:accounts',JSON.stringify({revision:0,users:[{id:'one',name:'첫 회원',active:true,version:1,permissions:['crew'],pinHash:access.hash('111222')},{id:'two',name:'두 번째',active:true,version:1,permissions:['crew'],pinHash:access.hash('333444')}]}))});
test('certificate unlock can exchange a management session; direct URLs and public IDs never authorize editing',async()=>{
 let r=await call();assert.equal(r.code,401);const unlock=res();await login(req('POST',{action:'certificate',step:'unlock',pin:'111222'}),unlock);assert.equal(unlock.code,200);const cert=unlock.headers['Set-Cookie'].find(x=>x.startsWith('air_sky_certificate=')).split(';')[0];r=await call('POST',{action:'session'},cert);assert.equal(r.code,200);const management=r.headers['Set-Cookie'].find(x=>x.startsWith('air_sky_cards=')).split(';')[0];r=await call('POST',{action:'create'},management);assert.equal(r.data.card.name,'첫 회원');const id=r.data.card.publicId;
 for(const method of ['PUT','POST','DELETE']){r=await call(method,{publicId:id,id,slot:'profile',revision:0},'',{id});assert.equal(r.code,401)}
 r=await call('POST',{action:'session'},management);assert.equal(r.code,200);
 const expired='air_sky_cards='+require('../lib/card-auth').token({id:'one',version:0});assert.equal((await call('GET',null,expired)).code,401);
 const record=JSON.parse(db.get('airsky:admin:accounts'));record.users[0].active=false;db.set('airsky:admin:accounts',JSON.stringify(record));assert.equal((await call('GET',null,management)).code,401);
});
test('save persists across sessions, filters private data server-side, keeps URL/QR stable and ignores another owner ID',async()=>{
 let r=await call('POST',{action:'create'},cookie());const initial=r.data,url=initial.publicURL,id=initial.card.publicId;let draft={...initial.card,published:true,name:'<script>alert(1)</script>',phone:'010-1234-5678',email:'secret@example.com',bio:'공개 소개',visibility:{...initial.card.visibility,phone:false,email:false},links:[{title:'공개',url:'https://example.com',public:true},{title:'비밀 SNS',url:'https://private.test',public:false}],extras:[{title:'비공개 정보',content:'비밀',public:false}],id:'two',publicId:crypto.randomUUID()};r=await call('PUT',draft,cookie());assert.equal(r.code,200);assert.equal(r.data.publicURL,url);assert.equal(r.data.card.publicId,id);assert.equal(r.data.card.revision,1);
 r=await call('GET',null,cookie());assert.equal(r.data.card.email,'secret@example.com');assert.equal(r.data.card.name,draft.name);
 r=await call('GET',null,'',{id});assert.equal(r.code,200);const serialized=JSON.stringify(r.data);for(const value of ['secret@example.com','010-1234','private.test','비공개 정보','visibility','revision','pathname'])assert(!serialized.includes(value));assert.equal(r.data.card.bio,'공개 소개');
 r=await call('GET',null,'',{id,qr:'1'});assert.equal(r.headers['Content-Type'],'image/png');assert(r.buffer.length>1000);const before=r.buffer;
 r=await call('PUT',{...draft,revision:1,bio:'다른 기기에서 수정'},cookie());assert.equal(r.code,200);assert.equal(r.data.publicURL,url);assert.deepEqual((await call('GET',null,'',{id,qr:'1'})).buffer,before);assert.equal((await call('GET',null,'',{id})).data.card.bio,'다른 기기에서 수정');
 assert.equal((await call('GET',null,cookie('two'))).data.card,null);assert.equal((await call('PUT',draft,cookie())).code,409);
});
test('unpublished pages and hidden assets return 404; files keep their exact bytes and Wallet MIME, replacement and deletion persist',async()=>{
 let r=await call('POST',{action:'create'},cookie());let draft=r.data.card;const id=draft.publicId,url=r.data.publicURL;assert.equal((await call('GET',null,'',{id})).code,404);
 const buffer=pass(url);r=await adminCall('POST',{slot:'wallet',filename:'mine.pkpass',base64:buffer.toString('base64'),revision:0},cookie());assert.equal(r.code,200);assert.equal(r.data.warning,'');draft={...r.data.card,published:true};r=await call('PUT',draft,cookie());assert.equal(r.code,200);draft=r.data.card;
 r=await call('GET',null,'',{id,asset:'wallet'});assert.equal(r.headers['Content-Type'],'application/vnd.apple.pkpass');assert.deepEqual(r.buffer,buffer);
 const replacement=pass('https://different.test');r=await adminCall('POST',{slot:'wallet',filename:'next.pkpass',base64:replacement.toString('base64'),revision:draft.revision},cookie());assert.equal(r.code,200);assert(r.data.warning.includes('일치하지'));assert.equal(binary.size,1);assert.deepEqual((await call('GET',null,'',{id,asset:'wallet'})).buffer,replacement);
 draft={...r.data.card,visibility:{...r.data.card.visibility,wallet:false}};r=await adminCall('PATCH',{public:false,revision:draft.revision});assert.equal((await call('GET',null,'',{id,asset:'wallet'})).code,404);assert(!JSON.stringify((await call('GET',null,'',{id})).data).includes('wallet'));
 r=await adminCall('DELETE',{slot:'wallet',revision:r.data.card.revision},cookie());assert.equal(r.code,200);assert.equal(binary.size,0);assert(!r.data.card.assets.wallet);assert.equal((await call('GET',null,cookie(),{asset:'wallet'})).code,404);
});
test('rejects unsafe links, malformed input, CSRF, arbitrary storage paths and over-limit files',async()=>{
 let r=await call('POST',{action:'create'},cookie());const draft=r.data.card;
 for(const patch of [{links:[{title:'XSS',url:'javascript:alert(1)',public:true}]},{links:[{title:'credential',url:'https://user:pass@example.com',public:true}]},{theme:{...draft.theme,background:'red;url(x)'}},{order:['bio']},{name:''},{phone:'javascript:x'},{email:'bad'},{bio:'x'.repeat(2001)}]){r=await call('PUT',{...draft,...patch},cookie());assert.equal(r.code,400)}
 r=res();await handler({...req('PUT',draft,cookie()),headers:{...req().headers,cookie:cookie(),origin:'https://evil.test'}},r);assert.equal(r.code,403);
 r=await adminCall('POST',{slot:'wallet',filename:'fake.pkpass',base64:Buffer.from('fake').toString('base64'),revision:0},cookie());assert.equal(r.code,400);
 r=await call('POST',{slot:'profile',filename:'x.svg',base64:Buffer.from('<svg/>').toString('base64'),revision:0},cookie());assert.equal(r.code,400);
 assert.throws(()=>files.bytes(Buffer.alloc(files.LIMIT+1).toString('base64')),/INVALID_FILE/);
 assert.equal((await call('GET',null,cookie(),{asset:'../../secrets'})).code,404);
});
test('pkpass checks package files and hashes, rejects tampering; images decode and strip metadata',async()=>{
 const url='https://air.test/card.html?id='+crypto.randomUUID();await assert.rejects(files.validatePass(pass(url,f=>delete f.signature),url),/INVALID_PASS/);await assert.rejects(files.validatePass(pass(url,f=>f['pass.json']='{}'),url),/INVALID_PASS/);await assert.rejects(files.validatePass(zip({'pass.json':'{}'}),url),/INVALID_PASS/);
 const sharp=require('sharp'),source=await sharp({create:{width:1800,height:900,channels:3,background:'#9ab8ff'}}).jpeg().withMetadata().toBuffer();const prepared=await files.prepare('profile',source.toString('base64'),'photo.jpg',url);const info=await sharp(prepared.buffer).metadata();assert.equal(info.width,800);assert.equal(info.format,'webp');assert(!info.exif);assert.equal(prepared.contentType,'image/webp');
});
test('storage outage and migration fail closed without a successful save',async()=>{await call('POST',{action:'create'},cookie());unavailable=true;assert.equal((await call('GET',null,cookie())).code,503);unavailable=false;const draft=(await call('GET',null,cookie())).data.card;process.env.AIRSKY_MIGRATION_READ_ONLY='1';assert.equal((await call('PUT',draft,cookie())).code,503);assert.equal((await cards.read('one')).revision,0)});
test('management session signatures cannot be reused as administrator credentials or forged from administrator tokens',async()=>{const management=cookie();assert.equal(await access.identity(req('GET',null,management.replace('air_sky_cards=','air_sky_admin='))),null);assert.equal((await call('GET',null,'air_sky_cards='+s.session({id:'one',version:1}))).code,401)});

test('file storage read failures return a controlled error instead of escaping the route',async()=>{let r=await call('POST',{action:'create'},cookie());r=await adminCall('POST',{slot:'wallet',filename:'card.pkpass',base64:pass(r.data.publicURL).toString('base64'),revision:0},cookie());const original=files.get;files.get=async()=>{throw Error('file store unavailable')};try{r=await call('GET',null,cookie(),{asset:'wallet'});assert.equal(r.code,503);assert(r.data.error)}finally{files.get=original}});
test('Vercel rewrite dispatches cards through the existing function without changing the crew endpoint',async()=>{const config=require('../vercel.json'),route=config.routes.find(r=>r.src==='^/api/business-cards$');assert.equal(route.dest,'/api/crew-roster?businessCards=1');const r=res();await require('../api/crew-roster')(req('GET',null,cookie(),{businessCards:'1'}),r);assert.equal(r.code,200);assert.equal(r.data.card,null);assert(require('node:fs').readdirSync(require('node:path').join(__dirname,'../api')).filter(x=>x.endsWith('.js')).length<=12)});
test('introduction import uses only the authenticated public crew profile, preserves URL and excludes its hidden photo from public responses',async()=>{db.set('airsky:crew:roster',JSON.stringify({revision:0,members:[{id:'one',name:'첫 회원',active:true,owner:true,bio:'소개 페이지의 소개',photo:'assets/ant.jpg'},{id:'two',name:'두 번째',active:true,owner:false,bio:'다른 회원 비공개 수정 금지',photo:'assets/se7.jpg'}]}));let r=await call('POST',{action:'create'},cookie());const id=r.data.card.publicId;r=await call('POST',{action:'import-introduction',revision:0,id:'two'},cookie());assert.equal(r.code,200);assert.equal(r.data.card.bio,'소개 페이지의 소개');assert.equal(r.data.card.organization,'AIRSKY');assert.equal(r.data.card.role,'Team Owner');assert.equal(r.data.card.assets.profile.url,'/assets/ant.jpg');assert.equal(r.data.card.publicId,id);assert.equal((await call('GET',null,cookie('two'))).data.card,null);let draft={...r.data.card,published:true};r=await call('PUT',draft,cookie());assert.equal((await call('GET',null,'',{id})).data.card.profile,'/assets/ant.jpg');draft={...r.data.card,visibility:{...r.data.card.visibility,profile:false}};r=await call('PUT',draft,cookie());const publicData=(await call('GET',null,'',{id})).data.card;assert(!publicData.profile);assert(!JSON.stringify(publicData).includes('rosterPhoto'));r=await call('DELETE',{slot:'profile',revision:r.data.card.revision},cookie());assert(!r.data.card.assets.profile);assert.equal(r.data.card.rosterPhoto,'')});
test('introduction import rejects unmatched accounts instead of copying another person profile',async()=>{let r=await call('POST',{action:'create'},cookie());r=await call('POST',{action:'import-introduction',revision:0},cookie());assert.equal(r.code,404);assert.equal((await cards.read('one')).bio,'')});

test('Wallet configuration requires site administration, never a card session or public URL',async()=>{
 const created=await call('POST',{action:'create'},cookie());
 for(const method of ['POST','DELETE'])assert.equal((await call(method,{slot:'wallet',revision:0},cookie())).code,403);
 assert.equal((await call('PUT',{...created.data.card,visibility:{...created.data.card.visibility,wallet:false}},cookie())).code,403);
 for(const token of ['',cookie(),'air_sky_admin='+s.session({id:'one',version:1})]){const r=res();await require('../api/site-settings')(req('GET',null,token,{wallet:'1'}),r);assert.equal(r.code,token.startsWith('air_sky_admin')?403:401)}
 const r=await adminCall('GET');assert.equal(r.code,200);assert.equal(r.data.users.length,3);for(const secret of ['pinHash','pinSealed','bio','phone'])assert(!JSON.stringify(r.data).includes(secret));
 const record=JSON.parse(db.get('airsky:admin:accounts'));record.users[0].permissions=['site'];db.set('airsky:admin:accounts',JSON.stringify(record));const scoped=res();await require('../api/site-settings')(req('GET',null,'air_sky_admin='+s.session({id:'one',version:1}),{wallet:'1'}),scoped);assert.equal(scoped.code,200);
});

test('10MiB pass uploads keep exact bytes and reject even one extra byte',async()=>{
 const created=await call('POST',{action:'create'},cookie()),url=created.data.publicURL;
 const base=pass(url),bytes=pass(url,files=>{files['icon.png']=Buffer.alloc(10*1024*1024-base.length+67);const manifest=JSON.parse(files['manifest.json']);manifest['icon.png']=crypto.createHash('sha1').update(files['icon.png']).digest('hex');files['manifest.json']=JSON.stringify(manifest)});
 // Pad a valid ZIP using its optional archive comment to hit the exact boundary.
 const padding=10*1024*1024-bytes.length;assert(padding>=0&&padding<65536);bytes.writeUInt16LE(padding,bytes.length-2);const exact=Buffer.concat([bytes,Buffer.alloc(padding)]);
 assert.equal(exact.length,10*1024*1024);assert.deepEqual(files.bytes(exact.toString('base64')),exact);
 const init=await adminCall('POST',{action:'upload-init',revision:0,filename:'large.pkpass',size:exact.length});assert.equal(init.code,200);
 for(let start=0,index=0;start<exact.length;start+=init.data.chunkSize,index++){const part=await adminCall('POST',{action:'upload-part',uploadId:init.data.uploadId,index,revision:0,base64:exact.subarray(start,start+init.data.chunkSize).toString('base64')});assert.equal(part.code,200)}
 assert.equal(binary.size,0);let r=await adminCall('POST',{action:'upload-complete',uploadId:init.data.uploadId,revision:0});assert.equal(r.code,200);assert.deepEqual((await call('GET',null,cookie(),{asset:'wallet'})).buffer,exact);
 r=await adminCall('POST',{revision:r.data.card.revision,filename:'too-large.pkpass',base64:Buffer.concat([exact,Buffer.alloc(1)]).toString('base64')});assert.equal(r.code,400);assert.equal(binary.size,1);assert.deepEqual((await call('GET',null,cookie(),{asset:'wallet'})).buffer,exact);
});

test('staged uploads bind actor, card, slot and revision, reject invalid chunks and clear cancelled sessions',async()=>{
 await call('POST',{action:'create'},cookie());await call('POST',{action:'create'},cookie('two'));
 let r=await adminCall('POST',{action:'upload-init',revision:0,filename:'x.pkpass',size:files.LIMIT+1});assert.equal(r.code,400);
 const bytes=pass('https://example.com'),init=await adminCall('POST',{action:'upload-init',revision:0,filename:'x.pkpass',size:bytes.length}),id=init.data.uploadId;
 assert.equal((await adminCall('POST',{action:'upload-complete',uploadId:id,revision:0})).code,400);
 assert.equal((await adminCall('POST',{action:'upload-part',uploadId:id,revision:0,index:1,base64:bytes.toString('base64')})).code,400);
 assert.equal((await adminCall('POST',{action:'upload-part',uploadId:id,revision:0,index:0,base64:Buffer.from('bad').toString('base64')})).code,400);
 const record=JSON.parse(db.get('airsky:admin:accounts'));record.users[1].permissions=['site'];db.set('airsky:admin:accounts',JSON.stringify(record));
 for(const [userId,token] of [['two',s.session()],['one',s.session({id:'two',version:1})]]){const response=res();await require('../api/site-settings')(req('POST',{userId,action:'upload-part',uploadId:id,revision:0,index:0,base64:bytes.toString('base64')},'air_sky_admin='+token,{wallet:'1'}),response);assert.equal(response.code,400)}
 assert.equal((await adminCall('POST',{action:'upload-cancel',uploadId:id,revision:0})).code,200);assert.equal((await adminCall('POST',{action:'upload-complete',uploadId:id,revision:0})).code,400);assert.equal(binary.size,0);
});

test('expired staging records cannot be finalized and image upload stages use card authentication',async()=>{
 await call('POST',{action:'create'},cookie());
 const image=await require('sharp')({create:{width:32,height:32,channels:3,background:'#ffffff'}}).png().toBuffer();
 const init=await call('POST',{action:'upload-init',slot:'profile',revision:0,filename:'photo.png',size:image.length},cookie());assert.equal(init.code,200);
 let r=await call('POST',{action:'upload-part',uploadId:init.data.uploadId,slot:'profile',revision:0,index:0,base64:image.toString('base64')},cookie('two'));assert.equal(r.code,404);
 r=await call('POST',{action:'upload-part',uploadId:init.data.uploadId,slot:'cover',revision:0,index:0,base64:image.toString('base64')},cookie());assert.equal(r.code,400);
 const key=[...db.keys()].find(x=>x.endsWith(init.data.uploadId));db.delete(key);
 r=await call('POST',{action:'upload-complete',uploadId:init.data.uploadId,slot:'profile',revision:0},cookie());assert.equal(r.code,400);assert.equal(binary.size,0);
});
