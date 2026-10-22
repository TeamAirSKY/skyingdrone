const s=require('./server'),access=require('./admin-access'),cards=require('./business-cards'),files=require('./card-files');
const publicURL=require('./business-card-api').publicURL;
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 if(req.method!=='GET'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 if(!await access.requireAccess(req,res,'site'))return;
 try{
 const accounts=await access.read(),users=[{id:'owner',name:'ANT'},...accounts.users.filter(x=>x.active&&x.id!=='owner')];
 const data=s.body(req),userId=req.method==='GET'?req.query?.userId:data?.userId;
 if(req.method==='GET'&&!userId){const list=await Promise.all(users.map(async user=>{const c=await cards.read(user.id);return {id:user.id,name:user.name,hasCard:!!c,...(c?{revision:c.revision,published:c.published,publicURL:publicURL(c.publicId),hasWallet:!!c.assets.wallet,publicEnabled:c.visibility.wallet,filename:c.assets.wallet?.name||'',size:c.assets.wallet?.size||0,downloadURL:'/api/site-settings?wallet=1&userId='+encodeURIComponent(user.id)+'&download=1'}:{})}}));return s.send(res,200,{users:list})}
 if(!users.some(x=>x.id===userId))return s.send(res,404,{error:'사용자를 찾을 수 없습니다.'});
 const card=await cards.read(userId);if(!card)return s.send(res,404,{error:'해당 사용자가 먼저 명함을 만들어야 합니다.'});
 if(req.method==='GET'){if(req.query.download!=='1'||!card.assets.wallet)return s.send(res,404,{error:'패스 파일이 없습니다.'});const bytes=await files.get(card.assets.wallet);if(!bytes)return s.send(res,404,{error:'패스 파일이 없습니다.'});res.setHeader('Content-Type','application/vnd.apple.pkpass');res.setHeader('Content-Disposition','inline; filename="business-card.pkpass"');return res.status(200).end(bytes)}
 if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1')throw Error('MIGRATION_READ_ONLY');
 if(await s.limited(req,'admin-card-wallet:'+req.adminIdentity.id,80,900))return s.send(res,429,{error:'잠시 후 다시 시도해주세요.'});
 if(!Number.isSafeInteger(data.revision))return s.send(res,400,{error:'명함 목록을 새로고침해주세요.'});
 if(card.revision!==data.revision)throw Error('CARD_CONFLICT');
 let warning='';
 if(req.method==='PATCH'){if(typeof data.public!=='boolean')return s.send(res,400,{error:'공개 설정을 확인해주세요.'});await cards.update(userId,data.revision,c=>({visibility:{...c.visibility,wallet:data.public}}))}
 if(req.method==='DELETE'){await cards.update(userId,data.revision,c=>{const assets={...c.assets};delete assets.wallet;return {assets}});await files.remove(card.assets.wallet).catch(()=>{})}
 if(req.method==='POST'){const prepared=await files.prepare('wallet',data.base64,data.filename,publicURL(card.publicId)),file=await files.put(card.publicId,'wallet',prepared);try{await cards.update(userId,data.revision,c=>({assets:{...c.assets,wallet:file}}))}catch(error){await files.remove(file).catch(()=>{});throw error}await files.remove(card.assets.wallet).catch(()=>{});warning=prepared.warning||''}
 return s.send(res,200,{ok:true,warning});
 }catch(error){const code=error.message==='CARD_CONFLICT'?409:/^INVALID_/.test(error.message)?400:503;return s.send(res,code,{error:code===409?'다른 변경이 먼저 반영됐습니다. 새로고침해주세요.':code===400?'3MB 이하의 올바른 서명된 .pkpass 파일인지 확인해주세요.':'패스 설정을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'})}
};
