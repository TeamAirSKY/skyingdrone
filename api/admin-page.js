const fs=require('node:fs'),path=require('node:path'),s=require('../lib/server'),audit=require('../lib/admin-audit');
module.exports=async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD')return s.send(res,405,{error:'허용되지 않는 요청입니다.'});
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
 let saved=false;
 if(req.method==='GET'&&s.configured()&&s.sessionConfigured()){
 try{
 if(await s.limited(req,'admin-page',30,60)){res.setHeader('Retry-After','60');return res.status(429).send('접속 요청이 많습니다. 잠시 후 다시 시도해주세요.')}
 await audit.append(req,res,'visit');saved=true;
 }catch{saved=false}
 }
 try{const html=fs.readFileSync(path.join(process.cwd(),'admin.html'),'utf8').replace('<body>',`<body data-audit-saved="${saved}">`);return res.status(200).send(req.method==='HEAD'?'':html)}catch{return res.status(500).send('관리자 페이지를 불러올 수 없습니다.')}
};
