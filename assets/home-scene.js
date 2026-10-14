(function(){
const sec=document.getElementById('sky-story');if(!sec)return;
const $=q=>sec.querySelector(q),pin=$('.ss-pin'),intro=$('.ss-intro'),say=$('.ss-say'),frame=$('.ss-frame'),world=$('.ss-world'),guide=$('.ss-guide'),fin=$('.ss-final'),label=$('.ss-time'),canvas=$('.ss-canvas');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),e=(a,b,x)=>cl((x-a)/(b-a)),mix=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t);
say.querySelectorAll('.ln').forEach(l=>{l.replaceChildren(...l.textContent.split(' ').flatMap((w,i)=>{const s=document.createElement('span');s.className='w';s.textContent=w;return i?[document.createTextNode(' '),s]:[s]}))});
const words=[...say.querySelectorAll('.w')];

/* ---------- 3D scene ---------- */
function make(){
 if(!window.THREE)return null;let R;
 try{R=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'})}catch(x){return null}
 R.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 const S=new THREE.Scene(),fog=new THREE.Fog(0x7ca9c3,25,210);S.fog=fog;
 const C=new THREE.PerspectiveCamera(48,1,.1,500);
 const hemi=new THREE.HemisphereLight(0xbfdcff,0x1a2430,.9),sunL=new THREE.DirectionalLight(0xfff0d0,1.2),moonL=new THREE.DirectionalLight(0x8fb0e0,0),fill=new THREE.DirectionalLight(0xcfe3ff,.35);
 fill.position.set(-30,25,60);S.add(hemi,sunL,moonL,fill);
 [[-30,8,1.3,0x41596c],[-55,14,3.1,0x31495b],[-85,19,5.2,0x23364a],[-118,26,7.7,0x182736]].forEach(([z,amp,seed,col])=>{
  const g=new THREE.PlaneGeometry(340,50,110,14);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),zl=p.getZ(i);
   const n=Math.sin(x*.045+seed)*.5+Math.sin(x*.11+seed*2.3)*.3+Math.sin(x*.27+seed*4.1+zl*.2)*.2;
   p.setY(i,Math.max(0,n+.5)*amp*Math.min(1,(25-Math.abs(zl))/12))}
  g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:col,flatShading:true,roughness:1,metalness:0}));m.position.set(0,-3,z);S.add(m)});
 const glowTex=(()=>{const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),im=x.createImageData(N,N),d=im.data;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const r=Math.hypot(i-N/2+.5,j-N/2+.5)/(N/2),edge=r>=1?0:1-Math.pow(Math.min(1,Math.max(0,(r-.7)/.3)),2)*(3-2*Math.min(1,Math.max(0,(r-.7)/.3))),a=Math.exp(-r*r*5)*edge*255+(Math.random()-.5)*3,k=(j*N+i)*4;d[k]=d[k+1]=d[k+2]=255;d[k+3]=r>=1?0:Math.max(0,Math.min(255,a))}x.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;return t})();
 const moonTex=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#e2ecf5';x.fillRect(0,0,256,256);for(let i=0;i<28;i++){x.fillStyle='rgba(115,135,160,'+(.12+Math.random()*.2)+')';x.beginPath();x.arc(Math.random()*256,Math.random()*256,6+Math.random()*24,0,7);x.fill()}return new THREE.CanvasTexture(c)})();
 const glow=(col)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,dithering:true}));S.add(s);return s};
 const sunMat=new THREE.MeshBasicMaterial({color:0xfff2d0,fog:false}),sun=new THREE.Mesh(new THREE.SphereGeometry(6,32,24),sunMat),sunG=glow(0xffe0aa);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(4.6,40,30),new THREE.MeshStandardMaterial({map:moonTex,emissive:0x9fb4cc,emissiveMap:moonTex,emissiveIntensity:.55,roughness:1,fog:false})),moonG=glow(0x9cc8ff);
 S.add(sun,moon);
 const N=650,sp=new Float32Array(N*3);for(let i=0;i<N;i++){const a=(Math.random()-.5)*2.1,h=.04+Math.random()*.95,r=330;sp[i*3]=r*Math.cos(h)*Math.sin(a);sp[i*3+1]=r*Math.sin(h);sp[i*3+2]=-r*Math.cos(h)*Math.cos(a)}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
 const sm2=new THREE.PointsMaterial({color:0xffffff,size:1.7,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});S.add(new THREE.Points(sg,sm2));
 const pos=(az,el,r)=>{const a=az*Math.PI/180,h=el*Math.PI/180;return new THREE.Vector3(r*Math.cos(h)*Math.sin(a),r*Math.sin(h),-r*Math.cos(h)*Math.cos(a))};
 const cDay=new THREE.Color('#7ca9c3'),cDusk=new THREE.Color('#d38d5e'),cNight=new THREE.Color('#0b1626'),tmp=new THREE.Color(),sunWarm=new THREE.Color('#ff8f45'),gWarm=new THREE.Color('#ff8a40');
 let px=0,py=0,tx=0,ty=0;
 function resize(){const w=world.clientWidth,h=world.clientHeight;R.setSize(w,h,false);C.aspect=w/h;C.fov=w/h<1?66:48;C.updateProjectionMatrix()}
 resize();
 function render(s,p,t){
  const dusk=sm(cl(1-Math.abs(s-.45)/.3)),night=sm(cl((s-.45)/.35));
  const sEl=mix(26,-10,sm(e(0,.62,s))),mEl=mix(-12,30,sm(e(.45,1,s)));
  sun.position.copy(pos(14,sEl,200));sunG.position.copy(sun.position);moon.position.copy(pos(-16,mEl,200));moonG.position.copy(moon.position);
  sunMat.color.set(0xfff2d0).lerp(sunWarm,dusk);sunG.material.color.set(0xffe0aa).lerp(gWarm,dusk);sunG.scale.setScalar(mix(70,130,dusk)*(1-night*.6));
  moonG.scale.setScalar(46);moonG.material.opacity=night*.8;moon.rotation.y=t*.00005;
  sunL.position.copy(sun.position);sunL.intensity=cl((sEl+8)/20)*1.3;sunL.color.set(0xfff0d0).lerp(sunWarm,dusk);
  moonL.position.copy(moon.position);moonL.intensity=night*.5;
  fog.color.copy(cDay).lerp(cDusk,dusk).lerp(cNight,night);hemi.color.copy(fog.color).lerp(new THREE.Color(0xffffff),.25*(1-night));hemi.intensity=mix(.9,.28,night);fill.intensity=mix(.35,.12,night);
  sm2.opacity=night*night;
  px+=(tx-px)*.04;py+=(ty-py)*.04;const bob=reduced?0:Math.sin(t*.0004)*.15;
  C.position.set(px*2.2,4+bob-py*.6,mix(16,3,e(.3,1,p)));C.lookAt(px*3,9.5,-100);
  R.render(S,C)}
 return{resize,render}}
