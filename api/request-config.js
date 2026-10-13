const s=require('../lib/server'),captcha=require('../lib/recaptcha');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 try{const settings=await require('../lib/site-settings').read();return s.send(res,200,{...captcha.settings(),open:settings.filmingOpen,message:settings.filmingMessage});}catch{return s.send(res,503,{error:'접수 설정을 확인할 수 없습니다.'})}
};
