import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stateNameByCode } from '../lib/workshop-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const datasetPath = path.join(projectRoot, 'public', 'data', 'workshops.json');
const cachePath = path.join(projectRoot, 'data', 'city-cache.json');
const exportScriptPath = path.join(projectRoot, 'scripts', 'export-workshops.ps1');

const args = process.argv.slice(2);
const limit = readFlagValue(args, '--limit');
const delayMs = Number(readFlagValue(args, '--delay-ms') || 1100);
const sample = args.includes('--sample');

const stateNameToCode = Object.fromEntries(
  Object.entries(stateNameByCode).map(([code, name]) => [normalizeText(name), code]),
);

function readFlagValue(values, flag) {
  const index = values.indexOf(flag);
  if (index === -1) return '';
  return values[index + 1] || '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildLookupKey(item) {
  if (item.addressId) return `address:${item.addressId}`;
  if (Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
    return `coord:${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
  }
  return '';
}

function buildCityKey(cityName, stateCode) {
  if (!cityName || !stateCode) return '';
  return `${normalizeText(cityName)}::${stateCode}`;
}

function resolveStateCode(rawStateName) {
  const normalized = normalizeText(rawStateName);
  return stateNameToCode[normalized] || '';
}

function extractCity(address) {
  return address.city || address.town || address.village || address.municipality || address.county || '';
}

async function reverseLookup(item) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(item.lat));
  url.searchParams.set('lon', String(item.lng));
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'pt-BR');

  if (process.env.NOMINATIM_EMAIL) {
    url.searchParams.set('email', process.env.NOMINATIM_EMAIL);
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'capilaridade-driveb-city-enricher/1.0 (+local-script)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const address = payload.address || {};
  const cityName = extractCity(address);
  const cityStateCode = resolveStateCode(address.state);

  return {
    lookupKey: buildLookupKey(item),
    addressId: item.addressId || '',
    lat: item.lat,
    lng: item.lng,
    cityName,
    cityStateCode,
    cityKey: buildCityKey(cityName, cityStateCode),
    source: 'nominatim',
    fetchedAt: new Date().toISOString(),
    displayName: payload.display_name || '',
  };
}

function runExport() {
  const result = spawnSync(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', exportScriptPath],
    { cwd: projectRoot, stdio: 'inherit' },
  );

  if (result.status !== 0) {
    throw new Error('Falha ao reexecutar export-workshops.ps1 após enriquecer cidades.');
  }
}

async function main() {
  const dataset = readJson(datasetPath);
  const cacheEntries = fs.existsSync(cachePath) ? readJson(cachePath) : [];
  const cacheMap = new Map(cacheEntries.map((entry) => [entry.lookupKey, entry]));

  const candidates = [];
  const seen = new Set();

  for (const item of dataset) {
    if (!item.isInBrazil || !item.hasValidCoordinates) continue;
    const lookupKey = buildLookupKey(item);
    if (!lookupKey || seen.has(lookupKey)) continue;
    seen.add(lookupKey);
    if (cacheMap.has(lookupKey) && cacheMap.get(lookupKey)?.cityName) continue;
    candidates.push({
      addressId: item.addressId || '',
      lat: item.lat,
      lng: item.lng,
      lookupKey,
    });
  }

  const targetCount = limit ? Math.min(Number(limit), candidates.length) : candidates.length;
  const queue = sample ? candidates.slice(0, Math.min(10, candidates.length)) : candidates.slice(0, targetCount);

  console.log(`TOTAL_DATASET=${dataset.length}`);
  console.log(`CACHE_EXISTING=${cacheMap.size}`);
  console.log(`PENDING_LOOKUPS=${candidates.length}`);
  console.log(`RUNNING_LOOKUPS=${queue.length}`);

  let completed = 0;

  for (const item of queue) {
    try {
      const entry = await reverseLookup(item);
      cacheMap.set(entry.lookupKey, entry);
      completed += 1;
      console.log(`OK ${completed}/${queue.length} ${entry.lookupKey} => ${entry.cityName || 'SEM_CIDADE'} ${entry.cityStateCode || ''}`.trim());
    } catch (error) {
      const failureEntry = {
        lookupKey: item.lookupKey,
        addressId: item.addressId || '',
        lat: item.lat,
        lng: item.lng,
        cityName: '',
        cityStateCode: '',
        cityKey: '',
        source: `error:${error.message}`,
        fetchedAt: new Date().toISOString(),
        displayName: '',
      };
      cacheMap.set(item.lookupKey, failureEntry);
      console.log(`ERR ${completed + 1}/${queue.length} ${item.lookupKey} => ${error.message}`);
    }

    writeJson(cachePath, [...cacheMap.values()].sort((left, right) => left.lookupKey.localeCompare(right.lookupKey, 'pt-BR')));
    if (completed < queue.length) {
      await sleep(delayMs);
    }
  }

  runExport();
  console.log(`CITY_ENRICH_OK processed=${queue.length} cache=${cacheMap.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
