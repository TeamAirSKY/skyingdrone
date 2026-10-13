(function(){
const roots=document.querySelectorAll('.embedded-about,.standalone-about');
roots.forEach(root=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const logo=root.querySelector('.mark');
 if(logo){if(!('IntersectionObserver' in window)||reduced)logo.classList.add('logo-visible');else{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){logo.classList.add('logo-visible');observer.disconnect()}},{threshold:.2});observer.observe(logo)}}
 const say=root.querySelector('.say');if(say){say.querySelectorAll('.ln').forEach(line=>{line.replaceChildren(...line.textContent.split(' ').flatMap((word,i)=>{const span=document.createElement('span');span.className='w';span.textContent=word;return i?[document.createTextNode(' '),span]:[span]}))})}
 const cards=root.querySelectorAll('.craft');const stats=root.querySelector('.big');
 function count(el){if(reduced){el.textContent=Number(el.dataset.n).toLocaleString('ko-KR');return}const start=performance.now(),to=Number(el.dataset.n);function tick(now){const p=Math.min(1,(now-start)/1600);el.textContent=Math.round(to*(1-Math.pow(1-p,4))).toLocaleString('ko-KR');if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick)}
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;if(entry.target.classList.contains('craft'))entry.target.classList.add('in');else entry.target.querySelectorAll('[data-n]').forEach(count);observer.unobserve(entry.target)}),{threshold:.25});cards.forEach(card=>observer.observe(card));if(stats)observer.observe(stats)}else{cards.forEach(card=>card.classList.add('in'));stats?.querySelectorAll('[data-n]').forEach(count)}
 const images=[...cards].map(card=>card.querySelector('img').src);const pilot=root.classList.contains('standalone-about')?document.querySelector('.pilot'):null;if(pilot){pilot.querySelector('img').src=images[1];if(reduced)pilot.hidden=true}root.querySelectorAll('.pass').forEach((pass,i)=>{pass.querySelector('img').src=images[i%images.length];if(!reduced&&'IntersectionObserver' in window){new IntersectionObserver(entries=>{if(entries[0].isIntersecting)pass.classList.add('go');else pass.classList.remove('go')},{threshold:.3}).observe(pass.parentElement)}});
 const daylight=root.querySelector('.intro-daylight'),sticky=daylight?.querySelector('.daylight-sticky'),scene=daylight?.querySelector('.light-scene');

 const timeLabel=scene?.querySelector('.light-time');
 let currentProgress=null,targetProgress=0,frame=0,lastFrame=0,start=0,travel=1,sunTravel=0,lastPaint=-1,lastPhase='';
 const words=say?[...say.querySelectorAll('.w')]:[];let wordCount=-1;
 function paint(p){
 if(Math.abs(p-lastPaint)<.0005&&p!==0&&p!==1)return;lastPaint=p;
 const dusk=Math.max(0,1-Math.abs(p-.5)*2),night=Math.max(0,(p-.5)*2);
 scene.style.setProperty('--dusk',dusk.toFixed(4));scene.style.setProperty('--night',night.toFixed(4));scene.style.setProperty('--sun-offset',(p*sunTravel).toFixed(2)+'px');
 const phase=p<.3?'day':p<.75?'sunset':'night';if(phase!==lastPhase){lastPhase=phase;scene.dataset.phase=phase;timeLabel.textContent=phase==='day'?'낮':phase==='sunset'?'해 질 무렵':'밤'}
 }
 function glide(now){
 frame=0;const dt=lastFrame?Math.min(50,now-lastFrame):16;lastFrame=now;
 currentProgress+=(targetProgress-currentProgress)*(1-Math.exp(-dt/110));
 if(Math.abs(targetProgress-currentProgress)<.0008){currentProgress=targetProgress;lastFrame=0;paint(currentProgress);return}
 paint(currentProgress);frame=requestAnimationFrame(glide);
 }
 function follow(p){targetProgress=p;if(reduced||currentProgress===null){currentProgress=p;paint(p);return}if(!frame&&Math.abs(p-currentProgress)>.0008)frame=requestAnimationFrame(glide)}
 function measure(){if(sticky&&scene){
 sticky.style.transform='';const padding=parseFloat(getComputedStyle(daylight).paddingTop),center=scene.offsetTop+scene.offsetHeight/2;
 sticky.style.setProperty('--scene-center',center+'px');start=daylight.getBoundingClientRect().top+scrollY+padding+center-innerHeight/2;
 travel=Math.max(innerHeight*.8,daylight.offsetHeight-sticky.offsetHeight-padding*2);sunTravel=scene.offsetHeight*1.25;
 }}
 function update(){
 if(say){const r=say.getBoundingClientRect(),progress=Math.max(0,Math.min(1,(innerHeight*.85-r.top)/(r.height+innerHeight*.25))),next=reduced?words.length:Math.round(progress*words.length);if(next!==wordCount){words.forEach((word,i)=>word.classList.toggle('on',i<next));wordCount=next}}
 if(pilot&&!reduced){const progress=scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight);pilot.classList.toggle('on',scrollY>innerHeight*.35);pilot.style.transform='translate('+(innerWidth/2+innerWidth*.3*Math.sin(progress*Math.PI*7))+'px,'+(innerHeight*.62+innerHeight*.12*Math.sin(progress*Math.PI*11+1))+'px)'}
 if(!scene)return;const p=Math.max(0,Math.min(1,(scrollY-start)/travel));
 follow(p);
 }
 let queued=false;addEventListener('scroll',()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update()})},{passive:true});addEventListener('resize',()=>{measure();update()});document.fonts?.ready.then(()=>{measure();update()});root.querySelectorAll('img').forEach(image=>{if(!image.complete)image.addEventListener('load',()=>{measure();update()},{once:true})});measure();update();
});
// Retain the standalone introduction's section navigation.
const nav=document.querySelector('.nav .links');if(nav){const links=[...nav.querySelectorAll('a[href^="#"]')],pill=document.createElement('i');pill.className='pill';nav.append(pill);function active(){let selected=-1;links.forEach((link,i)=>{if(document.querySelector(link.getAttribute('href')).getBoundingClientRect().top<innerHeight*.4)selected=i});links.forEach((link,i)=>link.classList.toggle('on',i===selected));if(selected<0){pill.style.opacity=0;return}const a=links[selected];pill.style.cssText=`left:${a.offsetLeft}px;top:${a.offsetTop}px;width:${a.offsetWidth}px;height:${a.offsetHeight}px;opacity:1`}addEventListener('scroll',active,{passive:true});addEventListener('resize',active);document.fonts?.ready.then(active);active()}
})();
