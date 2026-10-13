const s=require('../lib/server'),settings=require('../lib/site-settings');
module.exports=async(req,res)=>{if(req.method!=='GET')return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});try{const {filmingOpen,crewOpen,filmingMessage,crewMessage}=await settings.read();return s.send(res,200,{filmingOpen,crewOpen,filmingMessage,crewMessage})}catch{return s.send(res,503,{error:'접수 안내를 확인할 수 없습니다.'})}};
