import * as XLSX from 'xlsx';

const INPUT_HEADER_ROW = ['Codigo', 'Descricao', 'Marca', 'Veiculo', 'Quantidade', 'Preco Proposto'];
const OUTPUT_HEADER_ROW = [
  'Codigo', 'Descricao', 'Marca', 'Veiculo', 'Quantidade', 'Preco DriveB',
  'Mediana mercado', 'Preco minimo', 'Preco maximo', 'Ofertas validas', 'Diferenca (%)', 'Confianca (%)', 'Classificacao',
];

const HEADER_SCAN_LIMIT = 12;

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function countNonEmpty(row) {
  return (row || []).filter((cell) => String(cell ?? '').trim() !== '').length;
}

export function guessPartColumns(headerRow) {
  const columns = {};
  (headerRow || []).forEach((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (!header) return;
    if (columns.code === undefined && (header.includes('codigo') || header === 'sku' || header.includes('referencia') || header.includes('cod.'))) columns.code = index;
    else if (columns.description === undefined && (header.includes('descricao') || header.includes('produto') || header.includes('peca') || header.includes('item'))) columns.description = index;
    else if (columns.brand === undefined && (header.includes('marca') || header.includes('fabricante'))) columns.brand = index;
    else if (columns.vehicle === undefined && (header.includes('veiculo') || header.includes('modelo') || header.includes('aplicacao'))) columns.vehicle = index;
    else if (columns.quantity === undefined && (header.includes('quantidade') || header.includes('qtd'))) columns.quantity = index;
    else if (columns.price === undefined && (header.includes('preco') || header.includes('valor') || header.includes('proposta'))) columns.price = index;
  });
  return columns;
}

export function guessPartHeaderRowIndex(matrix) {
  const scanLimit = Math.min(matrix.length, HEADER_SCAN_LIMIT);
  let best = { rowIndex: 0, score: -1 };

  for (let i = 0; i < scanLimit; i++) {
    const columns = guessPartColumns(matrix[i]);
    const matchedFields = Object.keys(columns).length;
    if (columns.description === undefined && columns.code === undefined) continue;

    const score = matchedFields * 10 + (columns.price !== undefined ? 5 : 0);
    if (score > best.score) best = { rowIndex: i, score };
  }

  if (best.score < 0) {
    const fallbackRow = matrix.findIndex((row) => countNonEmpty(row) >= 2);
    return fallbackRow === -1 ? 0 : fallbackRow;
  }

  return best.rowIndex;
}

export function analyzePartHeaderRow(matrix, headerRowIndex) {
  return { columns: guessPartColumns(matrix[headerRowIndex]) };
}

export function analyzePartSheet(matrix) {
  const headerRowIndex = guessPartHeaderRowIndex(matrix);
  const { columns } = analyzePartHeaderRow(matrix, headerRowIndex);
  const dataRowCount = matrix.length - headerRowIndex - 1;
  const score = (columns.description !== undefined || columns.code !== undefined ? 10 : 0)
    + (columns.price !== undefined ? 5 : 0)
    + Math.min(dataRowCount, 50) / 10;

  return { headerRowIndex, columns, score };
}

export function readPartWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' }),
  })).filter((sheet) => sheet.matrix.length > 0);

  let best = null;
  sheets.forEach((sheet) => {
    const analysis = analyzePartSheet(sheet.matrix);
    if (!best || analysis.score > best.analysis.score) {
      best = { sheet, analysis };
    }
  });

  return {
    sheets,
    bestSheetName: best ? best.sheet.name : sheets[0]?.name || '',
  };
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const normalized = text.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractPartRows(matrix, headerRowIndex, mapping) {
  const rows = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const raw = matrix[i] || [];
    const readCell = (index) => (index === undefined || index === '' ? '' : String(raw[index] ?? '').trim());

    const description = readCell(mapping.description);
    const code = readCell(mapping.code);
    if (!description && !code) continue;

    rows.push({
      code,
      description,
      brand: readCell(mapping.brand),
      vehicle: readCell(mapping.vehicle),
      quantity: readCell(mapping.quantity),
      price: parseNumber(raw[mapping.price]),
    });
  }

  return rows;
}

export function buildPriceRadarWorkbook(results) {
  const rows = [
    OUTPUT_HEADER_ROW,
    ...results.map((row) => [
      row.code,
      row.description,
      row.brand,
      row.vehicle,
      row.quantity,
      row.price ?? '',
      row.median ?? '',
      row.minPrice ?? '',
      row.maxPrice ?? '',
      row.offerCount ?? '',
      row.diffPercent != null ? Number(row.diffPercent.toFixed(1)) : '',
      row.confidencePercent ?? '',
      row.statusLabel,
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Radar de Precos');
  return workbook;
}

export function downloadPriceRadarWorkbook(results, fileName = 'radar-de-precos.xlsx') {
  const workbook = buildPriceRadarWorkbook(results);
  XLSX.writeFile(workbook, fileName);
}

export function downloadPriceRadarTemplate(fileName = 'modelo-radar-de-precos.xlsx') {
  const rows = [
    INPUT_HEADER_ROW,
    ['BP1234', 'Pastilha de freio dianteira', 'Bosch', 'Chevrolet Onix 1.0 2020', 4, 210],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Radar de Precos');
  XLSX.writeFile(workbook, fileName);
}
