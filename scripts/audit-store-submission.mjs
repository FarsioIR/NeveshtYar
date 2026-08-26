import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const releaseRoot = path.join(root, 'release');
const reviewerRoot = path.join(root, 'reviewer');

function fail(message) { throw new Error(message); }
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

function readPngDimensions(buffer, fileName) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail(`${fileName} is not a valid PNG.`);
  }
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    fail(`${fileName} has no IHDR chunk at the expected position.`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const popupSource = await readFile(path.join(root, 'popup.js'), 'utf8');
const backgroundSource = await readFile(path.join(root, 'background.js'), 'utf8');
const popupHtml = await readFile(path.join(root, 'popup.html'), 'utf8');

if (manifest.version !== packageJson.version) fail('manifest/package versions must match.');
const version = manifest.version;
if (manifest.manifest_version !== 3) fail('Manifest V3 required.');
if (typeof manifest.description !== 'string' || manifest.description.length < 1 || manifest.description.length > 132) {
  fail('manifest.description must be 1..132 characters.');
}

if (JSON.stringify(manifest.permissions) !== JSON.stringify(['storage', 'activeTab'])) {
  fail(`Store-safe permissions must be exactly storage + activeTab; got ${JSON.stringify(manifest.permissions)}`);
}
if (Object.hasOwn(manifest, 'host_permissions')) fail('Store-safe manifest must not declare host_permissions.');
if (Object.hasOwn(manifest, 'omnibox')) fail('Store-safe manifest must not declare omnibox.');

for (const [label, source] of [['popup.js', popupSource], ['background.js', backgroundSource], ['popup.html', popupHtml]]) {
  for (const forbidden of ['wikipedia.org', 'google.com/search', 'webNavigation', 'contextMenus', 'searchGoogle', 'knowledgePanel']) {
    if (source.includes(forbidden)) fail(`${label} contains forbidden Store-safe runtime token: ${forbidden}`);
  }
}
if (/\bfetch\s*\(/u.test(popupSource)) fail('Store-safe popup must not perform remote fetch().');

const requiredIcons = new Map([['16','icon16.png'],['32','icon32.png'],['48','icon48.png'],['128','icon128.png']]);
const icons = {};
for (const [size, fileName] of requiredIcons) {
  if (manifest.icons?.[size] !== fileName) fail(`manifest.icons[${size}] must be ${fileName}.`);
  const buffer = await readFile(path.join(root, fileName));
  const dimensions = readPngDimensions(buffer, fileName);
  const numericSize = Number(size);
  if (dimensions.width !== numericSize || dimensions.height !== numericSize) fail(`${fileName} dimensions invalid.`);
  icons[size] = dimensions;
}

const chromiumFileName = `NeveshtYar-v${version}-chromium.zip`;
const firefoxFileName = `NeveshtYar-v${version}-firefox.zip`;
const chromiumZip = path.join(releaseRoot, chromiumFileName);
const firefoxZip = path.join(releaseRoot, firefoxFileName);
const chromiumStat = await stat(chromiumZip);
const firefoxStat = await stat(firefoxZip);
if (chromiumStat.size > 2 * 1024 * 1024 * 1024) fail('Chromium package exceeds 2 GB.');
if (firefoxStat.size > 200 * 1024 * 1024) fail('Firefox package exceeds 200 MB.');

const chromiumManifest = JSON.parse(await readFile(path.join(root, 'dist', 'chromium', 'manifest.json'), 'utf8'));
const firefoxManifest = JSON.parse(await readFile(path.join(root, 'dist', 'firefox', 'manifest.json'), 'utf8'));
if (chromiumManifest.version !== version || firefoxManifest.version !== version) fail('Built manifest version mismatch.');
if (JSON.stringify(chromiumManifest.permissions) !== JSON.stringify(['storage','activeTab'])) fail('Chromium built permissions mismatch.');
if (Object.hasOwn(chromiumManifest, 'host_permissions')) fail('Chromium built host_permissions must be absent.');

const gecko = firefoxManifest.browser_specific_settings?.gecko;
if (gecko?.id !== '@farsi-smart-assistant.amirmotefaker') fail('Unexpected Firefox add-on ID.');
if (gecko?.strict_min_version !== '140.0') fail('Firefox strict_min_version must remain 140.0.');
const declaredData = gecko.data_collection_permissions?.required || [];
if (JSON.stringify(declaredData) !== JSON.stringify(['none'])) {
  fail(`Firefox Store-safe package must declare required: [none]; got ${JSON.stringify(declaredData)}`);
}
if (JSON.stringify(firefoxManifest.background) !== JSON.stringify({ scripts: ['background.js'] })) {
  fail('Firefox Store-safe background must contain background.js only.');
}

const sourceManifest = JSON.parse(await readFile(path.join(reviewerRoot, 'source-manifest.json'), 'utf8'));
const expectedSourceName = `NeveshtYar-v${version}-amo-source.zip`;
if (sourceManifest.version !== version || sourceManifest.fileName !== expectedSourceName) fail('AMO source manifest version/name mismatch.');
const sourceZip = await readFile(path.join(reviewerRoot, expectedSourceName));
if (sha256(sourceZip) !== sourceManifest.sha256) fail('AMO reviewer source SHA mismatch.');
if (sourceZip.length !== sourceManifest.size) fail('AMO reviewer source size mismatch.');

for (const relative of [
  'docs/store/v4.9.1/CHROME-WEB-STORE.md',
  'docs/store/v4.9.1/FIREFOX-AMO.md',
  'docs/store/v4.9.1/PRIVACY-DISCLOSURES.md',
  'docs/store/v4.9.1/ASSET-CHECKLIST.md',
  'docs/store/v4.9.1/SUBMISSION-STATUS.md',
  'docs/store/v4.9.1/AMO-REVIEWER-SOURCE.md'
]) {
  await stat(path.join(root, relative));
}

const result = {
  decision: 'PASS',
  version,
  storeSafe: true,
  permissions: manifest.permissions,
  thirdPartyHostPermissions: [],
  chromiumPackage: { fileName: chromiumFileName, bytes: chromiumStat.size },
  firefoxPackage: { fileName: firefoxFileName, bytes: firefoxStat.size, addonId: gecko.id, declaredDataCollection: declaredData },
  amoReviewerSource: sourceManifest
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
