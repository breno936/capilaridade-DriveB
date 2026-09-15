import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const inputFlagIndex = args.indexOf('--input');
const inputPath = inputFlagIndex !== -1 ? args[inputFlagIndex + 1] : path.join(projectRoot, 'export_carworkshop.xlsx');

const categoriesOutputPath = path.join(projectRoot, 'data', 'workshop-categories.json');
const tablesOutputPath = path.join(projectRoot, 'data', 'negotiation-tables.json');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo nao encontrado: ${inputPath}`);
  }

  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames.find((name) => name === 'details_carworkshop');
  if (!sheetName) {
    throw new Error('A planilha nao tem uma aba "details_carworkshop".');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const byId = new Map();
  const tablesById = new Map();

  rows.forEach((row) => {
    const id = Number(row.id_oficina);
    if (!Number.isFinite(id)) return;

    const negotiationId = row.negotiation_id_n === '' ? null : Number(row.negotiation_id_n);
    const descricao = String(row.descricao_negociacao_tabela || '').trim();
    const tabela = String(row.descricao_tabela || '').trim();

    const current = byId.get(id) || {
      id,
      categoria: String(row.categoria || '').trim(),
      tabelas: [],
    };

    if (descricao && !current.tabelas.some((entry) => entry.descricao === descricao)) {
      current.tabelas.push({ id: negotiationId, descricao, tabela });
    }

    byId.set(id, current);

    if (negotiationId !== null && descricao) {
      const tableEntry = tablesById.get(negotiationId) || { id: negotiationId, descricao, tabela, count: 0 };
      tableEntry.count += 1;
      tablesById.set(negotiationId, tableEntry);
    }
  });

  const categories = [...byId.values()];
  const tables = [...tablesById.values()].sort((left, right) => right.count - left.count);

  writeJson(categoriesOutputPath, categories);
  writeJson(tablesOutputPath, tables);

  console.log(`IMPORT_OK oficinas=${categories.length} tabelas=${tables.length}`);
  console.log(`  ${categoriesOutputPath}`);
  console.log(`  ${tablesOutputPath}`);
}

main();
