export const DIRECT_MESSAGE_LIMIT=1000;
export const LOBBY_MESSAGE_LIMIT=320;

export function messageLimit(peer){return peer==='lobby'?LOBBY_MESSAGE_LIMIT:DIRECT_MESSAGE_LIMIT;}
export function composerState(text,limit=DIRECT_MESSAGE_LIMIT){
  const value=String(text??'');
  const length=[...value].length;
  const remaining=limit-length;
  return {
    length,limit,remaining,over:remaining<0,near:remaining>=0&&remaining<=100,
    label:`${length} / ${limit}`,
    error:remaining<0?`Message is ${length.toLocaleString('en-US')} characters; maximum is ${limit.toLocaleString('en-US')}.`:''
  };
}
export function messageReceipt(message,myId,{peerDeliveredId=0,peerReadId=0}={}){
  const id=Number.isSafeInteger(message?.id)?message.id:0;
  if(!id||message?.authorId!==myId)return null;
  if(Number.isSafeInteger(peerReadId)&&peerReadId>=id)return 'Seen';
  if(Number.isSafeInteger(peerDeliveredId)&&peerDeliveredId>=id)return 'Delivered';
  return 'Sent';
}
