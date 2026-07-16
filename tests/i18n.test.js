const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'i18n', file), 'utf8'));
}

test('settings buttons have translations', () => {
  const zh = readJson('zh-CN.json');
  const en = readJson('en.json');

  for (const locale of [zh, en]) {
    assert.ok(locale.settings?.cancel, 'settings.cancel should exist');
    assert.ok(locale.settings?.apply, 'settings.apply should exist');
    assert.ok(locale.settings?.ok, 'settings.ok should exist');
    assert.ok(locale.common?.save, 'common.save should exist');
    assert.ok(locale.common?.delete, 'common.delete should exist');
    assert.ok(locale.common?.close, 'common.close should exist');
    assert.ok(locale.common?.noSender, 'common.noSender should exist');
    assert.ok(locale.common?.noSubject, 'common.noSubject should exist');
    assert.ok(locale.common?.noMessages, 'common.noMessages should exist');
  }
});
