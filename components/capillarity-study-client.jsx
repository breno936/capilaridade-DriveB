'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { coverageTypeLabel, defaultFilters, enrichWorkshops, filterWorkshops, formatNumber } from '../lib/workshop-utils';
import {
  buildCityKey,
  buildCityLookup,
  buildCoverageIndex,
  generateCapillarityStudy,
  haversineKm,
} from '../lib/capillarity-study';
import {
  analyzeHeaderRow,
  analyzeSheet,
  downloadStudyTemplate,
  downloadStudyWorkbook,
  extractRows,
  readWorkbook,
} from '../lib/study-workbook';
import initialCityCache from '../data/city-cache.json';
import initialWorkshopCategories from '../data/workshop-categories.json';

const statusFilterOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'covered', label: 'Com cobertura' },
  { value: 'uncovered', label: 'Sem cobertura' },
  { value: 'unresolved', label: 'Nao localizada' },
];

const radiusOptions = [
  { value: 0, label: 'Cidade exata' },
  { value: 30, label: 'Ate 30 km' },
  { value: 40, label: 'Ate 40 km' },
  { value: 50, label: 'Ate 50 km' },
  { value: 80, label: 'Ate 80 km' },
  { value: 100, label: 'Ate 100 km' },
  { value: 200, label: 'Ate 200 km' },
];

const emptyMapping = {
  city: undefined,
  state: undefined,
  cityStateCombined: false,
  consultant: undefined,
  client: undefined,
  vehicleCount: undefined,
  fleetType: undefined,
};

function StatusCard({ title, description }) {
  return (
    <main className="status-shell">
      <section className="status-card">
        <p className="eyebrow">Capilaridade</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </section>
    </main>
  );
}

function StatusChip({ status }) {
  if (status === 'covered') return <span className="status-chip ideal">Com cobertura</span>;
  if (status === 'uncovered') return <span className="status-chip attention">Sem cobertura</span>;
  return <span className="status-chip critical">Nao localizada</span>;
}

function ServiceTypeBadges({ serviceCounts }) {
  if (!serviceCounts) return <span className="muted-small">-</span>;
  const entries = Object.entries(serviceCounts).sort((left, right) => right[1] - left[1]);
  if (!entries.length) return <span className="muted-small">-</span>;

  return (
    <div className="badges">
      {entries.map(([tag, count]) => (
        <span className="badge info" key={tag}>{coverageTypeLabel(tag)} · {count}</span>
      ))}
    </div>
  );
}

function BrandBadges({ brandCounts }) {
  if (!brandCounts) return <span className="muted-small">-</span>;
  const entries = Object.entries(brandCounts).sort((left, right) => right[1] - left[1]);
  if (!entries.length) return <span className="muted-small">-</span>;

  return (
    <div className="badges badges-scroll">
      {entries.map(([brand, count]) => (
        <span className="badge" key={brand}>{brand} · {count}</span>
      ))}
    </div>
  );
}

function selectWorkshopsForSettings(driveBWorkshops, settings) {
  const selectedTableIds = settings?.selectedTableIds?.length ? settings.selectedTableIds : ['all'];
  const modelFilter = settings?.modelFilter || 'all';

  let filtered = driveBWorkshops;
  if (!selectedTableIds.includes('all')) {
    const idsSet = new Set(selectedTableIds);
    filtered = filtered.filter((item) => (item.negotiationTables || []).some((table) => idsSet.has(String(table.id))));
  }
  if (modelFilter === 'fee') filtered = filtered.filter((item) => item.isFee);
  else if (modelFilter === 'margin') filtered = filtered.filter((item) => item.isMargin);
  return filtered;
}

function formatHistoryDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

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

