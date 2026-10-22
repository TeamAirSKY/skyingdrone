(()=>{
const labels={organization:'소속',role:'역할',bio:'소개',phone:'전화번호',email:'이메일',links:'링크',extras:'추가 정보'};
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
function isIPhone(){return /iPhone|iPod/.test(navigator.userAgent)&&!/Android/.test(navigator.userAgent)}
function render(target,card){
 const view=el('article',undefined,'card-view');view.setAttribute('aria-label',card.name+' 전자명함');
 for(const [key,value] of Object.entries(card.theme))if(['background','accent','text'].includes(key))view.style.setProperty('--card-'+(key==='background'?'bg':key),value);
 if(card.cover){const img=el('img',undefined,'card-cover');img.src=card.cover;img.alt='커버 사진';img.style.objectPosition=card.theme.coverX+'% '+card.theme.coverY+'%';view.append(img)}
 const face=el('div',undefined,'card-face'),brand=el('div',undefined,'card-topline');brand.append(el('span','AIRSKY','card-wordmark'),el('span','DIGITAL CARD','card-edition'));face.append(brand);
 const identity=el('div',undefined,'card-identity');identity.dataset.align=card.theme.photoAlign;
 if(card.profile){const img=el('img',undefined,'card-profile');img.src=card.profile;img.alt=card.name+' 프로필 사진';img.style.objectPosition=card.theme.profileX+'% '+card.theme.profileY+'%';identity.append(img)}
 const identityFields=[];for(const field of card.order){if(!['organization','role'].includes(field))break;identityFields.push(field)}
 const name=el('div',undefined,'card-name');name.append(el('h1',card.name||'내 이름'));const byline=identityFields.map(field=>card[field]).filter(Boolean);if(byline.length)name.append(el('p',byline.join(' · '),'card-byline'));identity.append(name);face.append(identity);view.append(face);
 const details=el('div',undefined,'card-details');
 for(const field of card.order){
  if(identityFields.includes(field))continue;
  if(['links','extras'].includes(field)){for(const row of card[field]||[]){if(field==='links'){const a=el('a',undefined,'card-link');a.append(el('span',row.title),el('span','↗','link-arrow'));a.href=row.url;a.target='_blank';a.rel='noopener noreferrer';details.append(a)}else{const block=el('section',undefined,'card-field card-extra');block.append(el('h2',row.title),el('p',row.content));details.append(block)}}}
  else if(card[field]){const block=el('div',undefined,'card-field'+(field==='bio'?' card-bio':''));if(field!=='bio')block.append(el('span',labels[field],'label'));if(['phone','email'].includes(field)){const a=el('a',card[field]);a.href=field==='phone'?'tel:'+card[field].replace(/[^+0-9]/g,''):'mailto:'+card[field];block.append(a)}else block.append(el('div',card[field]));details.append(block)}
 }
 if(details.childNodes.length)view.append(details);target.replaceChildren(view);
}
async function copy(value){try{await navigator.clipboard.writeText(value)}catch{const input=el('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();const success=document.execCommand('copy');input.remove();if(!success)throw Error('복사할 수 없습니다. 표시된 주소를 길게 눌러 복사해주세요.')}}
window.CardView={render,labels,el,isIPhone,copy};
})();
