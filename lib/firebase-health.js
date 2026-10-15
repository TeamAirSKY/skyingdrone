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
 }catch(error){const code=String(error.code||'UNKNOWN');console.error('FIREBASE_HEALTH_FAILED',/^[a-zA-Z0-9/_.-]+$/.test(code)?code:'UNKNOWN');const reason=classify(error);console.error('FIREBASE_HEALTH_REASON',reason);return s.send(res,503,{ok:false,error:'FIREBASE_CONNECTION_FAILED',reason})}
};

function classify(error){const text=String(error.message||'')+' '+String(error.details||'');if(/SERVICE_DISABLED|has not been used|it is disabled|API.*disabled/i.test(text))return 'FIRESTORE_API_DISABLED';if(/database.*does not exist|database.*not found/i.test(text))return 'FIRESTORE_DATABASE_MISSING';if(/insufficient permissions|permission.denied|not authorized/i.test(text)||Number(error.code)===7)return 'FIRESTORE_PERMISSION_DENIED';if(Number(error.code)===16)return 'FIRESTORE_CREDENTIAL_REJECTED';return 'FIRESTORE_UNAVAILABLE'}
