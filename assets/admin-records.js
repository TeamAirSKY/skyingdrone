(function(){
const labels={pending:'검토 대기',accepted:'수락',rejected:'반려',completed:'촬영 완료',reviewed:'확인 완료'};
const departments={filming:'촬영팀',planning:'기획팀',editing:'편집팀',undecided:'미정'};
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
const instances=[];
class Records{
 constructor(kind){
  this.kind=kind;this.isRequest=kind==='filming';this.isApplication=kind==='application';this.endpoint=this.isRequest?'/api/filming-requests':this.isApplication?'/api/crew-applications':'/api/suggestions';this.field=this.isRequest?'requests':this.isApplication?'applications':'suggestions';
  this.states=this.isRequest?['pending','accepted','rejected','completed']:this.isApplication?['pending','reviewed','accepted','rejected']:['pending','reviewed'];this.entries=[];this.drafts=new Map();this.selected=new Set();this.open=new Set();this.offset=0;this.loaded=false;this.busy=false;this.view='active';this.generation=0;
  this.root=document.querySelector('#'+kind+'-panel');this.list=this.root.querySelector('[data-records]');this.message=this.root.querySelector('[data-message]');this.more=this.root.querySelector('[data-more]');
  this.search=this.root.querySelector('[data-search]');this.status=this.root.querySelector('[data-status]');this.sort=this.root.querySelector('[data-sort]');this.category=this.root.querySelector('[data-category]');this.bulk=this.root.querySelector('[data-bulk]');
  for(const state of this.states){const option=node('option',labels[state]);option.value=state;this.status.append(option);this.bulk.append(option.cloneNode(true))}
  for(const [value,text] of [['archive','보관하기'],['restore','접수함으로 복원'],['delete','영구 삭제']]){const option=node('option',text);option.value=value;this.bulk.append(option)}
  this.search.addEventListener('input',()=>this.render());[this.status,this.sort,this.category].filter(Boolean).forEach(e=>e.addEventListener('change',()=>this.render()));
  this.root.querySelector('[data-refresh]').addEventListener('click',()=>{if(this.canDiscard())this.load(true)});this.more.addEventListener('click',()=>this.load(false));
  this.root.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(this.busy||this.view===button.dataset.view||!this.canDiscard())return;this.view=button.dataset.view;this.load(true)}));
  this.root.querySelector('[data-select-all]').addEventListener('change',e=>{this.visible().forEach(x=>e.target.checked?this.selected.add(x.id):this.selected.delete(x.id));this.render()});
  this.root.querySelector('[data-stage]').addEventListener('click',()=>{const value=this.bulk.value;if(!value)return;this.entries.filter(x=>this.selected.has(x.id)).forEach(item=>{if(value==='delete')this.stageFields(item,{_delete:true});else if(value==='archive'||value==='restore')this.stageFields(item,{archived:value==='archive'});else this.stageFields(item,{status:value})});this.message.textContent='변경을 선택했습니다. 반영하기를 눌러야 저장됩니다.';this.render()});
  this.root.querySelector('[data-apply]').addEventListener('click',()=>this.apply());this.root.querySelector('[data-discard]').addEventListener('click',()=>{this.drafts.clear();this.message.textContent='미반영 변경을 되돌렸습니다.';this.render()});instances.push(this);this.render();
 }
 canDiscard(){return !this.drafts.size||confirm('미반영 변경을 버리고 다시 불러올까요?')}
 stageFields(item,fields){
  const patch={...(this.drafts.get(item.id)||{}),...fields};
  for(const [key,value] of Object.entries(patch)){const original=key==='archived'?Boolean(item.archived):key==='_delete'?false:item[key]||'';if(value===original)delete patch[key]}
  if(Object.keys(patch).length)this.drafts.set(item.id,patch);else this.drafts.delete(item.id);this.updateDraftControls();
 }
 updateDraftControls(){const count=this.drafts.size;this.root.querySelector('[data-savebar]').hidden=!count;this.root.querySelector('[data-pending]').textContent=`미반영 ${count}건`;this.root.querySelector('[data-apply]').disabled=this.busy||!count;this.root.querySelector('[data-discard]').disabled=this.busy||!count;}
 matchesView(item){return this.view==='archived'?Boolean(item.archived):!item.archived}
 visible(){const query=this.search.value.trim().toLocaleLowerCase();return this.entries.filter(x=>this.matchesView(x)&&(this.status.value==='all'||x.status===this.status.value)&&(!this.category||this.category.value==='all'||(this.isApplication?(x.department||'undecided'):x.category)===this.category.value)&&(!query||[x.name,x.introduction,x.nickname,x.address,x.details,x.notes,x.adminNote,x.instagram,x.content,this.isRequest?x.number||x.id:this.isApplication?null:x.id].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>this.sort.value==='oldest'?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt))}
 render(){
  const visible=this.visible(),loaded=this.entries.filter(x=>this.matchesView(x));this.list.replaceChildren();
  this.root.querySelector('[data-count]').textContent=`${visible.length}건 표시 · 검토 대기 ${loaded.filter(x=>x.status==='pending').length}건`;
  this.root.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(this.view===button.dataset.view)));
  const selectAll=this.root.querySelector('[data-select-all]');selectAll.checked=!!visible.length&&visible.every(x=>this.selected.has(x.id));selectAll.indeterminate=visible.some(x=>this.selected.has(x.id))&&!selectAll.checked;
  for(const item of visible)this.list.append(this.card(item));
  if(!visible.length)this.list.append(node('p',this.loaded?(this.view==='archived'?'보관한 항목이 없습니다.':'조건에 맞는 항목이 없습니다.'):'목록을 불러오는 중입니다.','empty'));
  this.root.querySelector('[data-selected]').textContent=`선택 ${this.selected.size}건`;this.root.querySelector('[data-stage]').disabled=!this.selected.size;this.updateDraftControls();
  if(this.busy)this.root.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=true);
 }
 card(item){
  const patch=this.drafts.get(item.id)||{},deleting=Boolean(patch._delete),name=(this.isRequest&&item.number?item.number+'번 · ':'')+(item.name||item.nickname||'익명');
  const card=node('article',undefined,'request-card'+(deleting?' is-delete-pending':'')),head=node('div',undefined,'request-head'),title=node('label',undefined,'record-selection'),check=node('input');check.type='checkbox';check.checked=this.selected.has(item.id);check.setAttribute('aria-label',name+' 항목 선택');check.addEventListener('change',()=>{check.checked?this.selected.add(item.id):this.selected.delete(item.id);this.render()});title.append(check,node('span',name));head.append(title,node('time',new Date(item.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'})));card.append(head);if(this.isRequest&&item.deleteAfter)card.append(node('p','자동 삭제 예정: '+new Date(item.deleteAfter).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}),'hint'));
  const category=this.isApplication?'희망 부서 · '+departments[item.department||'undecided']:!this.isRequest?(item.category==='site'?'사이트 건의':'채널 건의'):'';if(category)card.append(node('p',category,'record-category'));
  card.append(node('p',this.isRequest?item.address:item.introduction||item.content,'record-preview'));
  const actions=node('div',undefined,'request-actions'),select=node('select');select.setAttribute('aria-label',name+' 처리 상태');select.dataset.stateId=item.id;
  for(const state of this.states){const option=node('option',labels[state]);option.value=state;select.append(option)}select.value=patch.status||item.status;select.disabled=deleting;select.addEventListener('change',()=>{this.stageFields(item,{status:select.value});this.render();this.list.querySelector(`[data-state-id="${item.id}"]`)?.focus()});actions.append(select);
  const archive=node('button',item.archived?'복원':'보관','button record-button');archive.type='button';archive.disabled=deleting;archive.addEventListener('click',()=>{this.stageFields(item,{archived:patch.archived===undefined?!item.archived:!patch.archived});this.render()});
  const remove=node('button',deleting?'삭제 취소':'삭제','button record-button danger');remove.type='button';remove.addEventListener('click',()=>{this.stageFields(item,{_delete:!deleting});this.render()});actions.append(archive,remove);card.append(actions);
  if(this.drafts.has(item.id))card.append(node('p',deleting?'영구 삭제 예정 · 반영하기 전까지 삭제되지 않습니다.':patch.archived!==undefined?(patch.archived?'보관 예정':'복원 예정')+' · 미반영':'변경 내용이 아직 저장되지 않았습니다.','record-draft'));
  const details=node('details',undefined,'record-details');details.open=this.open.has(item.id);details.addEventListener('toggle',()=>{details.open?this.open.add(item.id):this.open.delete(item.id)});details.append(node('summary',this.isApplication?'소개·연락처·메모 보기':'상세 내용·메모 보기'));
  if(this.isRequest){details.append(node('p',item.address+(item.details?' · '+item.details:'')));const map=node('a','지도에서 위치 확인 ↗','map-link');map.href='https://map.kakao.com/?q='+encodeURIComponent(item.address);map.target='_blank';map.rel='noopener noreferrer';details.append(map);if(item.instagram){const link=node('a','@'+item.instagram+' · 인스타그램 안내 ↗','map-link');link.href='https://www.instagram.com/'+encodeURIComponent(item.instagram)+'/';link.target='_blank';link.rel='noopener noreferrer';details.append(node('br'),link)}if(item.notes)details.append(node('p',item.notes,'notes'));}
  else if(this.isApplication){details.append(node('p',item.introduction,'notes'));if(item.phone){const contact=node('p'),phone=node('a',item.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/,'$1-$2-$3'),'map-link');phone.href='tel:'+item.phone;const sms=node('a','문자 보내기 ↗','map-link');sms.href='sms:'+item.phone;contact.append(phone,node('span',' · '),sms);details.append(contact)}else details.append(node('p','이전 지원 · 전화번호 미기재','hint'));const register=node('button','크루 프로필 작성','button secondary');register.type='button';register.disabled=deleting;register.hidden=!window.airSkyCan('crew');register.addEventListener('click',()=>window.airSkyCreateCrew?.({name:item.name,bio:item.introduction,department:item.department==='undecided'?'':item.department}));details.append(register)}
  else details.append(node('p',item.content,'notes'));
  const noteLabel=node('label','관리자 내부 메모','admin-note-label'),note=node('textarea');note.maxLength=2000;note.rows=3;note.disabled=deleting;note.value=patch.adminNote??item.adminNote??'';note.placeholder='검토 이유나 다음 작업을 기록해주세요. 신청자에게는 공개되지 않습니다.';note.addEventListener('input',()=>this.stageFields(item,{adminNote:note.value}));noteLabel.append(note);details.append(noteLabel);
  if(this.isRequest){const label=node('label','촬영 예정일 · 관리자용','admin-note-label'),date=node('input');date.type='date';date.disabled=deleting;date.value=patch.scheduledDate??item.scheduledDate??'';date.addEventListener('input',()=>this.stageFields(item,{scheduledDate:date.value}));label.append(date);details.append(label)}
  if(this.isRequest){details.append(node('p',item.number?'신청 번호: '+item.number:'이전 접수 번호: '+item.id,'record-id'));if(item.number&&!item.receiptProtected)details.append(node('p','이전 신청 조회 번호: '+item.id,'record-id'))}card.append(details);return card;
 }
 async load(reset=true){
  if(this.busy)return;const generation=++this.generation;this.busy=true;this.render();this.message.textContent='불러오는 중…';
  try{const response=await fetch(this.endpoint+'?view='+this.view+'&offset='+(reset?0:this.offset)),data=await response.json();if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('airsky-auth-expired'));throw Error(data.error||'목록을 불러오지 못했습니다.')}if(generation!==this.generation)return;
   if(reset){this.entries=[];this.drafts.clear();this.selected.clear();this.open.clear()}const ids=new Set(this.entries.map(x=>x.id));this.entries.push(...data[this.field].filter(x=>!ids.has(x.id)));this.offset=data.nextOffset;this.more.hidden=this.offset===null;this.loaded=true;this.message.textContent='';
  }catch(error){if(generation===this.generation)this.message.textContent=error.message}finally{if(generation===this.generation){this.busy=false;this.root.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=false);this.render()}}
 }
 async apply(){
  if(this.busy||!this.drafts.size)return;const changes=[...this.drafts],deletes=changes.filter(([,patch])=>patch._delete).length;
  if(deletes&&!confirm(`${deletes}건을 영구 삭제합니다. 이름·연락처·내용·메모가 삭제되며 복구할 수 없습니다. 지금 반영할까요?`))return;
  const contactRemoval=this.entries.some(x=>x.instagram&&!this.drafts.get(x.id)?._delete&&['rejected','completed'].includes(this.drafts.get(x.id)?.status));if(contactRemoval&&!confirm('반려·촬영 완료 신청의 인스타그램 아이디가 삭제됩니다. 반영할까요?'))return;
  const generation=this.generation;this.busy=true;this.render();let saved=0,failed=0,expired=false;
  for(const [id,patch] of changes){
   if(generation!==this.generation)break;const item=this.entries.find(x=>x.id===id),{_delete,...fields}=patch;this.message.textContent=`반영 중… ${saved+failed+1}/${changes.length}`;
   try{const response=await fetch(this.endpoint,{method:_delete?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_delete?{id}:{id,status:fields.status||item.status,...fields})}),data=await response.json();if(!response.ok){if(response.status===401){expired=true;throw Error('관리자 로그인이 만료되었습니다.')}throw Error(data.error||'반영하지 못했습니다.')}if(generation!==this.generation)break;
    if(_delete){this.entries=this.entries.filter(x=>x.id!==id);this.open.delete(id)}else{Object.assign(item,data.request||{...fields,status:fields.status||item.status});if(this.isRequest&&['rejected','completed'].includes(item.status)){delete item.instagram;delete item.instagramConsentAt}}
    this.drafts.delete(id);this.selected.delete(id);saved++;
   }catch{failed++;if(expired)break;}
  }
  if(generation!==this.generation)return;this.busy=false;this.root.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=false);this.render();this.message.textContent=failed?`${saved}건 반영했습니다. 남은 ${this.drafts.size}건은 저장되지 않았습니다. 다시 시도해주세요.`:`${saved}건 반영했습니다.`;
  if(this.isApplication)window.dispatchEvent(new Event('airsky-applications-changed'));if(expired)window.dispatchEvent(new Event('airsky-auth-expired'));
 }
 clear(){this.generation++;this.busy=false;this.entries=[];this.drafts.clear();this.selected.clear();this.open.clear();this.loaded=false;this.offset=0;this.view='active';this.more.hidden=true;this.message.textContent='';this.render()}
}
window.AirSkyAdminRecords=Records;window.airSkyAdminBusy=()=>instances.some(x=>x.busy)||Boolean(window.airSkyOperationsBusy?.())||Boolean(window.airSkyAccountsBusy?.());window.airSkyHasDrafts=()=>instances.some(x=>x.drafts.size)||Boolean(window.airSkyOperationsDirty?.());
window.addEventListener('beforeunload',event=>{if(window.airSkyHasDrafts()){event.preventDefault();event.returnValue=''}});
})();
