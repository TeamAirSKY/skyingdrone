const s=require('../lib/server');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 const secret=process.env.CRON_SECRET;
 if(!secret||!s.safeEqual(String(req.headers.authorization||''),'Bearer '+secret))return s.send(res,401,{error:'UNAUTHORIZED'});
 try{return s.send(res,200,{ok:true,removed:await require('../lib/blob-storage').cleanup()});}
 catch{return s.send(res,503,{error:'STORAGE_UNAVAILABLE'});}
};
