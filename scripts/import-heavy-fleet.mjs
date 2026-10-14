import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const inputFlagIndex = args.indexOf('--input');
const inputPath = inputFlagIndex !== -1 ? args[inputFlagIndex + 1] : path.join(projectRoot, 'Capilaridade - Pesados.xlsm');

const outputPath = path.join(projectRoot, 'data', 'workshop-heavy-fleet.json');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = String(value ?? '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'verdadeiro' || text === 'sim';
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo nao encontrado: ${inputPath}`);
  }

  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames.find((name) => name === 'car_workshop');
  if (!sheetName) {
    throw new Error('A planilha nao tem uma aba "car_workshop".');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  // A aba tem uma linha por combinacao oficina x tabela de negociacao (join com a tabela
  // de negociacao), entao a mesma oficina aparece varias vezes - precisa deduplicar por id.
  const byId = new Map();
  rows.forEach((row) => {
    const id = Number(row.id);
    if (!Number.isFinite(id) || byId.has(id)) return;
    byId.set(id, {
      id,
      atendePesado: toBoolean(row['Atende Pesado']),
      atendeLeve: toBoolean(row['Atende Leve']),
    });
  });

  const entries = [...byId.values()];
  writeJson(outputPath, entries);

  const heavyCount = entries.filter((entry) => entry.atendePesado).length;
  console.log(`IMPORT_OK oficinas=${entries.length} atende_pesado=${heavyCount}`);
  console.log(`  ${outputPath}`);
}

main();
