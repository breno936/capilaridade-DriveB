import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { resolveCategoria } from '../lib/workshop-categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const inputFlagIndex = args.indexOf('--input');
const inputPath = inputFlagIndex !== -1
  ? args[inputFlagIndex + 1]
  : path.join(projectRoot, 'BASE DRIVEB - Relatorio Concessionarias.xlsx');

const outputPath = path.join(projectRoot, 'data', 'workshop-concessionaria-brands.json');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo nao encontrado: ${inputPath}`);
  }

  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'somente concessionarias'.toLowerCase())
    || workbook.SheetNames.find((name) => /concession/i.test(name));
  if (!sheetName) {
    throw new Error('Nao encontrei a aba "Somente CONCESSIONARIAS" nessa planilha.');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  // A aba tem uma linha por combinacao oficina x tabela de pricing, entao a mesma
  // concessionaria aparece mais de uma vez - precisa deduplicar por ID Oficina.
  // So entram as ATIVAS (campo "Oficina Ativa"), conforme pedido.
  const byId = new Map();
  let skippedInactive = 0;
  rows.forEach((row) => {
    const id = Number(row['ID Oficina']);
    if (!Number.isFinite(id)) return;
    if (row['Oficina Ativa'] !== true) {
      skippedInactive += 1;
      return;
    }
    if (byId.has(id)) return;
    const resolved = resolveCategoria(row['categoria']);
    byId.set(id, {
      id,
      brandSlug: resolved?.brandSlug || '',
      brandLabel: resolved?.brandLabel || String(row['categoria'] || '').trim(),
      nomeFantasia: row['Nome Fantasia'] || '',
      cidade: row['cidade'] || '',
      estado: row['estado'] || '',
    });
  });

  const entries = [...byId.values()];
  writeJson(outputPath, entries);

  console.log(`IMPORT_OK concessionarias=${entries.length} linhas_lidas=${rows.length} inativas_ignoradas=${skippedInactive}`);
  console.log(`  ${outputPath}`);
}

main();
