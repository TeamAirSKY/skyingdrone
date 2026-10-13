const s=require('../lib/server'),captcha=require('../lib/recaptcha');
module.exports=(req,res)=>{
 if(req.method!=='GET')return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 return s.send(res,200,captcha.settings());
};
