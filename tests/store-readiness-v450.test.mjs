import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, '..');

const manifest = JSON.parse(
  await readFile(path.join(root, 'manifest.json'), 'utf8')
);
const packageJson = JSON.parse(
  await readFile(path.join(root, 'package.json'), 'utf8')
);
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const privacy = await readFile(path.join(root, 'docs', 'PRIVACY.md'), 'utf8');
const distribution = await readFile(
  path.join(root, 'docs', 'DISTRIBUTION.md'),
  'utf8'
);
const storeListing = await readFile(
  path.join(root, 'docs', 'STORE-LISTING.md'),
  'utf8'
);
const workflow = await readFile(
  path.join(root, '.github', 'workflows', 'security-quality-gate.yml'),
  'utf8'
);

test('release metadata remains synchronized', () => {
  assert.equal(manifest.version, packageJson.version);
});

test('store readiness removes the unused scripting permission', () => {
  assert.ok(Array.isArray(manifest.permissions));
  assert.equal(manifest.permissions.includes('scripting'), false);
});

test('release scripts are first-class package commands', () => {
  assert.equal(
    packageJson.scripts['build:release'],
    'node scripts/build-release-artifacts.mjs'
  );
  assert.equal(
    packageJson.scripts['verify:release'],
    'node scripts/verify-release-artifacts.mjs'
  );
  assert.match(packageJson.scripts['release:gate'], /build:release/u);
  assert.match(packageJson.scripts['release:gate'], /verify:release/u);
});

test('README points to the current versioned release artifacts', () => {
  assert.ok(
    readme.includes(
      `NeveshtYar-v${packageJson.version}-chromium.zip`
    )
  );
  assert.ok(
    readme.includes(
      `NeveshtYar-v${packageJson.version}-firefox.zip`
    )
  );
  assert.match(readme, /SHA256SUMS\.txt/u);
});

test('distribution and privacy documentation cover release behavior', () => {
  assert.match(distribution, /npm run release:gate/u);
  assert.match(distribution, /SHA256/u);
  assert.match(privacy, /chrome\.storage\.sync/u);
  assert.match(privacy, /local-first/u);
  assert.match(privacy, /activeTab/u);
  assert.match(privacy, /does not send typed correction text or search terms/u);
  assert.match(storeListing, /Chrome Web Store/u);
  assert.match(storeListing, /Firefox/u);
});

test('CI builds, verifies and uploads release-candidate artifacts', () => {
  assert.match(workflow, /npm run build:release/u);
  assert.match(workflow, /npm run verify:release/u);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}\s+# v\d+(?:\.\d+){0,2}/u);
});
