import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Desktop startup used to throw before rendering anything: the object literal
// eagerly evaluated `notify: toast` while `const toast` was still in its TDZ.
// Keep testing the binding as authored rather than a duplicated implementation.
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const snippet = main.match(/getHostOptions:\(\)=>extensionHostOptions,storage:localStorage,notify:([^,\n]+),/);

test('desktop workspace notifier does not read toast before it is initialized', () => {
  assert.ok(snippet, 'native workspace notifier binding must remain discoverable');
  assert.ok(main.indexOf('const detachedWorkspaces=') < main.indexOf('const toast='),
    'exercise actual startup declaration order');
  const messages = [];
  assert.doesNotThrow(() => vm.runInNewContext(`
    const nativeDesktop = true;
    const desktop = nativeDesktop ? {notify: ${snippet[1]}} : null;
    const toast = message => messages.push(message);
    desktop.notify('workspace warning');
  `, {messages}), 'native path must initialize without a ReferenceError');
  assert.deepEqual(messages, ['workspace warning']);
});

test('deferred notification also handles a later workspace failure', () => {
  assert.ok(snippet);
  const messages = [];
  vm.runInNewContext(`
    const workspace = {notify: ${snippet[1]}};
    const toast = message => messages.push(message);
    workspace.notify('Application window failed');
  `, {messages});
  assert.deepEqual(messages, ['Application window failed']);
});
