(function(){
const members=document.querySelectorAll('.crew-member'),counter=document.querySelector('#crew-count');
let frame=0;
function crewTotal(){return new Set([...document.querySelectorAll('.crew-member')].map((member,i)=>member.dataset.crewId||member.getAttribute('aria-labelledby')||'member-'+i)).size}
function setCount(value,roll=false){
 const previous=counter.dataset.value||'0';
 counter.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
 counter.dataset.value=String(value);
 const incoming=document.createElement('span');incoming.className='crew-count-digit';incoming.textContent=value;incoming.setAttribute('aria-hidden','true');
 counter.replaceChildren(incoming);
 if(!roll||typeof incoming.animate!=='function')return;
 const outgoing=incoming.cloneNode();outgoing.textContent=previous;counter.prepend(outgoing);
 const options={duration:110,easing:'cubic-bezier(.2,.65,.3,1)',fill:'forwards'};
 outgoing.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-100%)',opacity:0}],options);
 const animation=incoming.animate([{transform:'translateY(100%)',opacity:0},{transform:'translateY(0)',opacity:1}],options);
 animation.onfinish=()=>{outgoing.remove();animation.cancel()};
}
function countUp(){
 cancelAnimationFrame(frame);const total=crewTotal();counter.setAttribute('aria-label',String(total));counter.style.width=Math.max(1,String(total).length)+'ch';setCount(0);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){setCount(total);return}
 const steps=Math.min(total,6),beat=140,start=performance.now();let lastStep=0;
 function tick(now){
  const step=Math.min(steps,Math.floor((now-start)/beat));
  if(step>lastStep){setCount(Math.round(total*step/steps),true);lastStep=step}
  if(step<steps)frame=requestAnimationFrame(tick);
 }
 if(steps)frame=requestAnimationFrame(tick);
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
