(function(){
const section=document.querySelector('#fleet');if(!section)return;let observer=null;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function render(keys,catalog){
 observer?.disconnect();section.querySelectorAll('.craft,.fleet-message').forEach(e=>e.remove());
 if(!keys.length){section.append(node('p','등록된 크루 기체가 아직 없습니다.','fleet-message'));return}
 if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches)observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}}),{threshold:.25});
 keys.forEach(key=>{const data=catalog[key],card=node('div',undefined,'craft'),frame=node('span',undefined,'ph'),image=node('img'),copy=node('div');card.dataset.droneId=key;image.src=data.image;image.alt=data.name;image.loading='lazy';image.decoding='async';image.style.objectFit=data.fit||'contain';frame.append(image);copy.append(node('h3',data.title),node('p',data.description));card.append(frame,copy);section.append(card);if(observer)observer.observe(card);else card.classList.add('in')});
 const pass=section.querySelector('.pass img');if(pass)pass.src=catalog[keys[0]].image;
 dispatchEvent(new Event('resize'));
}
async function load(){
 try{const response=await fetch('/api/crew-roster'),data=await response.json();if(!response.ok||!Array.isArray(data.members)||!data.catalog)throw Error('FLEET_UNAVAILABLE');
 const owned=[...new Set(data.members.flatMap(member=>member.equipment||[]))].filter(key=>Object.hasOwn(data.catalog,key));
 for(let i=owned.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[owned[i],owned[j]]=[owned[j],owned[i]]}
 render(owned.slice(0,3),data.catalog);
 }catch{section.querySelectorAll('.craft,.fleet-message').forEach(e=>e.remove());section.append(node('p',' 기체 정보를 불러오지 못했습니다. 새로고침 후 다시 확인해주세요.','fleet-message'));}
}
load();addEventListener('pageshow',event=>{if(event.persisted)load()});
})();
