(function(){
const form=document.querySelector('#request-form'),address=document.querySelector('#address'),message=document.querySelector('#form-message'),button=document.querySelector('#search-address'),map=document.querySelector('#map-link');
button.addEventListener('click',()=>{
 if(!window.daum?.Postcode){message.textContent='주소 검색을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.';return}
 new daum.Postcode({oncomplete(data){
 const selected=data.roadAddress||data.jibunAddress;
 if(!selected){message.textContent='주소를 확인할 수 없습니다. 다시 선택해주세요.';return}
 address.value=selected;map.href='https://map.kakao.com/?q='+encodeURIComponent(selected);map.hidden=false;message.textContent='';
 }}).open();
});
form.addEventListener('submit',async e=>{
 e.preventDefault();message.textContent='';
 if(!address.value){message.textContent='주소 검색으로 촬영 위치를 선택해주세요.';button.focus();return}
 if(!form.reportValidity())return;
 if(form.instagram.value.trim()&&!document.querySelector('#instagram-agreed').checked){message.textContent='인스타그램 안내를 원하시면 선택 정보 수집·이용에 동의해주세요.';document.querySelector('#instagram-agreed').focus();return}
 const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='접수 중…';
 try{
 const response=await fetch('/api/filming-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:form.nickname.value,instagram:form.instagram.value,instagramAgreed:document.querySelector('#instagram-agreed').checked,address:address.value,details:form.details.value,notes:form.notes.value,website:form.website.value,agreed:document.querySelector('#agreed').checked})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'접수하지 못했습니다. 다시 시도해주세요.');
 form.hidden=true;document.querySelector('#success').hidden=false;document.querySelector('#receipt').textContent=data.id;
 }catch(error){message.textContent=error.message==='Failed to fetch'?'연결을 확인하고 다시 시도해주세요.':error.message}
 finally{submit.disabled=false;submit.textContent='촬영 신청하기'}
});
})();
