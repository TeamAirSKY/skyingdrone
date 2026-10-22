(async()=>{
 const status=document.querySelector('#status');
 try{
  const id=new URLSearchParams(location.search).get('id');if(!id)throw Error('명함 주소를 확인해주세요.');
  const response=await fetch('/api/business-cards?id='+encodeURIComponent(id),{cache:'no-store'}),result=await response.json();if(!response.ok)throw Error(result.error);
  document.title=result.card.name+' · AIRSKY 명함';CardView.render(document.querySelector('#public-card'),result.card);
  const qrSrc='/api/business-cards?id='+encodeURIComponent(id)+'&qr=1';
  document.querySelector('#save-image').onclick=()=>CardActions.save(result.card,result.publicURL,qrSrc);
  status.textContent='';document.querySelector('#public-actions').hidden=false;
 }catch(error){status.textContent=error.message||'명함을 불러오지 못했습니다.';status.classList.add('error')}
})();
