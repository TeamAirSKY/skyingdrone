(function(){
const form=document.querySelector('#request-form'),address=document.querySelector('#address'),message=document.querySelector('#form-message'),button=document.querySelector('#search-address'),map=document.querySelector('#map-link');
const submit=form.querySelector('[type="submit"]');let captchaId=null,captchaRequired=false,captchaReady=false;
async function setupCaptcha(){
 submit.disabled=true;
 try{
  const response=await fetch('/api/request-config'),config=await response.json();if(!response.ok)throw Error('인증 설정을 불러오지 못했습니다. 새로고침해주세요.');
  if(config.open===false){form.hidden=true;const notice=document.querySelector('#intake-notice');notice.hidden=false;notice.textContent=config.message;return}
  captchaRequired=config.required;
  if(!config.required){captchaReady=true;submit.disabled=false;return}
  if(!config.ready)throw Error('신청 인증 설정을 준비 중입니다. 잠시 후 다시 방문해주세요.');
  document.querySelector('#captcha-slot').hidden=false;
  window.airSkyCaptchaLoaded=()=>{captchaId=grecaptcha.render('recaptcha',{sitekey:config.siteKey,theme:'dark',size:window.innerWidth<360?'compact':'normal',callback:()=>{message.textContent=''},'expired-callback':()=>{message.textContent='인증이 만료되었습니다. 다시 인증해주세요.'},'error-callback':()=>{message.textContent='인증 연결을 확인하고 다시 시도해주세요.'}});captchaReady=true;submit.disabled=false};
  const script=document.createElement('script');script.src='https://www.google.com/recaptcha/api.js?onload=airSkyCaptchaLoaded&render=explicit&hl=ko';script.async=true;script.defer=true;script.onerror=()=>{message.textContent='인증을 불러오지 못했습니다. 연결을 확인하고 새로고침해주세요.'};document.head.append(script);
 }catch(error){message.textContent=error.message}
}
setupCaptcha();
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
 if(!captchaReady){message.textContent='인증 설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.';return}
 const recaptchaToken=captchaRequired?grecaptcha.getResponse(captchaId):'';
 if(captchaRequired&&!recaptchaToken){message.textContent='로봇이 아닙니다 인증을 완료해주세요.';return}
 submit.disabled=true;submit.textContent='접수 중…';
 try{
 const response=await fetch('/api/filming-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recaptchaToken,nickname:form.nickname.value,instagram:form.instagram.value,instagramAgreed:document.querySelector('#instagram-agreed').checked,address:address.value,details:form.details.value,notes:form.notes.value,website:form.website.value,agreed:document.querySelector('#agreed').checked})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'접수하지 못했습니다. 다시 시도해주세요.');
 form.hidden=true;document.querySelector('#success').hidden=false;document.querySelector('#receipt').textContent=data.id;document.querySelector('#receipt-status-link').href='receipt.html#'+new URLSearchParams({kind:'filming',id:data.id});
 }catch(error){message.textContent=error.message==='Failed to fetch'?'연결을 확인하고 다시 시도해주세요.':error.message}
 finally{if(captchaId!==null&&window.grecaptcha)grecaptcha.reset(captchaId);submit.disabled=false;submit.textContent='촬영 신청하기'}
});
})();
