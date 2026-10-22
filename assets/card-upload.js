window.CardUpload={async send(api,file,fields){
 if(!file||file.size<1||file.size>10*1024*1024)throw Error('파일은 10MB 이하로 올려주세요.');
 const init=await api('POST',{...fields,action:'upload-init',filename:file.name,size:file.size});let complete=false;
 try{for(let start=0,index=0;start<file.size;start+=init.chunkSize,index++){
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(file.slice(start,start+init.chunkSize))});
  await api('POST',{...fields,action:'upload-part',uploadId:init.uploadId,index,base64});
 }const result=await api('POST',{...fields,action:'upload-complete',uploadId:init.uploadId});complete=true;return result;
 }finally{if(!complete)await api('POST',{...fields,action:'upload-cancel',uploadId:init.uploadId}).catch(()=>{})}
}};
