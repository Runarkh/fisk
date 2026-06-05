// Tester at Tailscale-IP-gjenkjenning treffer CGNAT-området 100.64.0.0/10.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test'; // hindrer at serveren begynner å lytte ved import
const { isTailscaleIp } = await import('../server.js');

test('Tailscale-adresser (100.64–100.127) gjenkjennes', () => {
  assert.ok(isTailscaleIp('100.64.0.1'));
  assert.ok(isTailscaleIp('100.100.50.20'));
  assert.ok(isTailscaleIp('100.127.255.254'));
});

test('vanlige LAN-/offentlige adresser gjenkjennes IKKE som Tailscale', () => {
  assert.ok(!isTailscaleIp('192.168.1.10'));
  assert.ok(!isTailscaleIp('10.0.0.5'));
  assert.ok(!isTailscaleIp('100.63.0.1')); // rett under området
  assert.ok(!isTailscaleIp('100.128.0.1')); // rett over området
  assert.ok(!isTailscaleIp('8.8.8.8'));
});
