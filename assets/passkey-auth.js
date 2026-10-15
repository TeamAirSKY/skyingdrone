(()=>{
let admin=false,unlocked=false,verified=false,busy=false;
const fromAdmin=new URLSearchParams(location.search).get('from')==='admin';
async function api(step,data={}){const response=await fetch('/api/admin-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'certificate',step,...data})});const result=await response.json();if(!response.ok)throw Error(result.error||'인증을 처리하지 못했습니다.');return result}
const status=()=>document.querySelector('#auth-status');
window.unlockCertificate=async pin=>{const result=await api('unlock',{pin,admin:fromAdmin});admin=result.admin;unlocked=true;verified=false;document.querySelector('.info h2').textContent=result.certificate.name;document.querySelector('.info .role').textContent=result.certificate.role;document.querySelector('.foot').textContent=admin?'인증하기':'☰ 인증 내역';document.querySelector('.mini').classList.toggle('attention',admin);status().textContent=admin?'멤버카드로 인증하세요. 카드를 누른 뒤 인증하기를 눌러주세요.':''};
window.passkeyAction=async()=>{
 if(!unlocked)return;
 if(!admin)openHist();
 if(busy)return;
 busy=true;const button=document.querySelector('.foot'),list=document.querySelector('#hist ul');
 button.disabled=admin;button.setAttribute('aria-busy','true');
 if(!admin){list.replaceChildren();const loading=document.createElement('li'),spinner=document.createElement('i'),label=document.createElement('span');loading.className='history-loading';loading.setAttribute('role','status');spinner.className='history-spinner';spinner.setAttribute('aria-hidden','true');label.textContent='인증 내역을 불러오는 중…';loading.append(spinner,label);list.append(loading)}
 try{
  if(admin){if(!verified){await api('verify');verified=true}document.querySelector('#auth-complete').showModal()}
  else{
   const rows=document.createDocumentFragment();let offset=0;
   do{const result=await api('history',{offset});for(const log of result.logs){const li=document.createElement('li'),title=document.createElement('b'),time=document.createElement('span'),state=document.createElement('em');title.textContent='관리자 페이지 멤버카드 인증';time.textContent=new Date(log.createdAt).toLocaleString('ko-KR');state.textContent='완료';li.append(title,time,state);rows.append(li)}offset=result.nextOffset}while(offset!==null);
   if(!rows.childNodes.length){const li=document.createElement('li');li.textContent='아직 인증 내역이 없습니다.';rows.append(li)}list.replaceChildren(rows);
  }
 }catch(error){if(admin)status().textContent=error.message;else{const li=document.createElement('li');li.textContent=error.message;list.replaceChildren(li)}}
 finally{busy=false;button.disabled=false;button.removeAttribute('aria-busy')}
};
addEventListener('DOMContentLoaded',()=>{const management=document.querySelector('#certificate-management'),form=document.querySelector('#change-certificate-pin'),feedback=document.querySelector('#certificate-management-message');let changing=false;
document.querySelector('#manage-certificate').onclick=()=>{if(!unlocked)return;form.reset();feedback.textContent='';management.showModal()};
document.querySelector('#close-certificate-management').onclick=()=>management.close();
management.addEventListener('cancel',e=>{if(changing)e.preventDefault()});
form.addEventListener('submit',async e=>{e.preventDefault();if(changing||!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));if(values.newPin!==values.confirmPin){feedback.textContent='새 비밀번호와 확인이 같지 않습니다.';return}changing=true;form.querySelectorAll('button,input').forEach(x=>x.disabled=true);feedback.textContent='변경 중…';try{await api('change-pin',values);form.reset();feedback.textContent='비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요.'}catch(error){feedback.textContent=error.message}finally{changing=false;form.querySelectorAll('button,input').forEach(x=>x.disabled=false)}});
document.querySelector('#mini').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}});document.querySelector('#go-admin').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await api('complete');location.assign('/admin.html')}catch(error){document.querySelector('#complete-error').textContent=error.message;button.disabled=false}}});
})();
