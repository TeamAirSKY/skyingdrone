(function(){
const labels={pending:'검토 대기',accepted:'수락',rejected:'반려',completed:'촬영 완료',reviewed:'확인 완료'};
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
const instances=[];
class Records{
 constructor(kind){
  this.kind=kind;this.isRequest=kind==='filming';this.isApplication=kind==='application';this.endpoint=this.isRequest?'/api/filming-requests':this.isApplication?'/api/crew-applications':'/api/suggestions';this.field=this.isRequest?'requests':this.isApplication?'applications':'suggestions';
  this.states=this.isRequest?['pending','accepted','rejected','completed']:this.isApplication?['pending','reviewed','accepted','rejected']:['pending','reviewed'];this.entries=[];this.drafts=new Map();this.selected=new Set();this.offset=0;this.loaded=false;this.busy=false;
  this.root=document.querySelector('#'+kind+'-panel');this.list=this.root.querySelector('[data-records]');this.message=this.root.querySelector('[data-message]');this.more=this.root.querySelector('[data-more]');
  this.search=this.root.querySelector('[data-search]');this.status=this.root.querySelector('[data-status]');this.sort=this.root.querySelector('[data-sort]');this.category=this.root.querySelector('[data-category]');this.bulk=this.root.querySelector('[data-bulk]');
  for(const select of [this.status,this.bulk]){for(const state of this.states){const o=node('option',labels[state]);o.value=state;select.append(o)}}
  this.search.addEventListener('input',()=>this.render());[this.status,this.sort,this.category].filter(Boolean).forEach(e=>e.addEventListener('change',()=>this.render()));
  this.root.querySelector('[data-refresh]').addEventListener('click',()=>{if(!this.drafts.size||confirm('미반영 변경을 버리고 새로 불러올까요?'))this.load(true)});
  this.more.addEventListener('click',()=>this.load(false));
  this.root.querySelector('[data-select-all]').addEventListener('change',e=>{this.visible().forEach(x=>e.target.checked?this.selected.add(x.id):this.selected.delete(x.id));this.render()});
  this.root.querySelector('[data-stage]').addEventListener('click',()=>{if(!this.bulk.value)return;this.entries.filter(x=>this.selected.has(x.id)).forEach(x=>this.stage(x,this.bulk.value));this.message.textContent='상태를 선택했습니다. 반영하기를 눌러야 저장됩니다.';this.render()});
  this.root.querySelector('[data-apply]').addEventListener('click',()=>this.apply());
  this.root.querySelector('[data-discard]').addEventListener('click',()=>{this.drafts.clear();this.message.textContent='미반영 변경을 되돌렸습니다.';this.render()});instances.push(this);this.render();
 }
 stage(item,status){this.stageFields(item,{status})}
 stageFields(item,fields){const patch={...(this.drafts.get(item.id)||{}),...fields};for(const [key,value] of Object.entries(patch)){if(value===(item[key]||''))delete patch[key]}if(Object.keys(patch).length)this.drafts.set(item.id,patch);else this.drafts.delete(item.id);this.updateDraftControls()}
 updateDraftControls(){this.root.querySelector('[data-pending]').textContent=`미반영 ${this.drafts.size}건`;this.root.querySelector('[data-apply]').disabled=this.busy||!this.drafts.size;this.root.querySelector('[data-discard]').disabled=this.busy||!this.drafts.size}
 visible(){const query=this.search.value.trim().toLocaleLowerCase();return this.entries.filter(x=>(this.status.value==='all'||x.status===this.status.value)&&(!this.category||this.category.value==='all'||(this.isApplication?(x.department||'undecided'):x.category)===this.category.value)&&(!query||[x.name,x.introduction,x.nickname,x.address,x.details,x.notes,x.instagram,x.content,x.id].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>this.sort.value==='oldest'?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt))}
 render(){
  const visible=this.visible();this.list.replaceChildren();
  this.root.querySelector('[data-count]').textContent=`불러온 ${this.entries.length}건 · 표시 ${visible.length}건 · 검토 대기 ${this.entries.filter(x=>x.status==='pending').length}건`;
  const selectAll=this.root.querySelector('[data-select-all]');selectAll.checked=!!visible.length&&visible.every(x=>this.selected.has(x.id));selectAll.indeterminate=visible.some(x=>this.selected.has(x.id))&&!selectAll.checked;
  for(const item of visible){
   const card=node('article',undefined,'request-card'),head=node('div',undefined,'request-head'),title=node('label',undefined,'record-selection'),check=node('input');check.type='checkbox';check.checked=this.selected.has(item.id);check.setAttribute('aria-label',(item.name||item.nickname||'익명')+' 항목 선택');check.addEventListener('change',()=>{check.checked?this.selected.add(item.id):this.selected.delete(item.id);this.render()});title.append(check,node('span',item.name||item.nickname||'익명'));head.append(title,node('time',new Date(item.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));card.append(head);
   if(this.isRequest){card.append(node('p',item.address+(item.details?' · '+item.details:'')));const map=node('a','지도에서 위치 확인 ↗','map-link');map.href='https://map.kakao.com/?q='+encodeURIComponent(item.address);map.target='_blank';map.rel='noopener noreferrer';card.append(map);if(item.instagram){const link=node('a','@'+item.instagram+' · 인스타그램으로 안내 ↗','map-link');link.href='https://www.instagram.com/'+encodeURIComponent(item.instagram)+'/';link.target='_blank';link.rel='noopener noreferrer';card.append(node('br'),link)}if(item.notes)card.append(node('p',item.notes,'notes'));}
   else if(this.isApplication){card.append(node('p','희망 부서: '+({filming:'촬영팀',planning:'기획팀',editing:'편집팀',undecided:'미정'}[item.department||'undecided']||'미정'),'suggestion-category'),node('p',item.introduction,'notes'));const register=node('button','크루 프로필 작성','button secondary');register.type='button';register.addEventListener('click',()=>window.airSkyCreateCrew?.({name:item.name,bio:item.introduction,department:item.department==='undecided'?'':item.department}));card.append(register)}
   else card.append(node('p',item.category==='site'?'사이트 건의':'채널 건의','suggestion-category'),node('p',item.content,'notes'));
   const select=node('select');select.setAttribute('aria-label',(item.name||item.nickname||'익명')+' 처리 상태');select.dataset.stateId=item.id;for(const state of this.states){const o=node('option',labels[state]);o.value=state;select.append(o)}select.value=this.drafts.get(item.id)?.status||item.status;select.addEventListener('change',()=>{this.stage(item,select.value);this.render();this.list.querySelector(`[data-state-id="${item.id}"]`)?.focus()});
   const actions=node('div',undefined,'request-actions');actions.append(select,node('span',this.drafts.has(item.id)?`${labels[item.status]} → ${labels[select.value]} · 미반영`:`현재 상태: ${labels[item.status]}`,'badge'));card.append(actions);
   const noteLabel=node('label','관리자 내부 메모','admin-note-label'),note=node('textarea');note.maxLength=2000;note.rows=3;note.value=this.drafts.get(item.id)?.adminNote??item.adminNote??'';note.placeholder='검토 이유나 다음 작업을 기록해주세요. 신청자에게는 공개되지 않습니다.';note.addEventListener('input',()=>this.stageFields(item,{adminNote:note.value}));noteLabel.append(note);card.append(noteLabel);
   if(this.isRequest){const dateLabel=node('label','촬영 예정일 · 관리자용','admin-note-label'),date=node('input');date.type='date';date.value=this.drafts.get(item.id)?.scheduledDate??item.scheduledDate??'';date.addEventListener('input',()=>this.stageFields(item,{scheduledDate:date.value}));dateLabel.append(date);card.append(dateLabel)}
   card.append(node('p','접수 번호: '+item.id,'record-id'));this.list.append(card);
  }
  if(!visible.length)this.list.append(node('p',this.loaded?'조건에 맞는 항목이 없습니다.':'아직 목록을 불러오지 않았습니다.','empty'));
  this.root.querySelector('[data-pending]').textContent=`미반영 ${this.drafts.size}건`;
  this.root.querySelector('[data-selected]').textContent=`선택 ${this.selected.size}건`;
  this.root.querySelector('[data-apply]').disabled=!this.drafts.size;
  this.root.querySelector('[data-discard]').disabled=!this.drafts.size;
  this.root.querySelector('[data-stage]').disabled=!this.selected.size;
  if(this.busy)this.root.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=true);
 }
 async load(reset=true){
  if(this.busy)return;this.busy=true;this.render();this.message.textContent='불러오는 중…';
  try{const response=await fetch(this.endpoint+'?offset='+(reset?0:this.offset)),data=await response.json();if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('airsky-auth-expired'));throw Error(data.error||'목록을 불러오지 못했습니다.')}
   if(reset){this.entries=[];this.drafts.clear();this.selected.clear()}const ids=new Set(this.entries.map(x=>x.id));this.entries.push(...data[this.field].filter(x=>!ids.has(x.id)));this.offset=data.nextOffset;this.more.hidden=this.offset===null;this.loaded=true;this.message.textContent='';
  }catch(e){this.message.textContent=e.message}finally{this.busy=false;this.root.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=false);this.render()}
 }
 async apply(){
  if(this.busy||!this.drafts.size)return;
  const changes=[...this.drafts];const deletesContact=this.entries.some(x=>x.instagram&&['rejected','completed'].includes(this.drafts.get(x.id)?.status));
  if(deletesContact&&!confirm('반려·촬영 완료로 처리하는 신청의 인스타그램 아이디가 삭제됩니다. 선택한 변경을 반영할까요?'))return;
  this.busy=true;this.render();let saved=0,failed=0;let expired=false;
  for(const [id,patch] of changes){const item=this.entries.find(x=>x.id===id),status=patch.status||item.status;
   this.message.textContent=`반영 중… ${saved+failed+1}/${changes.length}`;
   try{const response=await fetch(this.endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status,...patch})}),data=await response.json();if(!response.ok){if(response.status===401){expired=true;throw Error('관리자 로그인이 만료되었습니다.')}throw Error(data.error||'반영하지 못했습니다.')}
    if(data.request)Object.assign(item,data.request);else Object.assign(item,{status,...patch});
    if(this.isRequest&&['rejected','completed'].includes(status)){delete item.instagram;delete item.instagramConsentAt}
    this.drafts.delete(id);this.selected.delete(id);saved++;
   }catch{failed++;if(expired)break;}
  }
  this.busy=false;this.root.querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=false);this.render();this.message.textContent=failed?`${saved}건 반영했습니다. 남은 ${this.drafts.size}건은 저장되지 않았습니다. 다시 시도해주세요.`:`${saved}건 반영했습니다.`;
  if(this.isApplication)window.dispatchEvent(new Event('airsky-applications-changed'));
  if(expired)window.dispatchEvent(new Event('airsky-auth-expired'));
 }
 clear(){this.entries=[];this.drafts.clear();this.selected.clear();this.loaded=false;this.offset=0;this.more.hidden=true;this.message.textContent='';this.render()}
}
window.AirSkyAdminRecords=Records;
window.airSkyAdminBusy=()=>instances.some(x=>x.busy)||Boolean(window.airSkyOperationsBusy?.());
window.airSkyHasDrafts=()=>instances.some(x=>x.drafts.size)||Boolean(window.airSkyOperationsDirty?.());
window.addEventListener('beforeunload',e=>{if(window.airSkyHasDrafts()){e.preventDefault();e.returnValue=''}});
})();
