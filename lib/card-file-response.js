// Stream binary responses instead of buffering a >4.5MB function payload.
module.exports=async(res,buffer)=>{
 res.status(200);
 if(typeof res.write!=='function')return res.end(buffer);
 for(let offset=0;offset<buffer.length;offset+=64*1024){if(!res.write(buffer.subarray(offset,offset+64*1024)))await new Promise((resolve,reject)=>{const done=()=>{res.off('close',closed);resolve()},closed=()=>{res.off('drain',done);reject(Error('RESPONSE_CLOSED'))};res.once('drain',done);res.once('close',closed)})}
 return res.end();
};
