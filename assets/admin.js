(function(){
const login=document.querySelector('#login-section'),dashboard=document.querySelector('#dashboard'),message=document.querySelector('#login-message');
const records=new AirSkyAdminRecords('filming');
window.airSkyAdminUser=null;window.airSkyCan=permission=>Boolean(window.airSkyAdminUser&&(window.airSkyAdminUser.owner||window.airSkyAdminUser.permissions.includes(permission)));
function enter(user){window.airSkyAdminUser=user;document.querySelector('#admin-identity').textContent=(user.name||'관리자')+' · '+(user.owner?'총괄':'개인 관리자');login.hidden=true;dashboard.hidden=false;window.dispatchEvent(new Event('airsky-admin-ready'));if(window.airSkyCan('filming'))records.load()}
function clear(){window.airSkyAdminUser=null;records.clear();dashboard.hidden=true;login.hidden=false;window.dispatchEvent(new Event('airsky-admin-logout'))}
window.addEventListener('airsky-session-changed',e=>{if(e.detail?.authenticated===false){clear();message.textContent='로그아웃했습니다.'}});
window.addEventListener('airsky-auth-expired',()=>{clear();message.textContent='관리자 로그인이 만료되었습니다. 다시 로그인해주세요.'});
async function api(options={}){const response=await fetch('/api/admin-session',options),data=await response.json();if(!response.ok)throw Error(data.error||'처리하지 못했습니다.');return data}
document.querySelector('#certificate-login').addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'certificate',step:'begin'})});location.assign('/passkey.html?from=admin')}catch(error){message.textContent=error.message;button.disabled=false}});
document.querySelector('#logout').addEventListener('click',async()=>{if(window.airSkyAdminBusy()){message.textContent='진행 중인 처리가 끝나면 로그아웃해주세요.';return}if(window.airSkyHasDrafts()&&!confirm('미반영 변경을 버리고 로그아웃할까요?'))return;try{const data=await api({method:'DELETE'});clear();message.textContent=data.auditSaved===false?'로그아웃했지만 접속 기록을 저장하지 못했습니다.':''}catch(error){message.textContent=error.message}});
async function recheck(){if(dashboard.hidden)return;const user=window.airSkyAdminUser;try{const data=await api();if(window.airSkyAdminUser!==user)return;if(!data.authenticated||data.user.id!==window.airSkyAdminUser?.id||JSON.stringify(data.user.permissions)!==JSON.stringify(window.airSkyAdminUser?.permissions)){clear();message.textContent='관리자 권한이 변경되었거나 로그인이 만료되었습니다. 다시 로그인해주세요.'}}catch{}}
setInterval(recheck,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)recheck()});
api().then(async data=>{if(data.authenticated){enter(data.user)}}).catch(()=>{message.textContent='관리자 연결을 확인할 수 없습니다.'});
})();
