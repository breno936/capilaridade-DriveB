import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const inputDirFlagIndex = args.indexOf('--input-dir');
const inputDir = inputDirFlagIndex !== -1 ? args[inputDirFlagIndex + 1] : path.join(projectRoot, '..', 'Downloads');

const outputPath = path.join(projectRoot, 'public', 'data', 'manufacturer-dealers.json');
const citiesPath = path.join(projectRoot, 'public', 'data', 'br-cities.json');

// Nome do arquivo (como pedido no prompt para a outra IA) -> slug de marca do nosso catalogo
// (lib/workshop-brands.js). Mapeado explicitamente em vez de tentar casar por regex porque
// alguns nomes de arquivo nao batem 1:1 com o slug (ex: CAOA Chery -> chery).
const BRAND_FILE_TO_SLUG = {
  'Audi-Concessionarias-Brasil.csv': 'audi',
  'BMW-Concessionarias-Brasil.csv': 'bmw',
  'CAOA-Chery-Concessionarias-Brasil.csv': 'chery',
  'Chevrolet-Concessionarias-Brasil.csv': 'chevrolet',
  'Citroen-Concessionarias-Brasil.csv': 'citroen',
  'Fiat-Concessionarias-Brasil.csv': 'fiat',
  'Ford-Concessionarias-Brasil.csv': 'ford',
  'Honda-Concessionarias-Brasil.csv': 'honda',
  'Hyundai-Concessionarias-Brasil.csv': 'hyundai',
  'Jeep-Concessionarias-Brasil.csv': 'jeep',
  'Kia-Concessionarias-Brasil.csv': 'kia',
  'Lexus-Concessionarias-Brasil.csv': 'lexus',
  'Nissan-Concessionarias-Brasil.csv': 'nissan',
  'Peugeot-Concessionarias-Brasil.csv': 'peugeot',
  'Renault-Concessionarias-Brasil.csv': 'renault',
  'Toyota-Concessionarias-Brasil.csv': 'toyota',
  'Volkswagen-Concessionarias-Brasil.csv': 'volkswagen',
  'Volvo-Concessionarias-Brasil.csv': 'volvo',
};

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function buildCityKey(cityName, stateCode) {
  if (!cityName || !stateCode) return '';
  return `${normalizeText(cityName)}::${stateCode}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^﻿/, ''));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const header = lines[0].split(';').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(';');
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
    return row;
  });
}

// Pequeno deslocamento deterministico (baseado no nome) para concessionarias da mesma
// cidade nao ficarem todas empilhadas exatamente no mesmo pixel no mapa - nao e a
// localizacao exata do endereco, so evita sobreposicao visual no centro da cidade.
function jitterFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const angle = (hash % 360) * (Math.PI / 180);
  const radiusKm = 0.6 + (hash % 100) / 100;
  const dLat = (radiusKm / 111) * Math.sin(angle);
  const dLng = (radiusKm / 111) * Math.cos(angle);
  return { dLat, dLng };
}

function main() {
  const cities = readJson(citiesPath);
  const cityLookup = new Map(cities.map((city) => [buildCityKey(city.name, city.stateCode), city]));

  const entries = [];
  const unmatchedCities = new Map();
  let nextId = 1;

  Object.entries(BRAND_FILE_TO_SLUG).forEach(([fileName, brandSlug]) => {
    const filePath = path.join(inputDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`AVISO: arquivo nao encontrado, pulando: ${fileName}`);
      return;
    }

    const rows = parseCsv(filePath);
    rows.forEach((row) => {
      const dealerName = row['Nome da concessionária'] || '';
      const cidade = row['Cidade'] || '';
      const uf = (row['UF'] || '').toUpperCase().trim();
      const address = row['Endereço'] || '';
      const brandLabel = row['Marca'] || brandSlug;
      const cityKey = buildCityKey(cidade, uf);
      const city = cityKey ? cityLookup.get(cityKey) : null;

      if (!city) {
        const key = `${cidade}::${uf}`;
        unmatchedCities.set(key, (unmatchedCities.get(key) || 0) + 1);
      }

      const { dLat, dLng } = jitterFromName(`${brandSlug}:${dealerName}`);

      entries.push({
        id: nextId++,
        brandSlug,
        brandLabel,
        dealerName,
        address,
        cityName: cidade,
        stateCode: uf,
        cityKey,
        lat: city ? city.lat + dLat : null,
        lng: city ? city.lng + dLng : null,
        hasCoords: Boolean(city),
      });
    });
  });

  writeJson(outputPath, entries);

  const withCoords = entries.filter((e) => e.hasCoords).length;
  console.log(`IMPORT_OK dealers=${entries.length} com_coordenadas=${withCoords} sem_coordenadas=${entries.length - withCoords}`);
  console.log(`  ${outputPath}`);
  if (unmatchedCities.size) {
    console.log(`Cidades nao encontradas na base de referencia (${unmatchedCities.size}):`);
    [...unmatchedCities.entries()].slice(0, 20).forEach(([key, count]) => console.log(`  ${key} (${count}x)`));
  }
}

main();