export default function CapillarityStudyClient({ clientId } = {}) {
  const [workshops, setWorkshops] = useState([]);
  const [brCities, setBrCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientLoading, setClientLoading] = useState(Boolean(clientId));
  const [studyHistory, setStudyHistory] = useState([]);
  const [viewingStudyId, setViewingStudyId] = useState(null);
  const [savedInputRows, setSavedInputRows] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [savedFileName, setSavedFileName] = useState('');
  const [isSavingStudy, setIsSavingStudy] = useState(false);
  const [saveError, setSaveError] = useState('');

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
  const [radiusKm, setRadiusKm] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedTableIds, setSelectedTableIds] = useState(['all']);
  const [autoIncludeNote, setAutoIncludeNote] = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [studyTableLabel, setStudyTableLabel] = useState('Toda a rede DriveB');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const [workshopsResponse, citiesResponse] = await Promise.all([
          fetch('/data/workshops.json', { cache: 'no-store' }),
          fetch('/data/br-cities.json', { cache: 'force-cache' }),
        ]);
        if (!workshopsResponse.ok) throw new Error(`Falha ao carregar oficinas (${workshopsResponse.status})`);
        if (!citiesResponse.ok) throw new Error(`Falha ao carregar cidades (${citiesResponse.status})`);

        const workshopsPayload = await workshopsResponse.json();
        const citiesPayload = await citiesResponse.json();

        if (!cancelled) {
          setWorkshops(enrichWorkshops(workshopsPayload, initialCityCache, initialWorkshopCategories));
          setBrCities(citiesPayload);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Nao foi possivel carregar a base de dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;

    async function loadClient() {
      try {
        setClientLoading(true);
        const response = await fetch(`/api/clients/${clientId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar cliente (${response.status})`);
        const data = await response.json();
        if (cancelled) return;

        setClientName(data.client.name);
        setStudyHistory(data.studies || []);

        const latest = data.studies?.[0];
        if (latest) {
          setStudy({ results: latest.results, summary: latest.summary });
          setStudyTableLabel(latest.settings?.label || 'Toda a rede DriveB');
          setViewingStudyId(latest.id);
          setSavedInputRows(latest.input_rows);
          setSavedSettings(latest.settings);
          setSavedFileName(latest.file_name || '');
          setStage('results');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Nao foi possivel carregar o cliente.');
      } finally {
        if (!cancelled) setClientLoading(false);
      }
    }

    loadClient();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const currentSheet = useMemo(
    () => sheets.find((sheet) => sheet.name === selectedSheetName) || null,
    [sheets, selectedSheetName],
  );
  const headerRow = currentSheet?.matrix[headerRowIndex] || currentSheet?.matrix[0] || [];

  function applySheet(sheetName, sheetList) {
    const sheet = sheetList.find((item) => item.name === sheetName) || sheetList[0];
    if (!sheet) return;
    const { headerRowIndex: guessedRowIndex, columns, cityStateCombined } = analyzeSheet(sheet.matrix);

    setSelectedSheetName(sheet.name);
    setHeaderRowIndex(guessedRowIndex);
    setMapping({ ...emptyMapping, ...columns, cityStateCombined });
  }

  async function processFile(file) {
    if (!file) return;
    setParseError('');
    setFileName(file.name);
    setStudy(null);

    try {
      const buffer = await file.arrayBuffer();
      const { sheets: parsedSheets, bestSheetName } = readWorkbook(buffer);

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
    const { columns, cityStateCombined } = analyzeHeaderRow(currentSheet.matrix, newIndex);
    setHeaderRowIndex(newIndex);
    setMapping({ ...emptyMapping, ...columns, cityStateCombined });
  }

  function updateMapping(patch) {
    setMapping((previous) => ({ ...previous, ...patch }));
  }

  const previewRows = useMemo(() => {
    if (!currentSheet) return [];
    return extractRows(currentSheet.matrix, headerRowIndex, mapping).slice(0, 5);
  }, [currentSheet, headerRowIndex, mapping]);

  const mappingIsValid = mapping.city !== undefined && (mapping.cityStateCombined || mapping.state !== undefined);

  // O sistema de tabelas de negociacao so existe para a franquia DriveB e so faz sentido dentro
  // do Brasil - misturar "Outros" ou oficinas fora do Brasil aqui infla a contagem.
  const driveBWorkshops = useMemo(
    () => filterWorkshops(workshops, {
      ...defaultFilters,
      franchiseId: '1',
      isActive: 'true',
      isBlocked: 'false',
    }),
    [workshops],
  );

  const unresolvedCityCount = useMemo(
    () => driveBWorkshops.filter((item) => !item.hasResolvedCity).length,
    [driveBWorkshops],
  );

  const tableOptions = useMemo(() => {
    const counts = new Map();
    driveBWorkshops.forEach((item) => {
      (item.negotiationTables || []).forEach((table) => {
        const key = String(table.id);
        const current = counts.get(key) || { id: key, descricao: table.descricao, count: 0 };
        current.count += 1;
        counts.set(key, current);
      });
    });
    return [...counts.values()].sort((left, right) => right.count - left.count);
  }, [driveBWorkshops]);

  // As redes regionais de pneus (Campneus, GP Pneus, HC Pneus, Della Via, etc.) sao vinculadas
  // comercialmente a tabela Combate Ajustada, nao a Nacional - confirmado pelo time de redes.
  function isTireNetworkTable(descricao) {
    const text = String(descricao || '').trim();
    return text.length > 0 && !/^tabela/i.test(text) && !/^teste$/i.test(text);
  }

  function isCombateTable(descricao) {
    return /combate/i.test(String(descricao || ''));
  }

  // Grupos de tabelas que "viajam juntas": ao marcar uma, as demais do grupo entram
  // automaticamente (com aviso), mas a pessoa pode desmarcar individualmente se quiser.
  // A tabela Nacional (e variacoes +20%/+40%/+60%) NAO entra nesse agrupamento automatico -
  // so conta quando selecionada manualmente ou via "Toda a rede DriveB".
  const tableGroups = useMemo(() => {
    const groups = [];
    const combateIds = tableOptions.filter((table) => isCombateTable(table.descricao)).map((table) => table.id);
    const tireIds = tableOptions.filter((table) => isTireNetworkTable(table.descricao)).map((table) => table.id);
    if (combateIds.length + tireIds.length > 1) {
      groups.push({ ids: [...combateIds, ...tireIds], label: 'Combate Ajustada + redes de pneus' });
    }
    return groups;
  }, [tableOptions]);

  function groupContaining(id) {
    return tableGroups.find((group) => group.ids.includes(id));
  }

  function toggleTableId(id) {
    if (id === 'all') {
      setSelectedTableIds(['all']);
      setAutoIncludeNote('');
      return;
    }

    setSelectedTableIds((previous) => {
      const withoutAll = previous.filter((value) => value !== 'all');
      const isChecked = withoutAll.includes(id);

      if (isChecked) {
        setAutoIncludeNote('');
        const next = withoutAll.filter((value) => value !== id);
        return next.length ? next : ['all'];
      }

      let next = [...withoutAll, id];
      const group = groupContaining(id);
      if (group) {
        const added = group.ids.filter((groupId) => groupId !== id && !withoutAll.includes(groupId));
        if (added.length) {
          next = [...next, ...added];
          const addedLabels = added
            .map((addedId) => tableOptions.find((table) => table.id === addedId)?.descricao)
            .filter(Boolean);
          const addedText = addedLabels.length > 4
            ? `${formatNumber(addedLabels.length)} tabelas relacionadas`
            : addedLabels.join(', ');
          setAutoIncludeNote(`${addedText} incluida(s) automaticamente. Desmarque na lista se nao quiser considera-las.`);
        } else {
          setAutoIncludeNote('');
        }
      } else {
        setAutoIncludeNote('');
      }
      return next;
    });
  }

  const effectiveTableIds = useMemo(() => {
    if (selectedTableIds.includes('all')) return null;
    return new Set(selectedTableIds);
  }, [selectedTableIds]);

  const workshopsForTable = useMemo(() => {
    if (!effectiveTableIds) return driveBWorkshops;
    return driveBWorkshops.filter((item) => (item.negotiationTables || []).some((table) => effectiveTableIds.has(String(table.id))));
  }, [driveBWorkshops, effectiveTableIds]);

  const modelFilterOptions = [
    { value: 'all', label: 'Fee e Margem' },
    { value: 'fee', label: 'Somente Fee' },
    { value: 'margin', label: 'Somente Margem' },
  ];

  const workshopsForModel = useMemo(() => {
    if (modelFilter === 'fee') return workshopsForTable.filter((item) => item.isFee);
    if (modelFilter === 'margin') return workshopsForTable.filter((item) => item.isMargin);
    return workshopsForTable;
  }, [workshopsForTable, modelFilter]);

  function buildStudyTableLabel() {
    const modelSuffix = modelFilter === 'fee' ? ' · Somente Fee' : modelFilter === 'margin' ? ' · Somente Margem' : '';
    if (selectedTableIds.includes('all')) {
      return `Toda a rede DriveB${modelSuffix} (${formatNumber(workshopsForModel.length)} oficinas)`;
    }
    const idsSet = new Set(selectedTableIds);
    const consumedIds = new Set();
    const groupLabels = [];
    tableGroups.forEach((group) => {
      if (group.ids.every((groupId) => idsSet.has(groupId))) {
        groupLabels.push(group.label);
        group.ids.forEach((groupId) => consumedIds.add(groupId));
      }
    });
    const individualLabels = selectedTableIds
      .filter((id) => !consumedIds.has(id))
      .map((id) => tableOptions.find((table) => table.id === id)?.descricao)
      .filter(Boolean);
    const labels = [...groupLabels, ...individualLabels];
    return `${labels.join(' + ')}${modelSuffix} (${formatNumber(workshopsForModel.length)} oficinas)`;
  }

  async function persistStudy({ rows, settings, studyResult, fileNameToSave }) {
    if (!clientId) return;
    setIsSavingStudy(true);
    setSaveError('');
    try {
      const response = await fetch(`/api/clients/${clientId}/studies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileNameToSave || null,
          inputRows: rows,
          settings,
          results: studyResult.results,
          summary: studyResult.summary,
        }),
      });
      if (!response.ok) throw new Error(`Falha ao salvar estudo (${response.status})`);
      const data = await response.json();
      setStudyHistory((previous) => [data.study, ...previous]);
      setViewingStudyId(data.study.id);
      setSavedInputRows(rows);
      setSavedSettings(settings);
      setSavedFileName(fileNameToSave || '');
    } catch (persistError) {
      setSaveError(persistError.message || 'Nao foi possivel salvar o estudo para este cliente.');
    } finally {
      setIsSavingStudy(false);
    }
  }

  async function generateStudy() {
    if (!currentSheet || !mappingIsValid) return;
    const rows = extractRows(currentSheet.matrix, headerRowIndex, mapping);
    if (!rows.length) {
      setParseError('Nenhuma linha com cidade preenchida foi encontrada com esse mapeamento.');
      return;
    }
    setParseError('');
    const label = buildStudyTableLabel();
    const studyResult = generateCapillarityStudy({ rows, workshops: workshopsForModel, brCities });
    setStudy(studyResult);
    setStudyTableLabel(label);
    setStatusFilter('all');
    setRadiusKm(0);
    setSearch('');
    setStage('results');

    if (clientId) {
      await persistStudy({
        rows,
        settings: { selectedTableIds, modelFilter, label },
        studyResult,
        fileNameToSave: fileName,
      });
    }
  }

  async function recalculateFromSaved() {
    if (!clientId || !savedInputRows || isSavingStudy) return;
    const workshopsForRecalc = selectWorkshopsForSettings(driveBWorkshops, savedSettings);
    const studyResult = generateCapillarityStudy({ rows: savedInputRows, workshops: workshopsForRecalc, brCities });
    setStudy(studyResult);
    setStudyTableLabel(savedSettings?.label || 'Toda a rede DriveB');
    setStatusFilter('all');
    setRadiusKm(0);
    setSearch('');
    setStage('results');

    await persistStudy({
      rows: savedInputRows,
      settings: savedSettings,
      studyResult,
      fileNameToSave: savedFileName,
    });
  }

  function viewHistoryEntry(entry) {
    setStudy({ results: entry.results, summary: entry.summary });
    setStudyTableLabel(entry.settings?.label || 'Toda a rede DriveB');
    setViewingStudyId(entry.id);
    setStatusFilter('all');
    setRadiusKm(0);
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

  // Indices para o calculo de raio: reconstruidos a partir da base de oficinas atual
  // (nao do que foi salvo no estudo), entao "Recalcular" e reabrir um estudo antigo
  // sempre usam a rede vigente. Nao dependem de radiusKm, entao ficam num memo separado.
  const radiusCoverageIndex = useMemo(() => buildCoverageIndex(workshopsForModel), [workshopsForModel]);
  const radiusCityLookup = useMemo(() => buildCityLookup(brCities), [brCities]);

  // Com raio selecionado, a quantidade de oficinas de uma cidade passa a ser a SOMA de
  // todas as oficinas de todas as cidades cobertas dentro daquela distancia (incluindo a
  // propria cidade, se ja tiver oficina) - nao so a cidade coberta mais proxima. Cidades
  // nao localizadas na base de referencia (status "unresolved") ficam de fora, pois nao
  // tem coordenada para medir distancia.
  const adjustedResults = useMemo(() => {
    if (!study) return [];
    if (!radiusKm) return study.results;

    return study.results.map((row) => {
      if (row.status === 'unresolved') return row;

      const cityKey = buildCityKey(row.city, row.stateCode || row.state);
      const target = cityKey ? radiusCityLookup.get(cityKey) : null;
      if (!target) return row;

      let count = 0;
      const serviceCounts = {};
      const brandCounts = {};
      radiusCoverageIndex.forEach((entry) => {
        if (haversineKm(target.lat, target.lng, entry.lat, entry.lng) > radiusKm) return;
        count += entry.count;
        Object.entries(entry.serviceCounts).forEach(([tag, tagCount]) => {
          serviceCounts[tag] = (serviceCounts[tag] || 0) + tagCount;
        });
        Object.entries(entry.brandCounts).forEach(([brand, brandCount]) => {
          brandCounts[brand] = (brandCounts[brand] || 0) + brandCount;
        });
      });

      return {
        ...row,
        status: count > 0 ? 'covered' : 'uncovered',
        hasWorkshop: count > 0,
        workshopCount: count,
        serviceCounts: count > 0 ? serviceCounts : null,
        brandCounts: count > 0 ? brandCounts : null,
        coveredByRadius: row.status !== 'covered' && count > 0,
      };
    });
  }, [study, radiusKm, radiusCoverageIndex, radiusCityLookup]);

  const adjustedSummary = useMemo(() => {
    const total = adjustedResults.length;
    const covered = adjustedResults.filter((row) => row.status === 'covered').length;
    const uncovered = adjustedResults.filter((row) => row.status === 'uncovered').length;
    const unresolved = adjustedResults.filter((row) => row.status === 'unresolved').length;
    return {
      total,
      covered,
      uncovered,
      unresolved,
      coveragePercent: total ? (covered / total) * 100 : 0,
      gapPercent: total ? ((uncovered + unresolved) / total) * 100 : 0,
    };
  }, [adjustedResults]);

  const filteredResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return adjustedResults.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${row.city} ${row.client} ${row.consultant}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [adjustedResults, statusFilter, search]);

  if (loading || clientLoading) {
    return <StatusCard title="Carregando estudo de capilaridade" description="Preparando a base de oficinas e o catalogo de cidades." />;
  }

  if (error) {
    return <StatusCard title="Falha ao carregar os dados" description={error} />;
  }

  return (
    <div className="study-shell">
      <main className="study-main">
        <header className="topbar">
          <div>
            <div className="title-row">
              <h1>{clientId ? `Estudo de Capilaridade - ${clientName}` : 'Estudo de Capilaridade'}</h1>
              <span className="scope-pill">Automatico</span>
            </div>
            <p>Suba a planilha do cliente e o sistema cruza cada cidade com a base de oficinas ativa, apontando cobertura e a cidade mais proxima quando nao houver oficina.</p>
          </div>
          <div className="topbar-status">
            {clientId ? (
              <Link className="app-switch-link" href="/estudo-capilaridade">
                <span aria-hidden="true">←</span> Outros clientes
              </Link>
            ) : null}
            <Link className="app-switch-link" href="/">
              <span aria-hidden="true">←</span> Voltar ao dashboard
            </Link>
          </div>
        </header>

        {stage === 'upload' ? (
          <section className="panel upload-panel">
            <div className="panel-heading">
              <div>
                <h2>1. Suba a planilha do cliente</h2>
                <p>Aceitamos varios formatos de planilha: no proximo passo voce confirma quais colunas sao Cidade, Estado etc. Nao precisa seguir um modelo fixo.</p>
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

            <button className="text-button" onClick={() => downloadStudyTemplate()} type="button">
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

            <div className="filter-control filter-card mapping-tables">
              <span>Tabela(s) de negociacao a considerar</span>
              <p className="muted-small">
                Selecione uma ou mais tabelas para restringir o estudo as oficinas que atendem nelas.
                Redes de pneus entram automaticamente com a Nacional, e as variacoes do Combate entram juntas.
                {unresolvedCityCount > 0 ? ` ${formatNumber(unresolvedCityCount)} oficinas DriveB sem cidade identificada nao entram no calculo de cobertura.` : ''}
              </p>
              {autoIncludeNote ? <p className="upload-notice">{autoIncludeNote}</p> : null}
              <div className="mapping-tables-list">
                <label className="mapping-table-option">
                  <input type="checkbox" checked={selectedTableIds.includes('all')} onChange={() => toggleTableId('all')} />
                  <span>Toda a rede DriveB ({formatNumber(driveBWorkshops.length)} oficinas)</span>
                </label>
                {tableOptions.map((table) => (
                  <label className="mapping-table-option" key={table.id}>
                    <input type="checkbox" checked={selectedTableIds.includes(table.id)} onChange={() => toggleTableId(table.id)} />
                    <span>
                      {table.descricao} ({formatNumber(table.count)} oficinas)
                      {isTireNetworkTable(table.descricao) ? <em> · rede de pneus</em> : null}
                      {isCombateTable(table.descricao) ? <em> · combate</em> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-control filter-card mapping-tables">
              <span>Modelo de remuneracao</span>
              <p className="muted-small">Filtra as oficinas consideradas no estudo por modelo Fee e/ou Margem.</p>
              <div className="segmented-control" role="group" aria-label="Filtro de modelo">
                {modelFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    className={modelFilter === option.value ? 'is-active' : ''}
                    onClick={() => setModelFilter(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
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
                  <option value={-1}>Sem linha de cabecalho (dados comecam na linha 1)</option>
                  {currentSheet.matrix.slice(0, 15).map((row, index) => (
                    <option key={index} value={index}>
                      {`Linha ${index + 1}: ${row.filter((cell) => String(cell ?? '').trim()).join(' | ').slice(0, 60) || '(vazia)'}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-control filter-card mapping-field mapping-toggle">
                <span>Cidade e Estado estao na mesma coluna? (ex: &quot;Araxa/MG&quot;)</span>
                <input
                  type="checkbox"
                  checked={mapping.cityStateCombined}
                  onChange={(event) => updateMapping({ cityStateCombined: event.target.checked })}
                />
              </label>
            </div>

            <div className="mapping-grid">
              <FieldSelect
                label={mapping.cityStateCombined ? 'Cidade (com UF)' : 'Cidade'}
                required
                value={mapping.city}
                onChange={(value) => updateMapping({ city: value })}
                headerRow={headerRow}
              />
              {!mapping.cityStateCombined ? (
                <FieldSelect
                  label="Estado"
                  required
                  value={mapping.state}
                  onChange={(value) => updateMapping({ state: value })}
                  headerRow={headerRow}
                />
              ) : null}
              <FieldSelect
                label="Consultor"
                value={mapping.consultant}
                onChange={(value) => updateMapping({ consultant: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Cliente"
                value={mapping.client}
                onChange={(value) => updateMapping({ client: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Qtd. Veiculos"
                value={mapping.vehicleCount}
                onChange={(value) => updateMapping({ vehicleCount: value })}
                headerRow={headerRow}
              />
              <FieldSelect
                label="Frota (leve/pesada)"
                value={mapping.fleetType}
                onChange={(value) => updateMapping({ fleetType: value })}
                headerRow={headerRow}
              />
            </div>

            {parseError ? <p className="upload-error">{parseError}</p> : null}

            <div className="panel-heading compact mapping-preview-heading">
              <span>Previa ({previewRows.length} de {Math.max(currentSheet.matrix.length - headerRowIndex - 1, 0)} linhas)</span>
            </div>

            <div className="table-wrapper mapping-preview">
              <table>
                <thead>
                  <tr>
                    <th>Cidade</th>
                    <th>Estado</th>
                    <th>Consultor</th>
                    <th>Cliente</th>
                    <th>Qtd. Veiculos</th>
                    <th>Frota</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index}>
                      <td>{row.city || '-'}</td>
                      <td>{row.state || '-'}</td>
                      <td>{row.consultant || '-'}</td>
                      <td>{row.client || '-'}</td>
                      <td>{row.vehicleCount || '-'}</td>
                      <td>{row.fleetType || '-'}</td>
                    </tr>
                  ))}
                  {!previewRows.length ? (
                    <tr><td colSpan={6} className="muted">Nenhuma linha reconhecida com esse mapeamento ainda.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <button className="primary-button mapping-submit" onClick={generateStudy} disabled={!mappingIsValid} type="button">
              Gerar estudo
            </button>
          </section>
        ) : null}

        {stage === 'results' && study ? (
          <>
            <section className="kpi-grid study-kpi-grid">
              <div className="kpi-card tone-cyan">
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Cidades analisadas</span></div>
                <strong className="kpi-value">{formatNumber(adjustedSummary.total)}</strong>
              </div>
              <div className="kpi-card tone-green">
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Percentual de cobertura</span></div>
                <strong className="kpi-value">{adjustedSummary.coveragePercent.toFixed(1).replace('.', ',')}%</strong>
              </div>
              <div className="kpi-card tone-rose">
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Percentual de gap</span></div>
                <strong className="kpi-value">{adjustedSummary.gapPercent.toFixed(1).replace('.', ',')}%</strong>
              </div>
              <div className="kpi-card tone-green">
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Com cobertura</span></div>
                <strong className="kpi-value">{formatNumber(adjustedSummary.covered)}</strong>
              </div>
              <div className="kpi-card tone-amber">
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Sem cobertura</span></div>
                <strong className="kpi-value">{formatNumber(adjustedSummary.uncovered)}</strong>
              </div>
              <div className="kpi-card tone-rose">
                <span className="kpi-accent" aria-hidden="true" />
                <div className="kpi-topline"><span>Cidade nao localizada</span></div>
                <strong className="kpi-value">{formatNumber(adjustedSummary.unresolved)}</strong>
              </div>
            </section>

            {clientId ? (
              <section className="panel upload-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Historico de {clientName}</h2>
                    <p>Cada estudo gerado ou recalculado fica registrado aqui. Clique numa linha para ver aquele resultado.</p>
                  </div>
                  <div className="table-actions">
                    {saveError ? <span className="upload-error">{saveError}</span> : null}
                    {isSavingStudy ? <span className="muted-small">Salvando...</span> : null}
                    <button className="text-button" onClick={resetToUpload} type="button">Atualizar planilha do cliente</button>
                    <button className="primary-button" onClick={recalculateFromSaved} disabled={!savedInputRows || isSavingStudy} type="button">
                      Recalcular agora
                    </button>
                  </div>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Escopo</th>
                        <th>Cobertura</th>
                        <th>Cidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studyHistory.map((entry) => (
                        <tr
                          key={entry.id}
                          onClick={() => viewHistoryEntry(entry)}
                          style={{ cursor: 'pointer', fontWeight: entry.id === viewingStudyId ? 700 : 400 }}
                        >
                          <td>{formatHistoryDate(entry.created_at)}{entry.id === viewingStudyId ? ' · visualizando' : ''}</td>
                          <td>{entry.settings?.label || '-'}</td>
                          <td>{Number(entry.summary?.coveragePercent || 0).toFixed(1).replace('.', ',')}%</td>
                          <td>{formatNumber(entry.summary?.total || 0)}</td>
                        </tr>
                      ))}
                      {!studyHistory.length ? (
                        <tr><td colSpan={4} className="muted">Nenhum estudo salvo ainda.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="panel table-panel">
              <div className="panel-heading table-heading">
                <div>
                  <div className="title-row">
                    <h2>3. Resultado do estudo</h2>
                    <span className="scope-pill">{studyTableLabel}</span>
                    {radiusKm ? <span className="scope-pill">Raio: ate {radiusKm} km</span> : null}
                  </div>
                  <p>Mostrando {formatNumber(filteredResults.length)} de {formatNumber(adjustedResults.length)} cidades.</p>
                </div>
                <div className="table-actions">
                  <input
                    type="search"
                    placeholder="Buscar cidade, cliente ou consultor..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button className="text-button" onClick={() => setStage('mapping')} type="button">Ajustar mapeamento</button>
                  <button className="primary-button" onClick={() => downloadStudyWorkbook(adjustedResults)} type="button">
                    Exportar .xlsx
                  </button>
                </div>
              </div>

              <div className="filter-control study-radius-filter">
                <span>Raio de cobertura (distancia ate a oficina mais proxima)</span>
                <div className="segmented-control" role="group" aria-label="Raio de cobertura">
                  {radiusOptions.map((option) => (
                    <button
                      key={option.value}
                      className={radiusKm === option.value ? 'is-active' : ''}
                      onClick={() => setRadiusKm(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="segmented-control study-status-filter" role="group" aria-label="Filtro de cobertura">
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
                      <th>Cidade</th>
                      <th>Cliente</th>
                      <th>Consultor</th>
                      <th>Qtd. Veiculos</th>
                      <th>Frota</th>
                      <th>Cobertura</th>
                      <th>Qtd. Oficinas</th>
                      <th>Tipos de cobertura</th>
                      <th>Tipos de oficina</th>
                      <th>Cidade mais proxima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((row, index) => (
                      <tr key={`${row.city}-${row.state}-${index}`}>
                        <td>
                          <strong>{row.city}</strong><br />
                          <span className="muted-small">
                            {row.stateCode || row.state || 'UF nao informada'}
                            {row.stateInferred ? ' (UF inferida)' : ''}
                          </span>
                        </td>
                        <td>{row.client || '-'}</td>
                        <td>{row.consultant || '-'}</td>
                        <td>{row.vehicleCount || '-'}</td>
                        <td>{row.fleetType || '-'}</td>
                        <td>
                          <StatusChip status={row.status} />
                          {row.coveredByRadius ? (
                            <>
                              <br />
                              <span className="muted-small">via raio de ate {radiusKm} km</span>
                            </>
                          ) : null}
                        </td>
                        <td>{row.hasWorkshop ? formatNumber(row.workshopCount) : '-'}</td>
                        <td><ServiceTypeBadges serviceCounts={row.serviceCounts} /></td>
                        <td><BrandBadges brandCounts={row.brandCounts} /></td>
                        <td>{row.nearestCityLabel || (row.status === 'covered' ? '-' : 'Sem referencia proxima')}</td>
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
