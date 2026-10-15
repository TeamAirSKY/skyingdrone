// Connectivity only: never returns credentials or member data and never writes.
const s=require('./server'),storage=require('./firestore-storage');
let cached=null,expires=0;
module.exports=async(req,res)=>{
 if(req.method!=='GET')return s.send(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(!storage.configured())return s.send(res,503,{ok:false,error:'FIREBASE_NOT_CONFIGURED'});
 if(cached&&Date.now()<expires)return s.send(res,200,cached);
 try{
  const marker=await storage.database().doc('airsky_meta/migration').get();
  cached={ok:true,firebase:true,migrationReady:marker.exists&&marker.data().status==='verified'&&marker.data().schema===1};expires=Date.now()+60000;
  return s.send(res,200,cached);
 }catch(error){const code=String(error.code||'UNKNOWN');console.error('FIREBASE_HEALTH_FAILED',/^[a-zA-Z0-9/_.-]+$/.test(code)?code:'UNKNOWN');return s.send(res,503,{ok:false,error:'FIREBASE_CONNECTION_FAILED'})}
};
