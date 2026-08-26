import { createHash } from 'node:crypto';
import {
  readFile,
  readdir
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const releaseRoot = path.join(repositoryRoot, 'release');
const distRoot = path.join(repositoryRoot, 'dist');

const canonicalManifest = JSON.parse(
  await readFile(path.join(repositoryRoot, 'manifest.json'), 'utf8')
);
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
);
const releaseManifest = JSON.parse(
  await readFile(path.join(releaseRoot, 'release-manifest.json'), 'utf8')
);
const checksumText = await readFile(
  path.join(releaseRoot, 'SHA256SUMS.txt'),
  'utf8'
);

if (canonicalManifest.version !== packageJson.version) {
  throw new Error('manifest.json and package.json versions differ.');
}

if (releaseManifest.version !== canonicalManifest.version) {
  throw new Error('release-manifest version differs from canonical manifest.');
}

const checksumMap = new Map(
  checksumText
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
      if (!match) throw new Error(`Invalid checksum line: ${line}`);
      return [match[2], match[1]];
    })
);

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    const relative = prefix
      ? `${prefix}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      files.push(...await listFiles(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative.replaceAll('\\\\', '/'));
    }
  }

  return files;
}

function listZipEntries(buffer) {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) throw new Error('ZIP EOCD not found.');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const names = [];

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory signature.');
    }

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;

    names.push(buffer.subarray(nameStart, nameEnd).toString('utf8'));
    offset = nameEnd + extraLength + commentLength;
  }

  return names;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const forbiddenPrefixes = [
  '.github/',
  'dist/',
  'docs/',
  'evaluation/',
  'evidence/',
  'release/',
  'scripts/',
  'tests/'
];
const forbiddenFiles = new Set([
  '.gitattributes',
  '.gitignore',
  'package.json'
]);

for (const browser of ['chromium', 'firefox']) {
  const expectedName =
    `NeveshtYar-v${canonicalManifest.version}-${browser}.zip`;
  const artifact = releaseManifest.artifacts.find(
    (item) => item.browser === browser
  );

  if (!artifact || artifact.fileName !== expectedName) {
    throw new Error(`Missing release artifact metadata for ${browser}.`);
  }

  const zip = await readFile(path.join(releaseRoot, expectedName));
  const actualHash = sha256(zip);

  if (checksumMap.get(expectedName) !== actualHash) {
    throw new Error(`SHA256 mismatch for ${expectedName}.`);
  }

  if (artifact.sha256 !== actualHash || artifact.size !== zip.length) {
    throw new Error(`release-manifest metadata mismatch for ${expectedName}.`);
  }

  const zipEntries = listZipEntries(zip);
  const distEntries = await listFiles(path.join(distRoot, browser));

  if (JSON.stringify(zipEntries) !== JSON.stringify(distEntries)) {
    throw new Error(`${browser} ZIP does not exactly match dist package.`);
  }

  if (!zipEntries.includes('manifest.json')) {
    throw new Error(`${browser} ZIP has no manifest.json.`);
  }

  for (const entry of zipEntries) {
    if (
      forbiddenFiles.has(entry) ||
      forbiddenPrefixes.some((prefix) => entry.startsWith(prefix))
    ) {
      throw new Error(`Development-only file leaked into ${browser}: ${entry}`);
    }
  }

  const packageManifest = JSON.parse(
    await readFile(path.join(distRoot, browser, 'manifest.json'), 'utf8')
  );

  if (packageManifest.version !== canonicalManifest.version) {
    throw new Error(`${browser} manifest version mismatch.`);
  }
}

if (checksumMap.size !== 2) {
  throw new Error('SHA256SUMS must contain exactly two browser ZIP entries.');
}

process.stdout.write(
  `${JSON.stringify({
    decision: 'PASS',
    version: canonicalManifest.version,
    artifacts: releaseManifest.artifacts.map((artifact) => ({
      browser: artifact.browser,
      fileName: artifact.fileName,
      sha256: artifact.sha256,
      size: artifact.size,
      entries: artifact.entries
    }))
  }, null, 2)}\n`
);
