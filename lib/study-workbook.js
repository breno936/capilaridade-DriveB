import * as XLSX from 'xlsx';
import { stateNameByCode } from './workshop-utils';

const VALID_STATE_CODES = new Set(Object.keys(stateNameByCode));

const INPUT_HEADER_ROW = ['CONSULTOR', 'CLIENTE', 'Cidade', 'Estado', 'Qtd. Veiculos', 'Frota Leve ou Pesada'];
const OUTPUT_TITLE_ROW = ['', '', '', 'INFORMACOES CLIENTE', '', '', 'INFORMACOES REDE OFICINAS', '', '', '', '', ''];
const OUTPUT_HEADER_ROW = ['CONSULTOR', 'CLIENTE', 'Cidade', 'Estado', 'Qtd. Veiculos', 'Frota Leve ou Pesada', 'Possuimos Oficina?', 'Quantidade de oficinas', 'Tipos de cobertura', 'Tipos de oficina', 'Distancia da oficina mais proxima (km)', 'Cidade mais proxima'];

const SERVICE_TYPE_LABELS = {
  oficina: 'Oficina',
  vidros: 'Vidros',
  pneus: 'Pneus',
  funilaria: 'Funilaria e Pintura',
  concessionaria: 'Concessionaria',
};

function formatServiceCounts(serviceCounts) {
  if (!serviceCounts) return '';
  return Object.entries(serviceCounts)
    .sort((left, right) => right[1] - left[1])
    .map(([tag, count]) => `${SERVICE_TYPE_LABELS[tag] || tag}: ${count}`)
    .join(', ');
}

function formatBrandCounts(brandCounts) {
  if (!brandCounts) return '';
  return Object.entries(brandCounts)
    .sort((left, right) => right[1] - left[1])
    .map(([brand, count]) => `${brand}: ${count}`)
    .join(', ');
}

const HEADER_SCAN_LIMIT = 12;
const CITY_STATE_SEPARATOR_PATTERN = /^(.+?)\s*[\/\-–,]\s*([A-Za-z]{2})$/;
const CITY_STATE_SPACE_PATTERN = /^(.+?)\s+([A-Za-z]{2})$/;

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function splitCityState(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const separatorMatch = CITY_STATE_SEPARATOR_PATTERN.exec(text);
  if (separatorMatch) {
    return { city: separatorMatch[1].trim(), state: separatorMatch[2].trim().toUpperCase() };
  }

  // Also accept "Cidade UF" separated only by whitespace (e.g. "Porto Alegre RS"),
  // but only when the trailing token is a real Brazilian state abbreviation -
  // otherwise a plain city name could be mistaken for one (e.g. "Santa Fe").
  const spaceMatch = CITY_STATE_SPACE_PATTERN.exec(text);
  if (spaceMatch) {
    const state = spaceMatch[2].trim().toUpperCase();
    if (VALID_STATE_CODES.has(state)) {
      return { city: spaceMatch[1].trim(), state };
    }
  }

  return null;
}

export function guessColumns(headerRow) {
  const columns = {};
  (headerRow || []).forEach((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (!header) return;
    if (columns.consultant === undefined && header.includes('consultor')) columns.consultant = index;
    else if (columns.client === undefined && (header.includes('cliente') || header.includes('locador') || header.includes('empresa'))) columns.client = index;
    else if (
      columns.city === undefined
      && (header.includes('cidade') || header.includes('municipio') || header.includes('localidade') || header === 'praca' || header.includes('praca de'))
      && !header.includes('proxima')
    ) columns.city = index;
    else if (columns.state === undefined && (header.includes('estado') || header === 'uf' || header.includes(' uf'))) columns.state = index;
    else if (columns.vehicleCount === undefined && (header.includes('veiculo') || header.includes('frota') && header.includes('qtd'))) columns.vehicleCount = index;
    else if (columns.fleetType === undefined && header.includes('frota') && !header.includes('qtd')) columns.fleetType = index;
  });
  return columns;
}

function countNonEmpty(row) {
  return (row || []).filter((cell) => String(cell ?? '').trim() !== '').length;
}

export function guessHeaderRowIndex(matrix) {
  const scanLimit = Math.min(matrix.length, HEADER_SCAN_LIMIT);
  let best = { rowIndex: 0, score: -1 };

  for (let i = 0; i < scanLimit; i++) {
    const columns = guessColumns(matrix[i]);
    const matchedFields = Object.keys(columns).length;
    if (columns.city === undefined) continue;

    const score = matchedFields * 10 + (columns.state !== undefined ? 5 : 0);
    if (score > best.score) best = { rowIndex: i, score };
  }

  if (best.score < 0) {
    // No row matched a known header keyword. If the sheet's first populated row already
    // parses as real city/state data (e.g. a bare list like "Erechim RS"), there is no
    // header row at all - data starts on row 0.
    const firstDataRow = matrix.find((row) => countNonEmpty(row) >= 1);
    if (firstDataRow && firstDataRow.some((cell) => splitCityState(cell) !== null)) {
      return -1;
    }

    const fallbackRow = matrix.findIndex((row) => countNonEmpty(row) >= 2);
    return fallbackRow === -1 ? 0 : fallbackRow;
  }

  return best.rowIndex;
}

