import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const popup = await readFile(path.join(root, 'popup.js'), 'utf8');
const popupHtml = await readFile(path.join(root, 'popup.html'), 'utf8');
const background = await readFile(path.join(root, 'background.js'), 'utf8');
const buildBrowser = await readFile(path.join(root, 'scripts', 'build-browser-packages.mjs'), 'utf8');
const auditStore = await readFile(path.join(root, 'scripts', 'audit-store-submission.mjs'), 'utf8');
const privacy = await readFile(path.join(root, 'docs', 'PRIVACY.md'), 'utf8');
const workflow = await readFile(path.join(root, '.github', 'workflows', 'security-quality-gate.yml'), 'utf8');

test('v4.9.2 Store-safe metadata and permission surface are minimal', () => {
  assert.equal(manifest.version, '4.9.2');
  assert.equal(packageJson.version, '4.9.2');
  assert.equal(manifest.name, 'NeveshtYar');
  assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
  assert.equal(Object.hasOwn(manifest, 'host_permissions'), false);
  assert.equal(Object.hasOwn(manifest, 'omnibox'), false);
});

test('v4.9.1 runtime contains no third-party search/knowledge transmission flow', () => {
  const runtime = [popup, popupHtml, background].join('\n');
  assert.doesNotMatch(runtime, /wikipedia\.org|google\.com\/search|webNavigation|contextMenus|searchGoogle|knowledgePanel/iu);
  assert.doesNotMatch(popup, /\bfetch\s*\(/u);
});

test('v4.9.1 preserves current-site controls through activeTab', () => {
  assert.match(popup, /chrome\.tabs\.query/u);
  assert.match(popup, /activeTab\?\.favIconUrl/u);
  assert.match(popup, /siteToggle\.addEventListener\('change'/u);
});

test('Firefox package declares no data transmission and toolbar-only background', () => {
  assert.match(buildBrowser, /required:\s*\['none'\]/u);
  assert.match(buildBrowser, /scripts:\s*\['background\.js'\]/u);
  assert.doesNotMatch(buildBrowser, /required:\s*\['searchTerms'\]/u);
});

test('Store audit and CI include deterministic AMO reviewer source', () => {
  assert.match(packageJson.scripts['audit:store'], /build:amo-source/u);
  assert.match(auditStore, /amo-source\.zip/u);
  assert.match(workflow, /farsi-smart-assistant-amo-reviewer-source/u);
});

test('privacy source of truth matches correction-only runtime', () => {
  assert.match(privacy, /local-first/u);
  assert.match(privacy, /does not send typed correction text or search terms/u);
  assert.match(privacy, /storage.*activeTab/su);
});
