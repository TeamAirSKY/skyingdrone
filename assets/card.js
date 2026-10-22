(function(){
const status=document.querySelector('#card-status'),card=document.querySelector('#crew-card');
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function asset(value){return value.startsWith('assets/')?'/'+value:value}
function safeLink(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!/[\s\\]/u.test(value)}catch{return false}}
let shareURL='';
function render(member,catalog){
 document.title=member.name+' · 전자명함 | AIR SKY';
 document.querySelector('meta[name="description"]').content=member.name+' — '+member.bio.slice(0,140);
 document.querySelector('#card-name').textContent=member.name;
 const department={filming:'촬영팀',planning:'기획팀',editing:'편집팀'}[member.department];
 document.querySelector('#card-role').textContent=[member.owner?'Team Owner':member.coOwner?'Co-owner':'Crew',department,member.leader?'Team Leader':''].filter(Boolean).join(' / ');
 const photo=document.querySelector('#card-photo'),placeholder=()=>photo.replaceChildren(node('span',member.name.slice(0,2)));
 if(member.photo){const image=node('img');image.src=asset(member.photo);image.alt=member.name+' 프로필';image.addEventListener('error',placeholder,{once:true});photo.append(image)}else placeholder();
 const bio=document.querySelector('#card-bio');member.bio.split(/\n+/).filter(Boolean).forEach(line=>bio.append(node('p',line)));if(!bio.children.length)bio.append(node('p','소개를 준비하고 있습니다.'));
 const keys=[...new Set(member.equipment)].filter(key=>catalog[key]);document.querySelector('#card-fleet-count').textContent=String(keys.length).padStart(2,'0');
 const fleet=document.querySelector('#card-fleet');for(const key of keys){const drone=catalog[key],figure=node('figure',undefined,'card-drone'),image=node('img');image.src=asset(drone.image);image.alt=drone.name;image.loading='lazy';image.style.objectFit=drone.fit||'contain';figure.append(image,node('figcaption',drone.name));fleet.append(figure)}
 if(!keys.length)fleet.append(node('p','등록된 기체가 없습니다.','hint'));
 const links=document.querySelector('#card-links');for(const link of member.links||[]){if(!safeLink(link.url))continue;const a=node('a');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';a.append(node('span',link.label),node('span','↗'));a.setAttribute('aria-label',link.label+' (새 창)');links.append(a)}document.querySelector('#card-links-section').hidden=!links.children.length;
 shareURL=new URL('/card/'+encodeURIComponent(member.id),location.origin).href;
 status.hidden=true;card.hidden=false;
}
const feedback=document.querySelector('#share-status');
async function copy(){try{await navigator.clipboard.writeText(shareURL);feedback.textContent='명함 주소를 복사했습니다.'}catch{feedback.replaceChildren(node('span','아래 주소를 길게 누르거나 선택해 복사해주세요. '));const address=node('a',shareURL);address.href=shareURL;feedback.append(address)}}
document.querySelector('#copy-card').addEventListener('click',copy);
document.querySelector('#share-card').addEventListener('click',async()=>{if(!navigator.share)return copy();try{await navigator.share({title:document.title,url:shareURL});feedback.textContent='명함을 공유했습니다.'}catch(error){if(error.name!=='AbortError')await copy()}});
async function load(){
 try{const path=location.pathname.match(/^\/card\/([a-z0-9][a-z0-9_-]{0,63})\/?$/),id=path?.[1]||new URLSearchParams(location.search).get('id');if(!id||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id))throw Error('NOT_FOUND');
 const response=await fetch('/api/crew-roster?card='+encodeURIComponent(id)),data=await response.json();if(response.status===404)throw Error('NOT_FOUND');if(!response.ok||!data.member)throw Error('UNAVAILABLE');render(data.member,data.catalog||{});
 }catch(error){const missing=error.message==='NOT_FOUND';status.replaceChildren(node('p','AIR SKY / CREW CARD','eyebrow'),node('h1',missing?'명함을 찾을 수 없습니다.':'잠시 연결이 어렵습니다.'),node('p',missing?'주소를 확인해주세요. 비공개 또는 삭제된 크루의 명함은 표시되지 않습니다.':'연결을 확인한 후 다시 시도해주세요.'));const retry=node('button','다시 불러오기','button');retry.type='button';retry.addEventListener('click',()=>location.reload());const back=node('a','크루 소개로 이동 ↗','button secondary');back.href='/crew.html';status.append(retry,document.createTextNode(' '),back)}
}
load();
})();
