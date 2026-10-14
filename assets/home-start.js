(function(){
if('scrollRestoration' in history)history.scrollRestoration='manual';
if(location.hash){try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
let interacted=false;
['wheel','touchstart','keydown','mousedown'].forEach(type=>addEventListener(type,()=>{interacted=true},{passive:true,once:true}));
function top(){if(interacted)return;const d=document.documentElement;d.style.scrollBehavior='auto';scrollTo(0,0);d.style.scrollBehavior=''}
top();addEventListener('DOMContentLoaded',top,{once:true});
addEventListener('load',()=>{top();setTimeout(top,100);setTimeout(top,400);setTimeout(top,1000)},{once:true});
addEventListener('pageshow',event=>{if(event.persisted)interacted=false;top()});
})();
