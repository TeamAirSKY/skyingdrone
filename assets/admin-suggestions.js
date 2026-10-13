(function(){
const names=['filming','suggestion','application'],tabs=names.map(x=>document.getElementById(x+'-tab')),panels=names.map(x=>document.getElementById(x+'-panel'));
const records={suggestion:new AirSkyAdminRecords('suggestion'),application:new AirSkyAdminRecords('application')};
function activate(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index});const instance=records[names[index]];if(instance&&!instance.loaded)instance.load()}
window.airSkyOpenApplications=()=>activate(2);
tabs.forEach((tab,i)=>{tab.tabIndex=i===0?0:-1;tab.addEventListener('click',()=>activate(i));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[target].focus();activate(target)}})});
window.addEventListener('airsky-admin-logout',()=>{Object.values(records).forEach(x=>x.clear());activate(0)});
['logout-suggestions','logout-applications'].forEach(id=>document.getElementById(id).addEventListener('click',()=>document.querySelector('#logout').click()));
})();
