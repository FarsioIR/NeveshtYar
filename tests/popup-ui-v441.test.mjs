import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');

const popupHtml = await readFile(path.join(root, 'popup.html'), 'utf8');
const popupJs = await readFile(path.join(root, 'popup.js'), 'utf8');
const optionsHtml = await readFile(path.join(root, 'options.html'), 'utf8');
const optionsJs = await readFile(path.join(root, 'options.js'), 'utf8');
const siteHtml = await readFile(path.join(root, 'site_management.html'), 'utf8');
const siteJs = await readFile(path.join(root, 'site_management.js'), 'utf8');

const browserAssets = [
  'chrome.svg',
  'edge.svg',
  'brave.svg',
  'opera.svg',
  'vivaldi.svg',
  'firefox.svg',
  'github.svg'
];

test('v4.4.1 uses local real logo assets for all released browsers', async () => {
  for (const name of browserAssets) {
    const assetPath = path.join(root, 'assets', 'browser-logos', name);
    await access(assetPath);
    assert.ok((await stat(assetPath)).size > 100, `${name} is unexpectedly small`);
  }

  for (const browser of ['chrome', 'edge', 'brave', 'opera', 'vivaldi', 'firefox']) {
    assert.match(
      popupHtml,
      new RegExp(`src="assets/browser-logos/${browser}\\.svg"`, 'u')
    );
  }

  assert.doesNotMatch(
    popupHtml,
    /<b>[CEBOVF]<\/b>/u
  );
});

test('v4.4.1 footer identifies Amir Motefaker and repository', () => {
  assert.match(popupHtml, /ساخته شده با/u);
  assert.match(popupHtml, /برای ایرانیان توسط/u);
  assert.match(popupHtml, /امیر متفکر/u);
  assert.match(popupHtml, /https:\/\/amirmotefaker\.ir\//u);
  assert.match(
    popupHtml,
    /https:\/\/github\.com\/FarsioIR\/NeveshtYar/u
  );
  assert.match(popupHtml, /assets\/browser-logos\/github\.svg/u);
});

test('v4.4.1 settings and site management are separate surfaces', () => {
  assert.match(optionsHtml, /id="customDictionary"/u);
  assert.doesNotMatch(optionsHtml, /id="disabledHosts"/u);

  assert.match(siteHtml, /id="disabledHosts"/u);
  assert.doesNotMatch(siteHtml, /id="customDictionary"/u);

  assert.match(popupJs, /chrome\.runtime\.openOptionsPage\(\)/u);
  assert.match(
    popupJs,
    /chrome\.runtime\.getURL\('site_management\.html'\)/u
  );
  assert.doesNotMatch(popupJs, /options\.html#sites/u);
});

test('v4.4.1 management scripts preserve Safe-DOM contract', () => {
  for (const source of [optionsJs, siteJs]) {
    for (const pattern of [
      /\binnerHTML\s*=/u,
      /\bouterHTML\s*=/u,
      /\binsertAdjacentHTML\s*\(/u,
      /\bdocument\.write\s*\(/u,
      /\beval\s*\(/u,
      /\bnew\s+Function\s*\(/u
    ]) {
      assert.doesNotMatch(source, pattern);
    }
  }
});