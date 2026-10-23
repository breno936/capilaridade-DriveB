import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const inputFlagIndex = args.indexOf('--input');
const inputPath = inputFlagIndex !== -1
  ? args[inputFlagIndex + 1]
  : path.join(projectRoot, 'BASE DRIVEB - Relatorio Concessionarias.xlsx');

const outputPath = path.join(projectRoot, 'data', 'workshop-network-consultants.json');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo nao encontrado: ${inputPath}`);
  }

  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'base geral')
    || workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Nao encontrei a aba "BASE GERAL" nessa planilha.');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  // Mesma oficina pode aparecer mais de uma vez (uma linha por tabela de pricing) -
  // deduplica por ID Oficina. So entram as ATIVAS, conforme pedido.
  const byId = new Map();
  let skippedInactive = 0;
  let skippedNoConsultant = 0;
  rows.forEach((row) => {
    const id = Number(row['ID Oficina']);
    if (!Number.isFinite(id) || byId.has(id)) return;
    if (row['Oficina Ativa'] !== true) {
      skippedInactive += 1;
      return;
    }
    const consultantLabel = String(row['consultor_redes'] || '').trim();
    if (!consultantLabel) {
      skippedNoConsultant += 1;
      return;
    }
    byId.set(id, { id, consultantLabel });
  });

  const entries = [...byId.values()];
  writeJson(outputPath, entries);

  console.log(`IMPORT_OK oficinas=${entries.length} linhas_lidas=${rows.length} inativas_ignoradas=${skippedInactive} sem_consultor=${skippedNoConsultant}`);
  console.log(`  ${outputPath}`);
}

main();
