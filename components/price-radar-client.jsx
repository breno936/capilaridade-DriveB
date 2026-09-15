'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  analyzePartHeaderRow,
  analyzePartSheet,
  downloadPriceRadarTemplate,
  downloadPriceRadarWorkbook,
  extractPartRows,
  readPartWorkbook,
} from '../lib/price-workbook';
import {
  fetchRealOffers,
  formatCurrency,
  formatPercent,
  generatePriceRadarStudy,
  STATUS_CHIP_TONE,
  STATUS_LABELS,
} from '../lib/price-radar';
import { formatNumber } from '../lib/workshop-utils';

const statusFilterOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'muito_abaixo', label: 'Muito abaixo' },
  { value: 'abaixo', label: 'Abaixo' },
  { value: 'na_media', label: 'Na media' },
  { value: 'acima', label: 'Acima' },
  { value: 'muito_acima', label: 'Muito acima' },
  { value: 'sem_referencia', label: 'Sem referencia' },
];

const kpiTones = {
  muito_abaixo: 'tone-green',
  abaixo: 'tone-green',
  na_media: 'tone-cyan',
  acima: 'tone-amber',
  muito_acima: 'tone-rose',
  semReferencia: 'tone-amber',
};

const emptyMapping = {
  code: undefined,
  description: undefined,
  brand: undefined,
  vehicle: undefined,
  quantity: undefined,
  price: undefined,
};

function columnLabel(headerRow, index) {
  const text = String(headerRow?.[index] ?? '').trim();
  return text || `Coluna ${index + 1}`;
}

function FieldSelect({ label, value, onChange, headerRow, required = false }) {
  return (
    <label className="filter-control filter-card mapping-field">
      <span>{label}{required ? ' *' : ''}</span>
      <select
        value={value === undefined ? '' : value}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      >
        <option value="">{required ? 'Selecione a coluna...' : 'Nao informar'}</option>
        {(headerRow || []).map((_, index) => (
          <option key={index} value={index}>{columnLabel(headerRow, index)}</option>
        ))}
      </select>
    </label>
  );
}

function StatusChip({ status }) {
  const tone = STATUS_CHIP_TONE[status] || '';
  return <span className={`status-chip ${tone}`.trim()}>{STATUS_LABELS[status]}</span>;
}

