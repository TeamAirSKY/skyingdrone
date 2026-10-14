(function(){
const button=document.querySelector('.menu-button'),panel=document.querySelector('.menu-panel');if(!button||!panel)return;let timer=0,blocked=[],previousFocus=null;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function toggle(open){clearTimeout(timer);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');document.body.classList.toggle('menu-open',open);
if(open){previousFocus=document.activeElement;blocked=[...document.body.children].filter(e=>e!==button&&e!==panel&&!['SCRIPT','STYLE','LINK'].includes(e.tagName)).map(e=>[e,e.inert]);blocked.forEach(([e])=>e.inert=true);panel.hidden=false;void panel.offsetWidth;panel.classList.add('is-open');panel.querySelector('a').focus({preventScroll:true})}
else{panel.classList.remove('is-open');blocked.forEach(([e,inert])=>e.inert=inert);blocked=[];(previousFocus?.isConnected?previousFocus:button).focus({preventScroll:true});timer=setTimeout(()=>panel.hidden=true,reduced?0:780)}}
button.addEventListener('click',()=>toggle(button.getAttribute('aria-expanded')!=='true'));panel.querySelector('.menu-scrim').addEventListener('click',()=>toggle(false));
document.addEventListener('keydown',e=>{if(button.getAttribute('aria-expanded')!=='true')return;if(e.key==='Escape'){e.preventDefault();toggle(false)}if(e.key==='Tab'){const items=[button,...panel.querySelectorAll('a')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
addEventListener('pageshow',event=>{if(event.persisted&&button.getAttribute('aria-expanded')==='true')toggle(false)});
})();
