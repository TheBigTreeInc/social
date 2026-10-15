/** Safe, deterministic native conversation window identity (no credentials in URL). */
export function isValidChatPeer(peer) {
  return peer === 'lobby' || (typeof peer === 'string' && /^[a-zA-Z0-9_-]{8,72}$/.test(peer));
}
export function chatWindowLabel(peer) {
  if (!isValidChatPeer(peer)) throw Error('Invalid chat peer');
  return `chat-${peer}`;
}
