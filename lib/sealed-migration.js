// Temporary, expiring, owner-only encrypted migration. No plaintext secret response.
const crypto=require('node:crypto'),s=require('./server'),access=require('./admin-access');
const manifest={"publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA3uaTJwWedA66qGr7oGgy\n+k9GWMQbO0axtR4uSSayHjt1yo5tWgnmgeUyPmO9wDzcfOCdygwMugp2z0Wc8Vu/\nE8ufxYjNAmcANyDCDlme+7K8eeSbatGLnWSFC8ZBuvQeQE1NAsvPww1ejltDxKDl\n9KXfEAaNSNiysP4P2m+CT9KtX2NuaZXbwGZlYfIkzfuHU/o3G60I/uEdr1H5mSrs\nqi+1skfEN5LMBVIzsj4SJVpmw8JZk2pxFmkgW7ziJ86+jWHaWPlJPpr7qYIni+kq\n8V072oUtmxBtbE07f3eIfJyYm+YFysjfj/sWU3HsHQQGgfMfl0WtuB9wEmI1spGR\nsnJ/nVn8sNrTrafjMrb897N+jMsSWysCeHnPqPXPiwu0m/445/M/TtGD/tQv670F\nq7PVGTxR3kKec85Pt6yRY3ExbycHZu2vOPTW2Ktltu2BIczoH2yLZYFO6I9ATjrE\n7E79pr4mNG0RmtpQAmk8Nr0wP45R3/IMJjx4rAkWGC3lAgMBAAE=\n-----END PUBLIC KEY-----\n", "nonceHash": "f7ad7db36c9f0211610ce85563bca469d3dbb6403f36fa5933eb6773755db38e", "expiresAt": 1791967592234};
module.exports=async(req,res)=>{
 if(process.env.VERCEL_PROJECT_ID!=='prj_OeeNTAqm9h6LYfolQi3icvCq6pe8'||Date.now()>manifest.expiresAt)return s.send(res,410,{error:'Migration unavailable'});
 if(!await access.requireAccess(req,res,'owner'))return;
 const nonce=s.body(req)?.nonce;
 if(typeof nonce!=='string'||!s.safeEqual(crypto.createHash('sha256').update(nonce).digest('hex'),manifest.nonceHash))return s.send(res,403,{error:'Migration unavailable'});
 try{
 if(await s.limited(req,'sealed-migration',5,3600))return s.send(res,429,{error:'Migration limited'});
 const names=['ADMIN_PIN','ADMIN_SESSION_SECRET','ADMIN_AUDIT_SECRET','CRON_SECRET','RECAPTCHA_SITE_KEY','RECAPTCHA_SECRET_KEY'];
 const values=Object.fromEntries(names.map(key=>[key,process.env[key]]));if(names.some(key=>!values[key]))throw Error('Missing configuration');
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(values)),cipher.final()]);
 return s.send(res,200,{key:crypto.publicEncrypt({key:manifest.publicKey,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')});
 }catch{return s.send(res,503,{error:'Migration failed'})}
};
