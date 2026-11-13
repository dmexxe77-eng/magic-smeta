import test from 'node:test';
import assert from 'node:assert/strict';
import { navigatePrototypeScreen, notifyPrototypeScreen, prototypeScreenUrl, PROTOTYPE_SCREEN_MESSAGE } from '../src/design-bridge/auth-navigation.js';

test('prototype auth routes form a registration, login and app journey with no account payload', () => {
  const start = 'http://127.0.0.1:5173/design/login.html?previewDevice=iphone-pro-max&screen=login#old';
  const registration = new URL(prototypeScreenUrl('register', start));
  assert.equal(registration.pathname, '/design/login.html');
  assert.equal(registration.searchParams.get('screen'), 'register');
  const app = new URL(prototypeScreenUrl('app', registration.href));
  assert.equal(app.pathname, '/design/app.html');
  assert.equal(app.searchParams.get('previewDevice'), 'iphone-pro-max');
  assert.equal(app.hash, '');
  assert.equal(new URL(prototypeScreenUrl('login', app.href)).pathname, '/design/login.html');
  assert.throws(() => prototypeScreenUrl('https://untrusted.invalid', start));
});

test('navigation updates only the preview route and browser location without writing account storage', () => {
  const messages = [], navigations = [];
  const target = {
    parent: { postMessage: (...args) => messages.push(args) },
    location: { href: 'http://localhost/design/login.html', origin: 'http://localhost', replace: href => navigations.push(href) },
  };
  navigatePrototypeScreen('app', target);
  assert.deepEqual(messages, [[{ type: PROTOTYPE_SCREEN_MESSAGE, screen: 'app' }, 'http://localhost']]);
  assert.equal(new URL(navigations[0]).pathname, '/design/app.html');
  notifyPrototypeScreen('unknown', target);
  assert.equal(messages.length, 1);
  target.parent = target;
  notifyPrototypeScreen('login', target);
  assert.equal(messages.length, 1, 'native phones do not message themselves');
});
