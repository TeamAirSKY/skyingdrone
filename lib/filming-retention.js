const DAY=86400000;
function apply(record,status,now=Date.now()){
 const wasClosed=['completed','rejected'].includes(record.status),closed=['completed','rejected'].includes(status);
 if(closed){if(!wasClosed||!Number.isFinite(Date.parse(record.deleteAfter))){record.closedAt=new Date(now).toISOString();record.deleteAfter=new Date(now+30*DAY).toISOString()}}
 else{delete record.closedAt;delete record.deleteAfter}
 record.status=status;return record;
}
function expiresAt(key,record,fallback){if(!key.startsWith('airsky:request:'))return fallback;const value=record.deleteAfter?Date.parse(record.deleteAfter):Date.parse(record.createdAt)+180*DAY;return Number.isFinite(value)?value:fallback}
module.exports={apply,expiresAt};