export default function PriceRadarClient() {
  const [stage, setStage] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [sheets, setSheets] = useState([]);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mapping, setMapping] = useState(emptyMapping);

  const [study, setStudy] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const currentSheet = useMemo(
    () => sheets.find((sheet) => sheet.name === selectedSheetName) || null,
    [sheets, selectedSheetName],
  );
  const headerRow = currentSheet?.matrix[headerRowIndex] || currentSheet?.matrix[0] || [];

  function applySheet(sheetName, sheetList) {
    const sheet = sheetList.find((item) => item.name === sheetName) || sheetList[0];
    if (!sheet) return;
    const { headerRowIndex: guessedRowIndex, columns } = analyzePartSheet(sheet.matrix);

    setSelectedSheetName(sheet.name);
    setHeaderRowIndex(guessedRowIndex);
    setMapping({ ...emptyMapping, ...columns });
  }

  async function processFile(file) {
    if (!file) return;
    setParseError('');
    setFileName(file.name);
    setStudy(null);

    try {
      const buffer = await file.arrayBuffer();
      const { sheets: parsedSheets, bestSheetName } = readPartWorkbook(buffer);

      if (!parsedSheets.length) {
        setParseError('Essa planilha parece estar vazia.');
        return;
      }

      setSheets(parsedSheets);
      applySheet(bestSheetName, parsedSheets);
      setStage('mapping');
    } catch (parseCatchError) {
      setParseError('Nao foi possivel ler esse arquivo. Confira se e um .xlsx ou .xls valido.');
    }
  }

  function onFileInputChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    processFile(file);
  }

  function onDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    processFile(event.dataTransfer.files?.[0]);
  }

  function onSheetChange(name) {
    applySheet(name, sheets);
  }

  function onHeaderRowChange(newIndex) {
    if (!currentSheet) return;
    const { columns } = analyzePartHeaderRow(currentSheet.matrix, newIndex);
    setHeaderRowIndex(newIndex);
    setMapping({ ...emptyMapping, ...columns });
  }

  function updateMapping(patch) {
    setMapping((previous) => ({ ...previous, ...patch }));
  }

  const previewRows = useMemo(() => {
    if (!currentSheet) return [];
    return extractPartRows(currentSheet.matrix, headerRowIndex, mapping).slice(0, 5);
  }, [currentSheet, headerRowIndex, mapping]);

  const mappingIsValid = (mapping.code !== undefined || mapping.description !== undefined) && mapping.price !== undefined;

  async function generateStudy() {
    if (!currentSheet || !mappingIsValid) return;
    const rows = extractPartRows(currentSheet.matrix, headerRowIndex, mapping);
    if (!rows.length) {
      setParseError('Nenhuma linha com codigo ou descricao foi encontrada com esse mapeamento.');
      return;
    }
    setParseError('');
    setIsSearching(true);
    const realOffersById = await fetchRealOffers(rows);
    setIsSearching(false);

    setStudy(generatePriceRadarStudy({ rows, realOffersById }));
    setStatusFilter('all');
    setSearch('');
    setStage('results');
  }

  function resetToUpload() {
    setStage('upload');
    setFileName('');
    setParseError('');
    setSheets([]);
    setSelectedSheetName('');
    setHeaderRowIndex(0);
    setMapping(emptyMapping);
    setStudy(null);
  }

  const filteredResults = useMemo(() => {
    if (!study) return [];
    const term = search.trim().toLowerCase();
    return study.results.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${row.code} ${row.description} ${row.brand} ${row.vehicle}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [study, statusFilter, search]);

  return (
    <div className="study-shell">
      <main className="study-main">
        <header className="topbar">
          <div>
            <div className="title-row">
              <h1>Radar de Precos</h1>
              <span className="scope-pill">Google Shopping + fallback simulado</span>
            </div>
            <p>Suba a planilha de pecas com o preco proposto e o sistema compara com uma referencia de mercado, classificando cada item.</p>
          </div>
          <div className="topbar-status">
            <Link className="app-switch-link" href="/">
              <span aria-hidden="true">←</span> Voltar ao dashboard
            </Link>
          </div>
        </header>

        <p className="upload-notice">
          A busca de precos tenta o Google Shopping (varias lojas) via SerpApi. Quando uma peca nao tem correspondencia
          real ou a chave da API nao esta configurada no servidor, o item cai automaticamente para uma oferta
          <strong> simulada</strong>, so para nao travar o fluxo - isso fica marcado na tabela de resultados.
        </p>

        {stage === 'upload' ? (
          <section className="panel upload-panel">
            <div className="panel-heading">
              <div>
                <h2>1. Suba a planilha de pecas</h2>
                <p>Aceitamos varios formatos de planilha: no proximo passo voce confirma quais colunas sao Codigo, Descricao, Preco etc.</p>
              </div>
            </div>

            <label
              className={`upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileInputChange}
                hidden
              />
              <span className="upload-icon" aria-hidden="true">⇪</span>
              <strong>{fileName || 'Arraste o .xlsx aqui ou clique para selecionar'}</strong>
              <span className="muted-small">Aceita .xlsx e .xls</span>
            </label>

            {parseError ? <p className="upload-error">{parseError}</p> : null}

            <button className="text-button" onClick={() => downloadPriceRadarTemplate()} type="button">
              Baixar modelo em branco
            </button>
          </section>
        ) : null}

        {stage === 'mapping' && currentSheet ? (
          <section className="panel upload-panel">
            <div className="panel-heading">
              <div>
                <h2>2. Confira o mapeamento das colunas</h2>
                <p>Arquivo: <strong>{fileName}</strong>. Ajuste abaixo se algo nao foi identificado corretamente.</p>
              </div>
              <button className="text-button" onClick={resetToUpload} type="button">Trocar arquivo</button>
            </div>

            <div className="mapping-grid">
              {sheets.length > 1 ? (
                <label className="filter-control filter-card mapping-field">
                  <span>Aba da planilha</span>
                  <select value={selectedSheetName} onChange={(event) => onSheetChange(event.target.value)}>
                    {sheets.map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>{sheet.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="filter-control filter-card mapping-field">
                <span>Linha do cabecalho</span>
                <select value={headerRowIndex} onChange={(event) => onHeaderRowChange(Number(event.target.value))}>
                  {currentSheet.matrix.slice(0, 15).map((row, index) => (
                    <option key={index} value={index}>
                      {`Linha ${index + 1}: ${row.filter((cell) => String(cell ?? '').trim()).join(' | ').slice(0, 60) || '(vazia)'}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mapping-grid">
              <FieldSelect
                label="Codigo / SKU"
                value={mapping.code}
                onChange={(value) => updateMapping({ code: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Descricao"
                value={mapping.description}
                onChange={(value) => updateMapping({ description: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Marca"
                value={mapping.brand}
                onChange={(value) => updateMapping({ brand: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Veiculo"
                value={mapping.vehicle}
                onChange={(value) => updateMapping({ vehicle: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Quantidade"
                value={mapping.quantity}
                onChange={(value) => updateMapping({ quantity: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Preco proposto"
                required
                value={mapping.price}
                onChange={(value) => updateMapping({ price: value })}
                headerRow={headerRow}
              />
            </div>

            <p className="muted-small">Informe pelo menos Codigo ou Descricao, alem do Preco proposto, para gerar o radar.</p>

            {parseError ? <p className="upload-error">{parseError}</p> : null}

            <div className="panel-heading compact mapping-preview-heading">
              <span>Previa ({previewRows.length} de {Math.max(currentSheet.matrix.length - headerRowIndex - 1, 0)} linhas)</span>
            </div>

            <div className="table-wrapper mapping-preview">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Descricao</th>
                    <th>Marca</th>
                    <th>Veiculo</th>
                    <th>Quantidade</th>
                    <th>Preco</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index}>
                      <td>{row.code || '-'}</td>
                      <td>{row.description || '-'}</td>
                      <td>{row.brand || '-'}</td>
                      <td>{row.vehicle || '-'}</td>
                      <td>{row.quantity || '-'}</td>
                      <td>{row.price != null ? formatCurrency(row.price) : '-'}</td>
                    </tr>
                  ))}
                  {!previewRows.length ? (
                    <tr><td colSpan={6} className="muted">Nenhuma linha reconhecida com esse mapeamento ainda.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <button className="primary-button mapping-submit" onClick={generateStudy} disabled={!mappingIsValid || isSearching} type="button">
              {isSearching ? 'Buscando precos...' : 'Gerar radar de precos'}
            </button>
          </section>
        ) : null}

        {stage === 'results' && study ? (
          <>
            <section className="kpi-grid study-kpi-grid">
              <div className={`kpi-card ${kpiTones.muito_abaixo}`}>
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Muito abaixo</span></div>
                <strong className="kpi-value">{formatNumber(study.summary.muito_abaixo)}</strong>
              </div>
              <div className={`kpi-card ${kpiTones.abaixo}`}>
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Abaixo</span></div>
                <strong className="kpi-value">{formatNumber(study.summary.abaixo)}</strong>
              </div>
              <div className={`kpi-card ${kpiTones.na_media}`}>
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Na media</span></div>
                <strong className="kpi-value">{formatNumber(study.summary.na_media)}</strong>
              </div>
              <div className={`kpi-card ${kpiTones.acima}`}>
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Acima</span></div>
                <strong className="kpi-value">{formatNumber(study.summary.acima)}</strong>
              </div>
              <div className={`kpi-card ${kpiTones.muito_acima}`}>
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Muito acima</span></div>
                <strong className="kpi-value">{formatNumber(study.summary.muito_acima)}</strong>
              </div>
              <div className={`kpi-card ${kpiTones.semReferencia}`}>
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Sem referencia</span></div>
                <strong className="kpi-value">{formatNumber(study.summary.semReferencia)}</strong>
              </div>
            </section>

            <section className="panel table-panel">
              <div className="panel-heading table-heading">
                <div>
                  <div className="title-row">
                    <h2>3. Resultado do radar</h2>
                    <span className="scope-pill">{formatNumber(study.summary.total)} pecas</span>
                  </div>
                  <p>
                    Mostrando {formatNumber(filteredResults.length)} de {formatNumber(study.results.length)} pecas.{' '}
                    {formatNumber(study.summary.realCount)} com dados reais (Google Shopping) e{' '}
                    {formatNumber(study.summary.mockCount)} com dados simulados.
                  </p>
                </div>
                <div className="table-actions">
                  <input
                    type="search"
                    placeholder="Buscar codigo, descricao ou marca..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button className="text-button" onClick={() => setStage('mapping')} type="button">Ajustar mapeamento</button>
                  <button className="primary-button" onClick={() => downloadPriceRadarWorkbook(filteredResults)} type="button">
                    Exportar .xlsx
                  </button>
                </div>
              </div>

              <div className="segmented-control study-status-filter" role="group" aria-label="Filtro de classificacao">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    className={statusFilter === option.value ? 'is-active' : ''}
                    onClick={() => setStatusFilter(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Peca</th>
                      <th>Marca</th>
                      <th>Veiculo</th>
                      <th>Preco DriveB</th>
                      <th>Mediana mercado</th>
                      <th>Faixa</th>
                      <th>Diferenca</th>
                      <th>Confianca</th>
                      <th>Ofertas</th>
                      <th>Classificacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((row, index) => (
                      <tr key={`${row.code}-${row.description}-${index}`}>
                        <td>
                          <strong>{row.description || row.code || 'Sem descricao'}</strong><br />
                          <span className="muted-small">
                            {row.code || 'Sem codigo'}
                            {row.isMock ? ' · simulado' : ' · Google Shopping'}
                          </span>
                        </td>
                        <td>{row.brand || '-'}</td>
                        <td>{row.vehicle || '-'}</td>
                        <td>{row.price != null ? formatCurrency(row.price) : '-'}</td>
                        <td>{row.median != null ? formatCurrency(row.median) : '-'}</td>
                        <td>
                          {row.minPrice != null && row.maxPrice != null
                            ? `${formatCurrency(row.minPrice)} - ${formatCurrency(row.maxPrice)}`
                            : '-'}
                        </td>
                        <td>{formatPercent(row.diffPercent)}</td>
                        <td>{row.confidencePercent}%</td>
                        <td>{row.offerCount}</td>
                        <td><StatusChip status={row.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
