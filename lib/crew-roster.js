const s=require('./server'),defaults=require('./default-crew.json');
const catalog=require('../assets/drone-catalog.json');
const KEY='airsky:crew:roster';
async function read(){const raw=await s.redis(['GET',KEY]);return raw?JSON.parse(raw):{revision:0,members:structuredClone(defaults)}}
function validPhoto(value){if(value==='')return true;if(/^assets\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png|webp|svg|gif)$/i.test(value)&&!value.includes('..'))return true;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&value.length<=500}catch{return false}}
function validate(data){
 if(!data||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.members)||data.members.length>100)return {error:'크루 목록을 확인해주세요. 최대 100명까지 등록할 수 있습니다.'};
 const ids=new Set(),members=[];
 for(const member of data.members){
  if(!member||typeof member.id!=='string'||! /^[a-z0-9][a-z0-9_-]{0,63}$/.test(member.id)||ids.has(member.id))return {error:'크루 식별값이 올바르지 않거나 중복됐습니다.'};ids.add(member.id);
  const name=typeof member.name==='string'?member.name.trim():'',bio=typeof member.bio==='string'?member.bio.trim():'';
  if(!name||name.length>30||bio.length>2000||typeof member.photo!=='string'||!validPhoto(member.photo))return {error:'이름(1~30자), 소개(2,000자 이내), 사진 주소(https 또는 assets 경로)를 확인해주세요.'};
  if(!['','filming','planning','editing'].includes(member.department)||['owner','coOwner','leader','active'].some(key=>typeof member[key]!=='boolean')||member.owner&&member.coOwner||member.leader&&!member.department)return {error:'부서·역할을 확인해주세요. 팀장은 부서 선택이 필요합니다.'};
  if(!Array.isArray(member.equipment)||member.equipment.some(x=>!Object.hasOwn(catalog,x)))return {error:'기체 선택을 확인해주세요.'};
  if(member.active&&!member.owner&&!member.coOwner&&!member.department)return {error:'공개할 크루는 부서 또는 오너 역할을 선택해주세요.'};
  members.push({id:member.id,name,bio,photo:member.photo,owner:member.owner,coOwner:member.coOwner,department:member.department,leader:member.leader,equipment:[...new Set(member.equipment)],active:member.active});
 }
 return {value:members};
}
module.exports={KEY,read,validate,defaults};
