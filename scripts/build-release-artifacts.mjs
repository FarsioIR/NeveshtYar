import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

const releaseRoot = path.resolve(
  readArgument('--out') || path.join(repositoryRoot, 'release')
);
const distRoot = path.resolve(
  readArgument('--dist') || path.join(repositoryRoot, 'dist')
);
const requestedVersion = readArgument('--version');

const manifest = JSON.parse(
  await readFile(path.join(repositoryRoot, 'manifest.json'), 'utf8')
);
const version = manifest.version;

if (requestedVersion && requestedVersion !== version) {
  throw new Error(
    `Requested release ${requestedVersion} does not match manifest ${version}.`
  );
}

execFileSync(
  process.execPath,
  [
    path.join(scriptDirectory, 'build-browser-packages.mjs'),
    '--out',
    distRoot
  ],
  {
    cwd: repositoryRoot,
    stdio: 'inherit'
  }
);

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });

async function collectFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    const relative = prefix
      ? `${prefix}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute, relative));
      continue;
    }

    if (!entry.isFile()) continue;

    files.push({
      name: relative.replaceAll('\\\\', '/'),
      data: await readFile(absolute)
    });
  }

  return files;
}

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc & 1)
        ? (0xedb88320 ^ (crc >>> 1))
        : (crc >>> 1);
    }
    table[n] = crc >>> 0;
  }

  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  // Deterministic DOS timestamp: 1980-01-01 00:00:00.
  const dosTime = 0;
  const dosDate = 0x21;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + data.length;
  }

  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);

  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralData.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralData, eocd]);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const artifacts = [];

for (const browser of ['chromium', 'firefox']) {
  const packageDirectory = path.join(distRoot, browser);
  const packageManifest = JSON.parse(
    await readFile(path.join(packageDirectory, 'manifest.json'), 'utf8')
  );

  if (packageManifest.version !== version) {
    throw new Error(
      `${browser} package version ${packageManifest.version} != ${version}`
    );
  }

  const files = await collectFiles(packageDirectory);
  const zip = createStoredZip(files);
  const fileName = `NeveshtYar-v${version}-${browser}.zip`;
  const outputPath = path.join(releaseRoot, fileName);

  await writeFile(outputPath, zip);

  artifacts.push({
    browser,
    fileName,
    sha256: sha256(zip),
    size: zip.length,
    entries: files.length
  });
}

const checksumText = `${artifacts
  .map((artifact) => `${artifact.sha256}  ${artifact.fileName}`)
  .join('\n')}\n`;

await writeFile(
  path.join(releaseRoot, 'SHA256SUMS.txt'),
  checksumText,
  'utf8'
);

const releaseManifest = {
  schemaVersion: 1,
  product: 'NeveshtYar',
  version,
  deterministicZip: {
    method: 'stored',
    timestamp: '1980-01-01T00:00:00Z',
    entryOrder: 'lexicographic'
  },
  artifacts
};

await writeFile(
  path.join(releaseRoot, 'release-manifest.json'),
  `${JSON.stringify(releaseManifest, null, 2)}\n`,
  'utf8'
);

process.stdout.write(`${JSON.stringify(releaseManifest, null, 2)}\n`);
