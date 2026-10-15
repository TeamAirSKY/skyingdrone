// Run with: node tests/browser-certificate.cjs (requires Playwright and Chromium).
const {chromium}=require('playwright'),assert=require('node:assert/strict'),crypto=require('node:crypto'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
process.env.ADMIN_PIN=String(crypto.randomInt(100000,1000000));process.env.ADMIN_SESSION_SECRET=crypto.randomBytes(32).toString('hex');process.env.KV_REST_API_URL='https://test-redis.example';process.env.KV_REST_API_TOKEN='test-only';delete process.env.BLOB_READ_WRITE_TOKEN;delete process.env.BLOB_STORE_ID;
const db=new Map(),calls=[];
global.fetch=async(_url,options)=>{const [op,key,...args]=JSON.parse(options.body);let result;
 if(op==='GET')result=db.get(key)||null;
 else if(op==='SET'){db.set(key,args[0]);result='OK'}
 else if(op==='INCR'){result=(db.get(key)||0)+1;db.set(key,result)}
 else if(op==='EXPIRE')result=1;
 else if(op==='LPUSH'){const list=db.get(key)||[];list.unshift(args[0]);db.set(key,list);result=list.length}
 else if(op==='LRANGE')result=(db.get(key)||[]).slice(args[0],args[1]+1);
 else throw Error('Unexpected storage command: '+op);
 return {ok:true,json:async()=>({result})};
};
const handler=require('../api/admin-session'),root=path.resolve(__dirname,'..');
const server=http.createServer(async(req,res)=>{res.status=n=>{res.statusCode=n;return res};res.json=data=>res.end(JSON.stringify(data));
 if(req.url==='/api/admin-session'){let body='';for await(const chunk of req)body+=chunk;req.body=body?JSON.parse(body):{};req.query={};calls.push(req.body.step);return handler(req,res)}
 try{const file=path.join(root,req.url.split('?')[0]);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://localhost:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const mode of ['mouse','touch']){
 db.clear();const access=require('../lib/admin-access'),old=mode==='mouse'?process.env.ADMIN_PIN:'002222',next=mode==='mouse'?'001111':'003333';
 if(mode==='touch')db.set('airsky:admin:accounts',JSON.stringify({revision:0,users:[{id:'member',name:'회원',pinHash:access.hash(old),version:1,active:true,permissions:['crew']}]}));
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:mode==='touch'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/passkey.html?from=admin');
 await page.evaluate(async()=>{await fetch('/api/admin-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'certificate',step:'begin'})})});
 for(const digit of old){const key=page.locator('#lk button[data-v="'+digit+'"]');if(mode==='touch')await key.tap();else await key.click()}
 await page.locator('#lock.gone').waitFor({state:'attached'});assert.equal(await page.locator('.info h2').textContent(),mode==='mouse'?'ANT':'회원');await page.locator('#mini').click();
 if(mode==='touch')await page.locator('#manage-certificate').tap();else await page.locator('#manage-certificate').click();
 await page.locator('#certificate-management').waitFor({state:'visible'});assert.equal(await page.locator('#certificate-management input').count(),3);assert.equal(await page.locator('#certificate-management a').count(),0);
 await page.locator('#certificate-current-pin').fill(old);await page.locator('#certificate-new-pin').fill(next);await page.locator('#certificate-confirm-pin').fill('009999');await page.locator('#save-certificate-pin').click();await page.getByText('새 비밀번호와 확인이 같지 않습니다.',{exact:true}).waitFor();
 await page.locator('#certificate-confirm-pin').fill(next);await page.locator('#save-certificate-pin').click();await page.getByText('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요.',{exact:true}).waitFor();
 assert.equal(await access.authenticate(old),null);assert(await access.authenticate(next));assert.equal(await page.locator('#certificate-current-pin').inputValue(),'');
 await page.locator('#close-certificate-management').click();await page.locator('.foot').click();await page.locator('#auth-complete').waitFor({state:'visible'});assert(!(await context.cookies()).some(x=>x.name==='air_sky_admin'));await page.locator('#go-admin').click();await page.waitForURL('**/admin.html');assert((await context.cookies()).some(x=>x.name==='air_sky_admin'));assert.deepEqual(errors,[]);await context.close();
 const records=db.get('airsky:admin:audit').map(JSON.parse);assert.equal(records.filter(x=>x.event==='certificate_success').length,1);console.log('PASS '+mode+': keypad → manage → validate PIN → change stored credential → authenticate → admin session');
 }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exitCode=1});
