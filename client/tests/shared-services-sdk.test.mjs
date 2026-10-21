import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTaviExtensionSDK} from '../extension-sdk/index.js';
import {createTaviServiceSDK} from '../extension-sdk/service.js';
import {createExtensionHost} from '../src/extensions/host.js';

test('browser SDK exposes actual grants and fails closed on undistributed shared services',async()=>{
 const hostListeners=new Map();
 const childListeners=new Map();
 const source={addEventListener:(name,fn)=>childListeners.set(name,fn),removeEventListener:name=>childListeners.delete(name)};
 const parent={postMessage:(data)=>hostListeners.get('message')({source:frame.contentWindow,origin:'null',data})};
 const frame={contentWindow:{postMessage:(data)=>childListeners.get('message')({source:parent,origin:'https://tavi.example',data})}};
 const host=createExtensionHost({windowRef:{addEventListener:(name,fn)=>hostListeners.set(name,fn),removeEventListener:name=>hostListeners.delete(name)},
  storage:{getItem:()=>null,setItem:()=>{}},notify:()=>{},close:()=>{}});
 host.mount(frame,{id:'org.tavi.examples.test',permissions:['ui.panel','storage.private'],scope:'realm:subject'});
 const client=createTaviExtensionSDK(parent,source);
 assert.deepEqual(await client.capabilities(),['ui.panel','storage.private']);
 assert.equal((await client.info()).extensionId,'org.tavi.examples.test');
 await assert.rejects(client.wallet.balance({currencyId:'tavi:cash'}),/first-party Wallet/);
 await assert.rejects(client.contacts.list(),/Unsupported extension method/);
 await assert.rejects(client.messages.send({peerId:'acct_other',content:'hi',idempotencyKey:'req-1'}),/Unsupported extension method/);
 client.dispose();host.dispose();
});

test('service SDK is pure transport facade and never fabricates a credential or balance',async()=>{
 assert.throws(()=>createTaviServiceSDK(),/transport/);
 const calls=[];
 const client=createTaviServiceSDK({call:async req=>{calls.push(req);return {status:'authorized-by-mock'};}});
 await client.wallet.balance({subject:'acct_1',currencyId:'tavi:cash'});
 await client.wallet.reward({subject:'acct_1',currencyId:'tavi:cash',amountMinor:'250',idempotencyKey:'one-time-result-v1',reason:'win'});
 await client.contacts.list({subject:'acct_1'});
 assert.deepEqual(calls.map(x=>[x.capability,x.operation]),[
  ['wallet.read','balance'],['wallet.reward.propose','reward'],['contacts.read','list']
 ]);
 assert.equal(JSON.stringify(calls).includes('Bearer'),false);
 assert.throws(()=>client.pets.command('unsafe'),/arguments/);
});

test('shipping v1 manifest stays restrictive while future v2 schema is clearly separate',async()=>{
 const code=await readFile(new URL('../src/extensions/contract.js',import.meta.url),'utf8');
 const schema=JSON.parse(await readFile(new URL('../../schemas/tavi.extension.v2.schema.json',import.meta.url),'utf8'));
 const example=JSON.parse(await readFile(new URL('../../docs/extension-examples/companions.v2.future.json',import.meta.url),'utf8'));
 assert(schema.properties.schema.const==='tavi.extension/v2');
 assert(example.serviceBindings.some(binding=>binding.component==='tavi-companions'));
 assert(!code.includes("'wallet.read'"));
 assert(!code.includes("'tavi.extension/v2'"));
});