let three=null;try{three=make()}catch(x){three=null}

/* ---------- scroll choreography ---------- */
let done=false,seen=false,top=0,travel=1,cur=0,tgt=0,vis=false,raf=0,last=0,wc=-1,phase='',applied=-1;
function measure(){top=sec.getBoundingClientRect().top+scrollY;travel=Math.max(1,sec.offsetHeight-innerHeight)}
function apply(p,t){
 const ti=e(.25,.32,p);intro.style.opacity=1-ti;intro.style.transform='scale('+(1-.08*ti)+')';intro.style.filter='none';intro.style.visibility=ti>=1?'hidden':'';
 const g=1-Math.pow(1-e(.3,.45,p),3),sx=innerWidth<700?20:34,sy=36;
 frame.style.opacity=e(.27,.31,p);frame.style.clipPath='inset('+sy*(1-g)+'% '+sx*(1-g)+'% '+sy*(1-g)+'% '+sx*(1-g)+'% round '+22*(1-g)+'px)';
 const s=e(.5,.88,p),b=e(.88,.97,p),dusk=sm(cl(1-Math.abs(s-.45)/.3)),night=sm(cl((s-.45)/.35));
 world.style.setProperty('--dusk',dusk.toFixed(3));world.style.setProperty('--night',night.toFixed(3));
 world.style.transform='scale('+(1.5-.5*g)+')';world.style.filter=b?'blur('+b*14+'px) brightness('+(1-.4*b)+')':'';
 const gd=e(.46,.52,p)*(1-e(.56,.62,p));guide.style.opacity=gd;guide.style.transform='translateY('+(1-gd)*18+'px)';
 const fi=e(.9,.99,p);fin.style.opacity=fi;fin.style.filter=fi<1?'blur('+(1-fi)*14+'px)':'';fin.style.transform='scale('+(.96+.04*fi)+')';
 label.style.opacity=e(.5,.54,p)*(1-b);const ph=s<.25?'낮':s<.62?'해 질 무렵':'밤';if(ph!==phase){phase=ph;label.textContent=ph}
 if(three&&p>.26)three.render(s,p,t||0)}
function words_(){const wp=cl((scrollY-(top-innerHeight*.55))/(innerHeight*.55+travel*.2)),n=(reduced||done)?words.length:Math.round(wp*words.length);if(n!==wc){words.forEach((w,i)=>w.classList.toggle('on',i<n));wc=n}}
function tick(now){
 if(!vis){raf=0;return}
 const dt=last?Math.min(50,now-last):16;last=now;cur=reduced?tgt:cur+(tgt-cur)*(1-Math.exp(-dt/120));if(Math.abs(tgt-cur)<.0004)cur=tgt;
 if(cur!==applied||(three&&cur>.26)){applied=cur;apply(cur,now)}
 raf=requestAnimationFrame(tick)}
function onScroll(){tgt=cl((scrollY-top)/travel);if(!seen&&tgt>=1)done=true;if(done)tgt=1;words_();if(vis&&!raf){last=0;raf=requestAnimationFrame(tick)}}
new IntersectionObserver(es=>{vis=es[0].isIntersecting;if(vis&&!raf){last=0;raf=requestAnimationFrame(tick)}},{rootMargin:'120px'}).observe(sec);
addEventListener('scroll',onScroll,{passive:true});
function relayout(){measure();three&&three.resize();onScroll();applied=-1}
addEventListener('resize',relayout);addEventListener('load',relayout);document.fonts&&document.fonts.ready.then(relayout);
measure();onScroll();cur=tgt;apply(cur,0);
})();
