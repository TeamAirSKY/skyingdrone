function settings(){
 const siteKey=process.env.RECAPTCHA_SITE_KEY||'',secret=process.env.RECAPTCHA_SECRET_KEY||'';
 return {required:Boolean(siteKey||secret),ready:Boolean(siteKey&&secret),siteKey:secret?siteKey:''};
}
async function verify(token,hostname){
 const config=settings();
 if(!config.required)return {ok:true};
 if(!config.ready)return {ok:false,status:503,error:'신청 인증 설정을 준비 중입니다. 잠시 후 다시 시도해주세요.'};
 if(typeof token!=='string'||token.length<1||token.length>4096)return {ok:false,status:400,error:'로봇이 아닙니다 인증을 완료해주세요.'};
 try{
  const response=await fetch('https://www.google.com/recaptcha/api/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:process.env.RECAPTCHA_SECRET_KEY,response:token}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('VERIFICATION_UNAVAILABLE');
  const result=await response.json(),age=Date.now()-Date.parse(result.challenge_ts);
  if(!result.success||result.hostname!==hostname||!Number.isFinite(age)||age< -30000||age>180000)return {ok:false,status:400,error:'인증이 만료되었거나 유효하지 않습니다. 다시 인증해주세요.'};
  return {ok:true};
 }catch{return {ok:false,status:503,error:'인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'};}
}
module.exports={settings,verify};
