(function(){
const members=document.querySelectorAll('.crew-member'),counter=document.querySelector('#crew-count');
let frame=0;
function crewTotal(){return new Set([...document.querySelectorAll('.crew-member')].map((member,i)=>member.dataset.crewId||member.getAttribute('aria-labelledby')||'member-'+i)).size}
function countUp(){
 cancelAnimationFrame(frame);const total=crewTotal();counter.setAttribute('aria-label',String(total));counter.textContent='0';
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){counter.textContent=total;return}
 const start=performance.now(),duration=1100;
 function tick(now){const progress=Math.min(1,(now-start)/duration);counter.textContent=progress===1?total:Math.floor(total*(1-Math.pow(1-progress,3)));if(progress<1)frame=requestAnimationFrame(tick)}
 frame=requestAnimationFrame(tick);
}
counter.textContent='0';
window.addEventListener('pageshow',countUp);
if(document.readyState==='complete')countUp();
let lastTotal=crewTotal();
const rosterObserver=new MutationObserver(()=>{const total=crewTotal();if(total!==lastTotal){lastTotal=total;countUp()}});
document.querySelectorAll('.crew-department,.crew-unassigned').forEach(section=>rosterObserver.observe(section,{childList:true,subtree:true}));
const tabs=[...document.querySelectorAll('.crew-teams [role=tab]')];
function activate(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index})}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(i));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(target);tabs[target].focus()}})});
if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}})},{threshold:.12});
members.forEach(member=>{member.classList.add('reveal-ready');observer.observe(member)});
})();
