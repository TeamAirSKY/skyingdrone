(function(){
const dashboard=document.querySelector('#dashboard'),notice=document.querySelector('#application-notice'),dialog=document.querySelector('#application-dialog');let generation=0,sessionActive=false;
async function check(showDialog=false){if(!window.airSkyCan('application'))return;
 const current=++generation;
 try{const response=await fetch('/api/crew-applications?summary=1');if(!response.ok)throw Error('알림을 확인하지 못했습니다.');const data=await response.json();if(current!==generation||dashboard.hidden)return;
 notice.querySelector('strong').textContent='신청이 왔어요!';notice.hidden=!data.pending;const text=`아직 확인하지 않은 크루 지원 ${data.pending}건이 있습니다.`;document.querySelector('#application-notice-text').textContent=text;document.querySelector('#application-dialog-text').textContent=text;
 if(showDialog&&data.pending&&typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
 }catch{if(current!==generation||dashboard.hidden)return;notice.hidden=false;notice.querySelector('strong').textContent='크루 지원 알림 확인 필요';document.querySelector('#application-notice-text').textContent='알림을 불러오지 못했습니다. 크루 지원 탭에서 확인해주세요.';}
}
function ready(){if(sessionActive||dashboard.hidden||!window.airSkyCan('application'))return;sessionActive=true;notice.querySelector('strong').textContent='신청이 왔어요!';check(true)}
function open(){if(dialog.open)dialog.close();window.airSkyOpenApplications?.();document.querySelector('#application-tab').focus()}
document.querySelector('[data-open-applications]').addEventListener('click',open);document.querySelector('#view-application-dialog').addEventListener('click',open);document.querySelector('#dismiss-application-dialog').addEventListener('click',()=>dialog.close());
window.addEventListener('airsky-admin-ready',ready);window.addEventListener('airsky-admin-logout',()=>{sessionActive=false;generation++;notice.hidden=true;if(dialog.open)dialog.close()});window.addEventListener('airsky-applications-changed',()=>check());
new MutationObserver(()=>{if(!dashboard.hidden)ready()}).observe(dashboard,{attributes:true,attributeFilter:['hidden']});if(!dashboard.hidden)ready();
})();
