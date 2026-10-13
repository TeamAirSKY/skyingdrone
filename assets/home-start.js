(function(){
if('scrollRestoration' in history)history.scrollRestoration='manual';
let interacted=false;
['wheel','touchstart','keydown'].forEach(type=>addEventListener(type,()=>{interacted=true},{passive:true,once:true}));
function top(){if(location.hash||interacted)return;scrollTo({top:0,left:0,behavior:'instant'})}
top();addEventListener('DOMContentLoaded',top,{once:true});addEventListener('pageshow',event=>{if(event.persisted)interacted=false;top()});
})();
