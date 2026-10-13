(function(){
const scene=document.querySelector('.perspective-scene'),caption=document.querySelector('#view-caption'),buttons=document.querySelectorAll('[data-view][type="button"]');
const height=document.querySelector('#view-height'),heightLabel=document.querySelector('#height-label');
function setHeight(value){const t=Number(value)/100;scene.style.setProperty('--terrain-scale',String(3.1-2.25*t));scene.style.setProperty('--terrain-y',(85*t)+'px');scene.style.setProperty('--sea-opacity',String(t));scene.style.setProperty('--distant-opacity',String(.15+.85*t));height.value=String(value);const view=t<.3?'close':t>.75?'wide':'above';scene.dataset.view=view;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));const label=t<.3?'낮게':t>.75?'높게':'중간';heightLabel.textContent=label;height.setAttribute('aria-valuetext',label);caption.textContent=t<.3?'가까이에서 도시와 강의 세부 모습을 봅니다.':t>.75?'높이 올라가면 해안선 너머 바다와 먼 섬까지 펼쳐집니다.':'도시 뒤로 이어지는 해안과 산의 윤곽이 드러납니다.'}
buttons.forEach(button=>button.addEventListener('click',()=>setHeight({close:0,above:50,wide:100}[button.dataset.view])));height.addEventListener('input',()=>setHeight(height.value));setHeight(50);
const slider=document.querySelector('#daylight'),sky=document.querySelector('.light-scene'),label=document.querySelector('.light-time');
function color(from,to,t){return 'rgb('+from.map((v,i)=>Math.round(v+(to[i]-v)*t)).join(',')+')'}
function update(){const t=Number(slider.value)/100;sky.style.setProperty('--sky-top',color([116,66,49],[34,71,103],t));sky.style.setProperty('--sky-bottom',color([226,143,87],[124,169,195],t));sky.style.setProperty('--sun-y',(72-t*52)+'%');sky.querySelector('.light-sun').style.left=(25+t*40)+'%';const text=t<.35?'해 질 무렵':t<.7?'부드러운 오후의 빛':'맑은 한낮';label.textContent=text;slider.setAttribute('aria-valuetext',text)}
slider.addEventListener('input',update);update();
})();
