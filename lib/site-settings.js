const s=require('./server');
const KEY='airsky:site:settings';
const defaults={revision:0,filmingOpen:true,crewOpen:true,filmingMessage:'현재 촬영 신청을 쉬고 있습니다. 다시 열리면 신청해주세요.',crewMessage:'현재 크루 모집을 쉬고 있습니다. 다시 열리면 지원해주세요.'};
async function read(){const raw=await s.redis(['GET',KEY]);return raw?{...defaults,...JSON.parse(raw)}:{...defaults}}
function validate(data){
 if(!data||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.filmingOpen!=='boolean'||typeof data.crewOpen!=='boolean')return {error:'운영 설정을 확인해주세요.'};
 for(const key of ['filmingMessage','crewMessage'])if(typeof data[key]!=='string'||data[key].trim().length>300)return {error:'안내 문구는 300자 이내로 입력해주세요.'};
 return {value:{filmingOpen:data.filmingOpen,crewOpen:data.crewOpen,filmingMessage:data.filmingMessage.trim()||defaults.filmingMessage,crewMessage:data.crewMessage.trim()||defaults.crewMessage}};
}
module.exports={KEY,defaults,read,validate};
