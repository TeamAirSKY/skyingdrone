const s=require('./server'),cards=require('./business-cards'),auth=require('./card-auth'),files=require('./card-files');
const publicURL=id=>(process.env.BUSINESS_CARD_ORIGIN||'https://skying-drone.kro.kr').replace(/\/$/,'')+'/card.html?id='+id;
function result(card){return {card:cards.managerView(card),publicURL:publicURL(card.publicId)}}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','POST','PUT','DELETE'].includes(req.method))return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 const query=req.query||{},data=s.body(req);
 if(req.method!=='GET'&&!s.sameOrigin(req))return s.send(res,403,{error:'요청 출처를 확인할 수 없습니다.'});
 try{
  if(req.method==='GET'&&query.id){
   const card=await cards.publicCard(query.id);if(!card)return s.send(res,404,{error:'공개된 명함을 찾을 수 없습니다.'});
   if(query.asset)return await serveAsset(req,res,card,query.asset,true);
   if(query.qr==='1')return await serveQR(res,card.publicId);
   return s.send(res,200,{card:cards.publicView(card),publicURL:publicURL(card.publicId)});
  }
  if(req.method==='DELETE'&&data?.action==='session'){auth.clear(res);return s.send(res,200,{ok:true})}
  const user=req.method==='POST'&&data?.action==='session'?(await auth.identity(req)||await auth.exchange(req,res)):await auth.identity(req);
  if(!user)return s.send(res,401,{error:'본인의 인증서 비밀번호로 인증해주세요.'});
  if(req.method==='POST'&&data?.action==='session')return s.send(res,200,{ok:true});
  const card=await cards.read(user.id);
  if(req.method==='GET'){
   if(query.asset){if(!card)return s.send(res,404,{error:'명함이 없습니다.'});return await serveAsset(req,res,card,query.asset,false)}
   if(query.qr==='1'){if(!card)return s.send(res,404,{error:'명함이 없습니다.'});return await serveQR(res,card.publicId)}
   return s.send(res,200,card?result(card):{card:null});
  }
  if(await s.limited(req,'business-card-edit:'+user.id,80,900))return s.send(res,429,{error:'저장 요청이 많습니다. 잠시 후 다시 시도해주세요.'});
  if(req.method==='POST'&&data?.action==='create')return s.send(res,200,result(await cards.create(user)));
  if(!card)return s.send(res,404,{error:'명함을 먼저 만들어주세요.'});
  if(req.method==='POST'&&data?.action==='import-introduction'){const source=await cards.introduction(user);if(!source)return s.send(res,404,{error:'본인과 일치하는 공개 소개 프로필을 찾지 못했습니다.'});const saved=await cards.update(user.id,data.revision,()=>source);return s.send(res,200,result(saved))}
  if(req.method==='PUT'){let value;try{value=cards.validate(data)}catch{return s.send(res,400,{error:'필수 이름, 연락처, 링크 주소와 입력 길이를 확인해주세요.'})}if(value.published)await s.redis(['SET','airsky:card:public:'+card.publicId,user.id]);const saved=await cards.update(user.id,data.revision,()=>value);return s.send(res,200,result(saved))}
  const slot=data?.slot;
  if(!['profile','cover','wallet'].includes(slot)||!Number.isSafeInteger(data.revision))return s.send(res,400,{error:'업로드 항목을 확인해주세요.'});
  if(req.method==='DELETE'){
   const saved=await cards.update(user.id,data.revision,current=>{const assets={...current.assets};delete assets[slot];return {assets,...(slot==='profile'?{rosterPhoto:''}:{})}});
   // The pointer is removed before the bytes. A delayed purge cannot make a deleted file public.
   await files.remove(card.assets[slot]).catch(()=>{});return s.send(res,200,result(saved));
  }
  if(req.method==='POST'){
   if(data.revision!==card.revision)throw Error('CARD_CONFLICT');
   const prepared=await files.prepare(slot,data.base64,data.filename,publicURL(card.publicId));
   if(process.env.AIRSKY_MIGRATION_READ_ONLY==='1')throw Error('MIGRATION_READ_ONLY');
   const file=await files.put(card.publicId,slot,prepared);let saved;
   try{saved=await cards.update(user.id,data.revision,current=>({assets:{...current.assets,[slot]:file},...(slot==='profile'?{rosterPhoto:''}:{})}))}catch(error){await files.remove(file).catch(()=>{});throw error}
   await files.remove(card.assets[slot]).catch(()=>{});return s.send(res,200,{...result(saved),warning:prepared.warning||''});
  }
  return s.send(res,400,{error:'요청을 확인해주세요.'});
 }catch(error){
  const code=error.message==='CARD_CONFLICT'?409:/^INVALID_/.test(error.message)?400:503;
  const message=code===409?'다른 기기에서 먼저 변경했습니다. 새로 불러온 뒤 다시 수정해주세요.':error.message==='INVALID_PASS'?'올바른 .pkpass 파일인지 확인해주세요. 필수 파일·매니페스트 검사에 통과하지 못했습니다.':error.message==='INVALID_IMAGE'?'JPG, PNG, WebP 사진만 업로드할 수 있습니다. 사진을 확인해주세요.':error.message==='INVALID_FILE'?'파일은 2MB 이하로 올려주세요.':error.message==='MIGRATION_READ_ONLY'?'서버 이전 중입니다. 잠시 후 다시 시도해주세요.':'명함 저장소를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
  return s.send(res,code,{error:message});
 }
};
async function serveQR(res,id){const buffer=await require('qrcode').toBuffer(publicURL(id),{type:'png',width:420,margin:4,errorCorrectionLevel:'M'});res.setHeader('Content-Type','image/png');return res.status(200).end(buffer)}
async function serveAsset(req,res,card,slot,isPublic){
 if(!['profile','cover','wallet'].includes(slot)||isPublic&&!card.visibility[slot]||!card.assets[slot])return s.send(res,404,{error:'파일을 찾을 수 없습니다.'});
 const file=card.assets[slot],buffer=await files.get(file);if(!buffer)return s.send(res,404,{error:'파일을 찾을 수 없습니다.'});
 res.setHeader('Content-Type',file.contentType);res.setHeader('Content-Length',buffer.length);res.setHeader('Content-Disposition',`inline; filename="${slot==='wallet'?'business-card.pkpass':slot+'.webp'}"`);return res.status(200).end(buffer);
}
module.exports.publicURL=publicURL;
