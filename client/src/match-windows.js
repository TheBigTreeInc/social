/** Opaque, session-free match window identities. Authorization stays in Social. */
export function isValidMatchRoom(roomId) {
  return typeof roomId === 'string' && /^[a-f0-9]{64}$/.test(roomId);
}
export function matchWindowLabel(roomId) {
  if (!isValidMatchRoom(roomId)) throw Error('Invalid match room');
  return `match-${roomId}`;
}
