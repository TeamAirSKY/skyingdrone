(function(){
const counter=document.querySelector('#crew-count');
let frame=0,rosterReady=false,pageShown=document.readyState==='complete';
function crewTotal(){return new Set([...document.querySelectorAll('.crew-member')].map((member,i)=>member.dataset.crewId||member.getAttribute('aria-labelledby')||'member-'+i)).size}
function setCount(value,roll=false){
 const previous=counter.dataset.value||'0';
 counter.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
 counter.dataset.value=String(value);
 const incoming=document.createElement('span');incoming.className='crew-count-digit';incoming.textContent=value;incoming.setAttribute('aria-hidden','true');
 counter.replaceChildren(incoming);
 if(!roll||typeof incoming.animate!=='function')return;
 const outgoing=incoming.cloneNode();outgoing.textContent=previous;counter.prepend(outgoing);
 const options={duration:65,easing:'cubic-bezier(.2,.65,.3,1)',fill:'forwards'};
 outgoing.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-100%)',opacity:0}],options);
 const animation=incoming.animate([{transform:'translateY(100%)',opacity:0},{transform:'translateY(0)',opacity:1}],options);
 animation.onfinish=()=>{outgoing.remove();animation.cancel()};
}
function countUp(){
 cancelAnimationFrame(frame);if(!rosterReady){setCount(0);return}const total=crewTotal();counter.setAttribute('aria-label',String(total));counter.style.width=Math.max(1,String(total).length)+'ch';setCount(0);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){setCount(total);return}
 const steps=Math.min(total,6),beat=80,start=performance.now();let lastStep=0;
 function tick(now){
  const step=Math.min(steps,Math.floor((now-start)/beat));
  if(step>lastStep){setCount(Math.round(total*step/steps),true);lastStep=step}
  if(step<steps)frame=requestAnimationFrame(tick);
 }
 if(steps)frame=requestAnimationFrame(tick);
}
counter.textContent='0';
window.addEventListener('pageshow',event=>{pageShown=true;if(event.persisted)loadRoster();else if(rosterReady)countUp()});
let lastTotal=crewTotal();
const rosterObserver=new MutationObserver(()=>{const total=crewTotal();if(total!==lastTotal){lastTotal=total;if(rosterReady)countUp()}});
document.querySelectorAll('.crew-department,.crew-unassigned').forEach(section=>rosterObserver.observe(section,{childList:true,subtree:true}));
const tabs=[...document.querySelectorAll('.crew-teams [role=tab]')];
function activate(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index})}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(i));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(target);tabs[target].focus()}})});
let profileObserver=null;
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){profileObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');profileObserver.unobserve(entry.target)}})},{threshold:.12})}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
const equipment={neo2:{name:'Dji Neo 2',image:'assets/drone-neo2.webp'},lito1:{name:'Dji Lito 1',image:'assets/drone.webp'},avata360:{name:'Dji AVATA 360',image:'assets/drone-avata360.webp'}};
function card(member,role,context,index){
 const article=node('article',undefined,'crew-member');article.dataset.crewId=member.id;article.setAttribute('aria-labelledby','crew-'+context+'-'+member.id);
 const figure=node('figure',undefined,'crew-photo');if(member.photo){const image=node('img');image.src=member.photo;image.alt=member.name+' 프로필 이미지';image.decoding='async';image.loading='lazy';image.addEventListener('error',()=>{figure.replaceChildren(node('span',member.name.slice(0,2)));figure.classList.add('crew-photo-placeholder')},{once:true});figure.append(image)}else{figure.classList.add('crew-photo-placeholder');figure.append(node('span',member.name.slice(0,2)))}
 const content=node('div'),name=node('h2',member.name);name.id='crew-'+context+'-'+member.id;content.append(node('p','AIR SKY / '+String(index+1).padStart(2,'0'),'crew-number'),name);if(role)content.append(node('p',role,'crew-role'));
 const bio=node('div',undefined,'crew-bio');member.bio.split(/\n+/).filter(Boolean).forEach(line=>bio.append(node('p',line)));content.append(bio);
 if(member.equipment.length){const section=node('div',undefined,'crew-equipment'),list=node('div',undefined,'equipment-list');section.append(node('p','기체:','equipment-label'));for(const key of member.equipment){const data=equipment[key];if(!data)continue;const row=node('div',undefined,'equipment-item'),image=node('img');image.src=data.image;image.alt=data.name;image.width=90;image.height=55;image.loading='lazy';row.append(node('span',data.name),image);list.append(row)}section.append(list);content.append(section)}
 article.append(figure,content);if(profileObserver){article.classList.add('reveal-ready');profileObserver.observe(article)}return article;
}
function renderRoster(members){
 profileObserver?.disconnect();
 const owners=document.querySelector('#crew-panel-owners');owners.replaceChildren();
 for(const [flag,title] of [['owner','Team Owner'],['coOwner','Co-owner']]){const selected=members.filter(x=>x[flag]);if(!selected.length)continue;const section=node('section',undefined,flag==='coOwner'?'crew-coowners':'crew-owners'),list=node('div',undefined,'crew-list');if(flag==='coOwner')section.append(node('h2',title,'crew-section-title'));selected.forEach(member=>list.append(card(member,title,flag,members.indexOf(member))));section.append(list);owners.append(section)}
 if(!owners.children.length)owners.append(node('p','등록된 오너 프로필이 없습니다.','lead'));
 for(const [key,title] of [['filming','촬영팀'],['editing','편집팀']]){const panel=document.querySelector('#crew-panel-'+key),selected=members.filter(x=>x.department===key);panel.replaceChildren();if(selected.length){const list=node('div',undefined,'crew-list');selected.forEach(member=>list.append(card(member,member.leader?'Team Leader':'Crew',key,members.indexOf(member))));panel.append(list)}else{panel.append(node('p',title,'eyebrow'),node('h2','함께할 크루를 기다리고 있어요.','crew-empty-title'),node('p','새로운 크루가 합류하면 이곳에서 소개할게요.','lead'));const link=node('a','크루 지원하기 ↗','map-link');link.href='crew-apply.html';panel.append(link)}}
}
async function loadRoster(){
 try{const response=await fetch('/api/crew-roster'),data=await response.json();if(!response.ok||!Array.isArray(data.members))throw Error('ROSTER_UNAVAILABLE');rosterReady=false;renderRoster(data.members);lastTotal=crewTotal();rosterReady=true;document.querySelector('#roster-error')?.remove();if(pageShown)countUp();}
 catch{rosterReady=false;document.querySelectorAll('.crew-department').forEach(panel=>panel.replaceChildren());cancelAnimationFrame(frame);counter.textContent='—';counter.setAttribute('aria-label','인원 확인 불가');if(!document.querySelector('#roster-error')){const error=node('p','크루 소개를 불러오지 못했습니다. 연결을 확인하고 새로고침해주세요.','message');error.id='roster-error';document.querySelector('.crew-intro').append(error)}}
}
loadRoster();
})();
