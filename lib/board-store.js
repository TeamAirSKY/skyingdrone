const crypto=require('node:crypto');
function createStore(db){
 async function ready(){const marker=await db.doc('airsky_meta/migration').get();if(!marker.exists||marker.data().status!=='verified'||marker.data().schema!==1)throw Error('STORAGE_NOT_READY')}
 const collection=board=>db.collection('airsky_boards').doc(board).collection('posts');
 return {
 async list(board,cursor){await ready();let query=collection(board).orderBy('sortKey');if(cursor)query=query.startAfter(cursor);const page=await query.limit(21).get(),docs=page.docs.slice(0,20);return {posts:docs.map(d=>({id:d.id,...d.data()})),nextCursor:page.size>20?docs.at(-1).data().sortKey:null}},
 async get(board,id){await ready();const doc=await collection(board).doc(id).get();return doc.exists?{id:doc.id,...doc.data()}:null},
 async create(board,fields,user){await ready();const id=crypto.randomUUID(),now=new Date().toISOString(),post={...fields,authorId:user.id,authorName:user.name,createdAt:now,updatedAt:now,revision:1,sortKey:String(9999999999999-Date.now()).padStart(13,'0')+'-'+id};await collection(board).doc(id).create(post);return {id,...post}},
 async change(board,id,revision,fields,user,remove){await ready();const ref=collection(board).doc(id);return db.runTransaction(async tx=>{const snapshot=await tx.get(ref);if(!snapshot.exists)throw Error('POST_NOT_FOUND');const old=snapshot.data();if(!user.owner&&old.authorId!==user.id)throw Error('POST_FORBIDDEN');if(old.revision!==revision)throw Error('POST_CONFLICT');if(remove){tx.delete(ref);return null}const value={...old,...fields,revision:old.revision+1,updatedAt:new Date().toISOString()};tx.set(ref,value);return {id,...value}})}
 };
}
let instance;module.exports={createStore,get(){if(!instance)instance=createStore(require('./firestore-storage').database());return instance}};
