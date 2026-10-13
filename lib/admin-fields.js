function validate(data){
 const patch={};
 if(Object.hasOwn(data,'adminNote')){if(typeof data.adminNote!=='string'||data.adminNote.length>2000)return {error:'관리자 메모는 2,000자 이내로 입력해주세요.'};patch.adminNote=data.adminNote.trim()}
 if(Object.hasOwn(data,'scheduledDate')){const date=data.scheduledDate;if(typeof date!=='string'||(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)))return {error:'예정일을 확인해주세요.'};patch.scheduledDate=date;}
 return {value:patch};
}
module.exports={validate};
