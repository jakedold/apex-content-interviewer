import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = fs.readFileSync(path.join(root, 'worker', 'admin.ts'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src', 'admin.ts'), 'utf8');

test('access-management details are disclosed only to an administrator', () => {
  assert.match(worker, /isAdministrator \? managementUrl\(env\.ADMIN_ACCESS_MANAGEMENT_URL/);
  assert.match(worker, /actionAdministrators: isAdministrator \? administratorEmails : \[\]/);
  assert.match(worker, /url\.protocol === 'https:'/);
  assert.match(worker, /dash\.cloudflare\.com/);
});

test('the dashboard exposes a dedicated user-management path', () => {
  assert.match(client, /href="\/admin\/access"/);
  assert.match(client, /id="access"/);
  assert.match(client, /Manage sign-in access/);
  assert.match(client, /Edit administrator list/);
  assert.match(client, /window\.location\.pathname === '\/admin\/access'/);
});
