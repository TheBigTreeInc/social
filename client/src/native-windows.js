/** Safe, deterministic native conversation window identity (no credentials in URL). */
export function isValidChatPeer(peer) {
  return peer === 'lobby' || (typeof peer === 'string' && /^acct_[1-9][0-9]{0,18}$/.test(peer));
}
export function chatWindowLabel(peer) {
  if (!isValidChatPeer(peer)) throw Error('Invalid chat peer');
  return `chat-${peer}`;
}
