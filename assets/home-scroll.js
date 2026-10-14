(function(){
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),e=(a,b,x)=>cl((x-a)/(b-a)),mix=(a,b,t)=>a+(b-a)*t,ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const fleet=document.getElementById('fleet'),track=fleet&&fleet.querySelector('.fleet-track'),ch=document.getElementById('channel'),lk=document.getElementById('links');
const items=lk?[...lk.querySelectorAll('h2,.go')]:[];
const padX=()=>Math.min(80,Math.max(24,innerWidth*.05));let fT=0,fL=1,tw=0,cT=0,lT=0,lL=1,cur=0,tgt=0,raf=0,last=0,counted=false;
function measure(){
 if(fleet){tw=track.scrollWidth;const dist=Math.max(0,tw-innerWidth+padX()*2);fleet.style.setProperty('--len',Math.round(innerHeight+Math.max(innerHeight*.55,dist*.55))+'px');fT=fleet.getBoundingClientRect().top+scrollY;fL=Math.max(1,fleet.offsetHeight-innerHeight)}
 if(ch)cT=ch.getBoundingClientRect().top+scrollY;
 if(lk){lT=lk.getBoundingClientRect().top+scrollY;lL=Math.max(1,lk.offsetHeight-innerHeight)}}
function place(p){const s=padX(),end=Math.min(s,innerWidth-s-tw),x=mix(s,end,ease(e(.04,.96,p)));track.style.transform='translate3d('+x.toFixed(1)+'px,0,0)'}
function tick(now){const dt=last?Math.min(50,now-last):16;last=now;cur=reduced?tgt:cur+(tgt-cur)*(1-Math.exp(-dt/110));
 if(Math.abs(tgt-cur)<.0004)cur=tgt;place(cur);if(cur!==tgt)raf=requestAnimationFrame(tick);else{raf=0;last=0}}
function update(){
 if(fleet){tgt=cl((scrollY-fT)/fL);if(!raf){raf=requestAnimationFrame(tick)}}
 if(ch&&!counted&&scrollY>cT-innerHeight*.2&&window.__countStats){counted=true;window.__countStats()}
 }
function relayout(){measure();update()}
addEventListener('scroll',update,{passive:true});addEventListener('resize',relayout);addEventListener('load',relayout);document.fonts&&document.fonts.ready.then(relayout);
measure();cur=tgt=fleet?cl((scrollY-fT)/fL):0;if(track)place(cur);update();
})();
