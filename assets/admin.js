(function(){
const login=document.querySelector('#login-section'),dashboard=document.querySelector('#dashboard'),message=document.querySelector('#login-message');
const records=new AirSkyAdminRecords('filming');
function clear(){records.clear();dashboard.hidden=true;login.hidden=false;document.querySelector('#pin').value='';window.dispatchEvent(new Event('airsky-admin-logout'))}
window.addEventListener('airsky-auth-expired',()=>{clear();message.textContent='관리자 로그인이 만료되었습니다. 다시 로그인해주세요.'});
async function api(options={}){const response=await fetch('/api/admin-session',options),data=await response.json();if(!response.ok)throw Error(data.error||'처리하지 못했습니다.');return data}
document.querySelector('#login-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;message.textContent='';try{await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:document.querySelector('#pin').value})});document.querySelector('#pin').value='';login.hidden=true;dashboard.hidden=false;await records.load()}catch(error){message.textContent=error.message}finally{button.disabled=false}});
document.querySelector('#logout').addEventListener('click',async()=>{if(window.airSkyAdminBusy()){message.textContent='진행 중인 처리가 끝나면 로그아웃해주세요.';return}if(window.airSkyHasDrafts()&&!confirm('미반영 변경을 버리고 로그아웃할까요?'))return;try{const data=await api({method:'DELETE'});clear();message.textContent=data.auditSaved===false?'로그아웃했지만 접속 기록을 저장하지 못했습니다.':''}catch(error){message.textContent=error.message}});
api().then(async data=>{if(data.authenticated){login.hidden=true;dashboard.hidden=false;await records.load()}}).catch(()=>{message.textContent='관리자 연결을 확인할 수 없습니다.'});
})();
