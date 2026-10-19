/**
 * Transport-neutral SDK for trusted LoopRD service components and headless
 * tests. This code is NOT authentication: operators provision their own
 * authenticated request transport and the destination LoopRD service must
 * enforce grants, authorization, ownership, idempotency, and input validation.
 */
export function createTaviServiceSDK({call}={}) {
 if(typeof call!=='function')throw Error('An authorized LoopRD service transport is required');
 const invoke=(capability,operation,args={})=>{
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Command arguments must be an object');
  return Promise.resolve().then(()=>call({capability,operation,args}));
 };
 return Object.freeze({
  wallet:Object.freeze({
   balance:args=>invoke('wallet.read','balance',args),
   transactions:args=>invoke('wallet.read','transactions',args),
   transfer:args=>invoke('wallet.transfer.request','transfer',args),
   reward:args=>invoke('wallet.reward.propose','reward',args)
  }),
  pets:Object.freeze({
   list:args=>invoke('pets.read','list',args),
   get:args=>invoke('pets.read','get',args),
   command:args=>invoke('pets.command','command',args)
  }),
  contacts:Object.freeze({list:args=>invoke('contacts.read','list',args)}),
  messages:Object.freeze({
   list:args=>invoke('messages.read','list',args),
   send:args=>invoke('messages.send','send',args)
  }),
  events:Object.freeze({list:args=>invoke('events.subscribe','list',args)}),
  games:Object.freeze({sessions:args=>invoke('games.sessions','list',args)})
 });
}
