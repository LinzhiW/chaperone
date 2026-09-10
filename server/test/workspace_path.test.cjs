// The workspace boundary is the one place where a wrong answer means an agent
// reads or writes something on the user's machine that it was never pointed at.
// It gets a test. Run with `npm test` in server/ (builds first, then node --test).
//
// Deliberately tests the built module, not a copy of its rules — a test that
// restates the logic it is checking proves only that it was typed twice.

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveInWorkspace } = require('../dist/workspace_path.js');

const WS = process.platform === 'win32' ? 'C:/proj' : '/proj';
const allowed = (rel, write) => resolveInWorkspace(rel, WS, write).ok;

test('paths inside the project are allowed, for reading and for writing', () => {
  for (const rel of ['src/a.ts', 'docs/PRD.md', 'a/b/c/d.txt', '.']) {
    assert.ok(allowed(rel, false), `read ${rel}`);
    assert.ok(allowed(rel, true), `write ${rel}`);
  }
});

test('relative paths cannot climb out of the project', () => {
  for (const rel of ['../secrets.env', '../../a', 'docs/../../x', 'src/../../../etc/passwd']) {
    assert.equal(allowed(rel, false), false, `read ${rel}`);
    assert.equal(allowed(rel, true), false, `write ${rel}`);
  }
});

test('absolute paths elsewhere on the machine are refused', () => {
  const outside = process.platform === 'win32'
    ? ['C:/Windows/System32/drivers/etc/hosts', 'C:/Users/someone/.ssh/id_rsa', 'D:/other-project/.env']
    : ['/etc/passwd', '/home/someone/.ssh/id_rsa', '/var/log/syslog'];
  for (const abs of outside) {
    assert.equal(allowed(abs, false), false, `read ${abs}`);
    assert.equal(allowed(abs, true), false, `write ${abs}`);
  }
});

test("Chaperone's own folder is readable but never writable", () => {
  for (const dir of ['.chaperone', '.canopy']) {
    assert.ok(allowed(`${dir}/PRD.md`, false), `read ${dir}`);
    assert.equal(allowed(`${dir}/PRD.md`, true), false, `write ${dir}`);
  }
});

test('a refusal explains itself, since the agent reads the message back', () => {
  const r = resolveInWorkspace('../../x', WS, true);
  assert.equal(r.ok, false);
  assert.match(r.error, /outside the project folder/);
  const c = resolveInWorkspace('.chaperone/PRD.md', WS, true);
  assert.equal(c.ok, false);
  assert.match(c.error, /Chaperone's own folder/);
});
