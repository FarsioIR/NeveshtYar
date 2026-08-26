import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

const outputRoot = path.resolve(
  readArgument('--out') || path.join(repositoryRoot, 'reviewer')
);

const manifest = JSON.parse(
  await readFile(path.join(repositoryRoot, 'manifest.json'), 'utf8')
);
const version = manifest.version;

const excludedPrefixes = [
  'docs/evidence/',
  'evidence/'
];

const tracked = execFileSync(
  'git',
  ['ls-files', '-z'],
  { cwd: repositoryRoot, encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)
  .filter((relative) => !excludedPrefixes.some((prefix) => relative.startsWith(prefix)))
  .sort();

const reviewerBuild = [
  '# AMO Reviewer Build Instructions — Farsi Smart Assistant v' + version,
  '',
  'This source archive is generated from the exact public Git repository state used for the Firefox submission candidate.',
  '',
  '## Requirements',
  '',
  '- Node.js 20+',
  '- npm',
  '- Git',
  '',
  '## Rebuild',
  '',
  'From the extracted source directory:',
  '',
  'Build commands:',
  'git init',
  'git add -A',
  'npm ci',
  'npm run model:build',
  'npm run lexical:build',
  'npm run finglish-source:build',
  'git diff --exit-code -- language_profiles.js lexical_priors.js finglish_source_model.js',
  'npm run check',
  'npm test',
  'npm run eval',
  'npm run model:eval',
  'npm run finglish:eval',
  'npm run smart-auto:eval',
  'npm run spell:eval',
  'npm run build:release -- --version ' + version,
  'npm run verify:release',
  '',
  'The Firefox package is written under release/. The build uses only pinned npm dependencies from package-lock.json and repository source/build scripts.',
  '',
  'No Store credentials, signing keys, tokens, or private dashboard material are required.',
  ''
].join('\\n');

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
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

const files = [];
for (const relative of tracked) {
  files.push({
    name: relative.replaceAll('\\', '/'),
    data: await readFile(path.join(repositoryRoot, relative))
  });
}
files.push({
  name: 'AMO-REVIEWER-BUILD.md',
  data: Buffer.from(reviewerBuild, 'utf8')
});
files.sort((a, b) => a.name.localeCompare(b.name));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const zip = createStoredZip(files);
const fileName = `NeveshtYar-v${version}-amo-source.zip`;
await writeFile(path.join(outputRoot, fileName), zip);

const sourceManifest = {
  schemaVersion: 1,
  product: 'NeveshtYar',
  version,
  fileName,
  sha256: sha256(zip),
  size: zip.length,
  entries: files.length,
  deterministicZip: {
    method: 'stored',
    timestamp: '1980-01-01T00:00:00Z',
    entryOrder: 'lexicographic'
  },
  excludedEvidencePrefixes: excludedPrefixes,
  buildInstructions: 'AMO-REVIEWER-BUILD.md'
};

await writeFile(
  path.join(outputRoot, 'source-manifest.json'),
  `${JSON.stringify(sourceManifest, null, 2)}\n`,
  'utf8'
);

process.stdout.write(`${JSON.stringify(sourceManifest, null, 2)}\n`);
