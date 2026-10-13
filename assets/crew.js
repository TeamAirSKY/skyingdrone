(function(){
if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}})},{threshold:.12});
document.querySelectorAll('.crew-member').forEach(member=>{member.classList.add('reveal-ready');observer.observe(member)});
})();