function detectSingleColumnCityState(matrix, headerRowIndex) {
  let matched = 0;
  let sampled = 0;

  for (let i = headerRowIndex + 1; i < matrix.length && sampled < 15; i++) {
    const row = matrix[i] || [];
    if (countNonEmpty(row) !== 1) return false;
    const value = row[0];
    if (!String(value ?? '').trim()) continue;
    sampled += 1;
    if (splitCityState(value)) matched += 1;
  }

  return sampled > 0 && matched / sampled >= 0.7;
}

function detectCityStateCombined(matrix, headerRowIndex, cityColumnIndex) {
  if (cityColumnIndex === undefined) return false;
  let matched = 0;
  let sampled = 0;

  for (let i = headerRowIndex + 1; i < matrix.length && sampled < 15; i++) {
    const value = matrix[i]?.[cityColumnIndex];
    if (!String(value ?? '').trim()) continue;
    sampled += 1;
    if (splitCityState(value)) matched += 1;
  }

  return sampled > 0 && matched / sampled >= 0.7;
}

export function analyzeHeaderRow(matrix, headerRowIndex) {
  const columns = guessColumns(matrix[headerRowIndex]);
  let cityStateCombined = detectCityStateCombined(matrix, headerRowIndex, columns.city);

  if (columns.city === undefined && detectSingleColumnCityState(matrix, headerRowIndex)) {
    columns.city = 0;
    cityStateCombined = true;
  }

  return { columns, cityStateCombined };
}

export function analyzeSheet(matrix) {
  const headerRowIndex = guessHeaderRowIndex(matrix);
  const { columns, cityStateCombined } = analyzeHeaderRow(matrix, headerRowIndex);
  const dataRowCount = matrix.length - headerRowIndex - 1;
  const score = (columns.city !== undefined ? 10 : 0)
    + (columns.state !== undefined || cityStateCombined ? 5 : 0)
    + Math.min(dataRowCount, 50) / 10;

  return { headerRowIndex, columns, cityStateCombined, score };
}

export function readWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' }),
  })).filter((sheet) => sheet.matrix.length > 0);

  let best = null;
  sheets.forEach((sheet) => {
    const analysis = analyzeSheet(sheet.matrix);
    if (!best || analysis.score > best.analysis.score) {
      best = { sheet, analysis };
    }
  });

  return {
    sheets,
    bestSheetName: best ? best.sheet.name : sheets[0]?.name || '',
  };
}

export function extractRows(matrix, headerRowIndex, mapping) {
  const rows = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const raw = matrix[i] || [];
    const readCell = (index) => (index === undefined || index === '' ? '' : String(raw[index] ?? '').trim());

    let city = '';
    let state = '';

    if (mapping.cityStateCombined) {
      const split = splitCityState(readCell(mapping.city));
      if (split) {
        city = split.city;
        state = split.state;
      } else {
        city = readCell(mapping.city);
      }
    } else {
      city = readCell(mapping.city);
      state = readCell(mapping.state);
    }

    if (!city) continue;

    rows.push({
      consultant: readCell(mapping.consultant),
      client: readCell(mapping.client),
      city,
      state,
      vehicleCount: readCell(mapping.vehicleCount),
      fleetType: readCell(mapping.fleetType),
    });
  }

  return rows;
}

export function buildStudyWorkbook(results) {
  const rows = [
    OUTPUT_TITLE_ROW,
    OUTPUT_HEADER_ROW,
    ...results.map((row) => [
      row.consultant,
      row.client,
      row.city,
      row.stateCode || row.state,
      row.vehicleCount,
      row.fleetType,
      row.status === 'unresolved' ? 'Cidade nao localizada' : (row.hasWorkshop ? 'Sim' : 'Nao'),
      row.hasWorkshop ? row.workshopCount : '',
      formatServiceCounts(row.serviceCounts),
      formatBrandCounts(row.brandCounts),
      row.nearestDistanceKm != null ? Math.round(row.nearestDistanceKm) : '',
      row.nearestCityLabel,
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = [
    { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
    { s: { r: 0, c: 6 }, e: { r: 0, c: 11 } },
  ];
  sheet['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 34 }, { wch: 34 }, { wch: 16 }, { wch: 32 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Estudo de Capilaridade');
  return workbook;
}

export function downloadStudyWorkbook(results, fileName = 'estudo-capilaridade.xlsx') {
  const workbook = buildStudyWorkbook(results);
  XLSX.writeFile(workbook, fileName);
}

export function downloadStudyTemplate(fileName = 'modelo-estudo-capilaridade.xlsx') {
  const rows = [
    INPUT_HEADER_ROW,
    ['Nome do consultor', 'Nome do cliente', 'Araxa', 'MG', 12, 'leve'],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Estudo de Capilaridade');
  XLSX.writeFile(workbook, fileName);
}
