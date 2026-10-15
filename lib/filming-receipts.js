const crypto=require('node:crypto'),s=require('./server');
const KEY='airsky:filming:numbers',TTL=15552000000;
function hash(id,pin){return crypto.createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update('filming-receipt:'+id+':'+pin).digest('hex')}
async function reserve(id,expiresAt=Date.now()+TTL){if(!Number.isFinite(expiresAt))expiresAt=Date.now()+TTL;let number;await s.upsertRecord(KEY,{slots:{}},current=>{const slots={...current.slots};for(const [n,slot] of Object.entries(slots))if(slot.expiresAt<=Date.now())delete slots[n];const existing=Object.entries(slots).find(([,slot])=>slot.id===id);if(existing){number=Number(existing[0]);slots[number]={id,expiresAt};return {slots}}number=1;while(slots[number])number++;slots[number]={id,expiresAt};return {slots}});return number}
async function release(id){await s.upsertRecord(KEY,{slots:{}},current=>({slots:Object.fromEntries(Object.entries(current.slots).filter(([,slot])=>slot.id!==id))}))}
async function find(number){const raw=await s.redis(['GET',KEY]);if(!raw)return null;const slot=JSON.parse(raw).slots[number];return slot&&slot.expiresAt>Date.now()?slot.id:null}
function clean(record){const {receiptPinHash,...safe}=record;return {...safe,receiptProtected:Boolean(receiptPinHash)}}
module.exports={reserve,release,find,hash,clean};
