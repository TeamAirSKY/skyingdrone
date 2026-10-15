// Run with: node tests/browser-history.cjs (requires Playwright and Chromium).
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{try{const file=path.join(root,req.url.split('?')[0]);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,r));browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const touch of [false,true]){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:touch,isMobile:touch}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/admin-session',async route=>{const data=route.request().postDataJSON();if(data.step==='history'){await new Promise(r=>setTimeout(r,700));return route.fulfill({json:{logs:[{createdAt:'2026-10-15T10:00:00Z'}],nextOffset:null}})}return route.fulfill({json:{ok:true,admin:false,certificate:{name:'Se7',role:'OWNER'}}})});
 await page.goto('http://localhost:'+server.address().port+'/passkey.html');for(const n of '123456')await page.locator('#lk [data-v="'+n+'"]').click();await page.locator('#lock.gone').waitFor({state:'attached'});await page.locator('#mini').click();await page.locator('#ov.open').waitFor({state:'visible'});
 const press=async selector=>{if(touch)await page.locator(selector).tap();else await page.locator(selector).click()};
 await press('.foot');await page.locator('#hist[open]').waitFor({state:'visible'});assert.match(await page.locator('#hist ul').textContent(),/불러오는 중/);await press('#hx');await press('.foot');await page.getByText('관리자 페이지 멤버카드 인증',{exact:true}).waitFor({state:'visible'});
 for(let i=0;i<6;i++){await press('#hx');await press('.foot');assert.equal(await page.locator('#hist').evaluate(e=>e.open),true)}
 assert.equal(await page.evaluate(()=>visualViewport.scale),1);assert.equal(await page.locator('.foot').evaluate(e=>getComputedStyle(e).touchAction),'manipulation');assert.deepEqual(errors,[]);await context.close();console.log('PASS '+(touch?'touch':'mouse')+': immediate loading, close/reopen during fetch, repeated history taps, no zoom or browser errors');
 }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exitCode=1});
