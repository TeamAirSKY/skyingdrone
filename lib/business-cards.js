const crypto=require('node:crypto'),s=require('./server');
const fields=['organization','role','bio','phone','email'];
const order=['organization','role','bio','phone','email','links','extras'];
const key=id=>'airsky:card:user:'+id;
const index=id=>'airsky:card:public:'+id;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
function defaults(user){return {publicId:crypto.randomUUID(),revision:0,published:false,name:user.name,organization:'',role:'',bio:'',phone:'',email:'',links:[],extras:[],visibility:Object.fromEntries([...fields,'profile','cover','wallet'].map(x=>[x,true])),theme:{background:'#0b0c18',accent:'#9ab8ff',text:'#f2f4ff',profileX:50,profileY:50,coverX:50,coverY:50,photoAlign:'center'},order:[...order],assets:{}}}
async function read(userId){const raw=await s.redis(['GET',key(userId)]);return raw?JSON.parse(raw):null}
async function create(user){const result=await s.upsertRecord(key(user.id),defaults(user),current=>current);await s.redis(['SET',index(result.publicId),user.id]);return result}
function text(value,max,required=false){if(typeof value!=='string'||value.trim().length>max||required&&!value.trim())throw Error('INVALID_CARD');return value.trim()}
function validate(data){
 if(!data||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.published!=='boolean')throw Error('INVALID_CARD');
 const value={name:text(data.name,60,true),published:data.published};
 for(const f of fields)value[f]=text(data[f],f==='bio'?2000:f==='phone'?40:150);
 if(value.phone&&!/^\+?[0-9() .-]{3,40}$/.test(value.phone)||value.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))throw Error('INVALID_CARD');
 for(const group of ['links','extras']){
  if(!Array.isArray(data[group])||data[group].length>20)throw Error('INVALID_CARD');
  value[group]=data[group].map(item=>{if(!item||typeof item.public!=='boolean')throw Error('INVALID_CARD');const row={title:text(item.title,80,true),public:item.public};if(group==='links'){const url=new URL(text(item.url,2048,true));if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('INVALID_CARD');row.url=url.href}else row.content=text(item.content,2000,true);return row});
 }
 if(!data.visibility||[...fields,'profile','cover','wallet'].some(f=>typeof data.visibility[f]!=='boolean'))throw Error('INVALID_CARD');
 value.visibility=Object.fromEntries([...fields,'profile','cover','wallet'].map(f=>[f,data.visibility[f]]));
 if(!data.theme||['background','accent','text'].some(f=>!/^#[0-9a-f]{6}$/i.test(data.theme[f])))throw Error('INVALID_CARD');
 value.theme=Object.fromEntries(['background','accent','text'].map(f=>[f,data.theme[f]]));
 for(const f of ['profileX','profileY','coverX','coverY']){if(!Number.isFinite(data.theme[f])||data.theme[f]<0||data.theme[f]>100)throw Error('INVALID_CARD');value.theme[f]=data.theme[f]}
 if(!['left','center','right'].includes(data.theme.photoAlign))throw Error('INVALID_CARD');value.theme.photoAlign=data.theme.photoAlign;
 if(!Array.isArray(data.order)||data.order.length!==order.length||new Set(data.order).size!==order.length||data.order.some(f=>!order.includes(f)))throw Error('INVALID_CARD');value.order=[...data.order];return value;
}
async function update(userId,revision,change){return s.upsertRecord(key(userId),null,current=>{if(!current)throw Error('CARD_NOT_FOUND');if(current.revision!==revision)throw Error('CARD_CONFLICT');return {...current,...change(current),revision:current.revision+1}})}
function assetURL(card,slot){return '/api/business-cards?id='+encodeURIComponent(card.publicId)+'&asset='+slot}
function publicView(card){
 const result={publicId:card.publicId,name:card.name,theme:card.theme,order:card.order,links:card.links.filter(x=>x.public).map(({title,url})=>({title,url})),extras:card.extras.filter(x=>x.public).map(({title,content})=>({title,content}))};
 for(const f of fields)if(card.visibility[f]&&card[f])result[f]=card[f];
 for(const slot of ['profile','cover','wallet'])if(card.visibility[slot]&&card.assets[slot])result[slot]=assetURL(card,slot);
 return result;
}
async function publicCard(id){if(!uuid(id))return null;const userId=await s.redis(['GET',index(id)]);if(!userId)return null;const card=await read(userId);if(!card?.published||card.publicId!==id)return null;const accounts=await require('./admin-access').read();if(userId!=='owner'&&!accounts.users.some(u=>u.id===userId&&u.active))return null;return card}
function managerView(card){const {assets,...data}=card;return {...data,assets:Object.fromEntries(Object.entries(assets).map(([slot,file])=>[slot,{name:file.name,size:file.size,url:'/api/business-cards?asset='+slot+'&revision='+card.revision}]))}}
module.exports={defaults,read,create,validate,update,publicView,publicCard,managerView,uuid};
