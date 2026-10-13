(function(){
const tabs=[document.querySelector('#filming-tab'),document.querySelector('#suggestion-tab')],panels=[document.querySelector('#filming-panel'),document.querySelector('#suggestion-panel')];const records=new AirSkyAdminRecords('suggestion');
function activate(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index});if(index===1&&!records.loaded)records.load()}
tabs.forEach((tab,i)=>{tab.tabIndex=i===0?0:-1;tab.addEventListener('click',()=>activate(i));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?0:e.key==='End'?1:1-i;tabs[target].focus();activate(target)}})});
window.addEventListener('airsky-admin-logout',()=>{records.clear();activate(0)});
document.querySelector('#logout-suggestions').addEventListener('click',()=>document.querySelector('#logout').click());
})();
