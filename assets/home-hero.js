(function(){
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){var sections=document.querySelectorAll('.home-reveal'),observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}})},{threshold:.08});sections.forEach(function(section){section.classList.add('ready');observer.observe(section)})}
var drone=document.querySelector('.drone-stage img'),fleet=[{src:'assets/drone-neo2.webp',width:286,height:114},{src:'assets/drone.webp',width:640,height:329},{src:'assets/drone-avata360.webp',width:274,height:115}],chosen=fleet[Math.floor(Math.random()*fleet.length)];drone.width=chosen.width;drone.height=chosen.height;drone.src=chosen.src;

})();
