(function(){
const scene=document.querySelector('.perspective-scene'),caption=document.querySelector('#view-caption'),buttons=document.querySelectorAll('[data-view][type="button"]');
const captions={close:'가까이에서, 지나쳤던 풍경의 표정을 발견합니다.',above:'한 걸음 위에서, 풍경의 흐름을 바라봅니다.',wide:'조금 멀리서, 풍경과 주변을 함께 담습니다.'};
buttons.forEach(button=>button.addEventListener('click',()=>{scene.dataset.view=button.dataset.view;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));caption.textContent=captions[button.dataset.view]}));
const slider=document.querySelector('#daylight'),sky=document.querySelector('.light-scene'),label=document.querySelector('.light-time');
function color(from,to,t){return 'rgb('+from.map((v,i)=>Math.round(v+(to[i]-v)*t)).join(',')+')'}
function update(){const t=Number(slider.value)/100;sky.style.setProperty('--sky-top',color([116,66,49],[34,71,103],t));sky.style.setProperty('--sky-bottom',color([226,143,87],[124,169,195],t));sky.style.setProperty('--sun-y',(72-t*52)+'%');sky.querySelector('.light-sun').style.left=(25+t*40)+'%';const text=t<.35?'해 질 무렵':t<.7?'부드러운 오후의 빛':'맑은 한낮';label.textContent=text;slider.setAttribute('aria-valuetext',text)}
slider.addEventListener('input',update);update();
})();
