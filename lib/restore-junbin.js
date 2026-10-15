// One-time, additive roster repair. The marker preserves later admin edits/deletions.
let pending;
async function apply(db){
 const marker=db.doc('airsky_meta/restore-junbin-20261015');
 const roster=db.doc('airsky_records/'+Buffer.from('airsky:crew:roster').toString('base64url'));
 await db.runTransaction(async tx=>{
  if((await tx.get(marker)).exists)return;
  const ready=await tx.get(db.doc('airsky_meta/migration'));
  if(!ready.exists||ready.data().status!=='verified'||ready.data().schema!==1)throw Error('FIRESTORE_MIGRATION_NOT_VERIFIED');
  const snapshot=await tx.get(roster);
  const record=snapshot.exists?snapshot.data():{key:'airsky:crew:roster',value:JSON.stringify({revision:0,members:require('./default-crew.json')}),expiresAt:null},current=JSON.parse(record.value);
  if(!snapshot.exists)tx.create(roster,record);
  if(!Array.isArray(current.members)||!Number.isSafeInteger(current.revision))throw Error('INVALID_CREW_ROSTER');
  if(!current.members.some(x=>x.id==='junbin'||['이준빈','준빈'].includes(x.name?.trim()))){
   const member=require('./default-crew.json').find(x=>x.id==='junbin');
   if(!member)throw Error('JUNBIN_PROFILE_MISSING');
   tx.update(roster,{value:JSON.stringify({...current,revision:current.revision+1,members:[...current.members,member]})});
  }
  tx.create(marker,{appliedAt:new Date().toISOString()});
 });
}
module.exports=function(){if(!pending)pending=apply(require('./firestore-storage').database()).catch(error=>{pending=null;throw error});return pending};
module.exports.apply=apply;
