(function(){
const names=['filming','application','suggestion','operations','audit'],tabs=names.map(x=>document.getElementById(x+'-tab')),panels=names.map(x=>document.getElementById(x+'-panel'));
const records={suggestion:new AirSkyAdminRecords('suggestion'),application:new AirSkyAdminRecords('application')};
function activate(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index});const instance=records[names[index]];if(instance&&!instance.loaded)instance.load();if(names[index]==='operations')window.airSkyLoadOperations?.();if(names[index]==='audit')window.dispatchEvent(new Event('airsky-audit-open'))}
window.airSkyOpenApplications=()=>activate(1);window.airSkyOpenOperations=()=>activate(3);
tabs.forEach((tab,i)=>{tab.tabIndex=i===0?0:-1;tab.addEventListener('click',()=>activate(i));tab.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[target].focus();activate(target)}})});
window.addEventListener('airsky-admin-logout',()=>{Object.values(records).forEach(x=>x.clear());activate(0)});
})();
