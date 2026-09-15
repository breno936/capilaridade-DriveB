'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  activeStatusOptions,
  buildMissingCitySummary,
  boolOptions,
  cityResolutionOptions,
  buildStrategicSummary,
  countBy,
  defaultFilters,
  downloadCsv,
  enrichWorkshops,
  filterWorkshops,
  formatNumber,
  formatStateLabel,
  googleMapsUrl,
  layerOptions,
  locationOptions,
  mapThemeOptions,
  percent,
  solutionLabel,
  solutionOptions,
  strategicViewOptions,
  uniqueValues,
} from '../lib/workshop-utils';

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <div className="map-loading">Carregando mapa...</div>,
});

const PAGE_SIZE = 10;
const PRIORITY_PAGE_SIZE = 10;
const MISSING_CITY_PAGE_SIZE = 10;
const chartColors = ['#6c5dd3', '#2f6fed', '#f97316', '#667085', '#12b76a', '#e5484d'];

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter-control filter-card">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SegmentedControl({ value, onChange, options, ariaLabel }) {
  return (
    <div className="segmented-control" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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

function KpiCard({ label, value, meta, tone = 'cyan', icon, badge }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <span className="kpi-accent" aria-hidden="true" />
      <div className="kpi-topline">
        <span>{label}</span>
        <span className="metric-icon" aria-hidden="true">{icon}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-meta">
        {badge ? <span className={`state-badge ${tone}`}>{badge}</span> : null}
        <span>{meta}</span>
      </div>
    </article>
  );
}

function WorkshopBadges({ item }) {
  return (
    <div className="badges">
      <span className="badge info">{item.serviceTypeLabel || item.coverageLabel}</span>
      <span className="badge">{item.concept || 'Sem conceito'}</span>
      <span className="badge">Rede {item.networkId || '-'}</span>
      <span className={`badge ${item.isActive ? 'success' : 'danger'}`}>{item.isActive ? 'Ativa' : 'Inativa'}</span>
      {item.isBlocked ? <span className="badge danger">Bloqueada</span> : null}
      {item.isOffline ? <span className="badge warning">Offline</span> : null}
      {!item.isInBrazil ? <span className="badge danger">Fora do Brasil</span> : null}
    </div>
  );
}

function PriorityTarget({ report, index }) {
  const statusLabel = report.status === 'critical' ? 'Critico' : report.status === 'attention' ? 'Atencao' : 'Monitorar';
  const subtitle = [report.locationHint, report.consultantLabel ? `Consultor: ${report.consultantLabel}` : ''].filter(Boolean).join(' · ');

  return (
    <div className={`priority-target ${report.status}`}>
      <span className="target-rank">{index + 1}</span>
      <div>
        <strong>{report.groupName}</strong>
        {subtitle ? <span className="muted-small">{subtitle}</span> : null}
        <p>{report.minimumDeficitText ? `Gap minimo de oficina/vidros/pneus: ${report.minimumDeficitText}` : `Gap ideal: ${report.idealDeficitText || 'atendido'}`}</p>
      </div>
      <span className={`status-chip ${report.status}`}>{statusLabel}</span>
    </div>
  );
}

function CityGapItem({ item, index }) {
  return (
    <div className="priority-target attention">
      <span className="target-rank">{index + 1}</span>
      <div>
        <strong>{item.displayName}</strong>
        <p>{item.stateCode ? `Sem cidade resolvida em ${formatStateLabel(item.stateCode)}` : 'Sem cidade/UF resolvida'}</p>
      </div>
      <span className="status-chip attention">Pendente</span>
    </div>
  );
}

function Breakdown({ data, formatter }) {
  const entries = Object.entries(data).sort((left, right) => right[1] - left[1]).slice(0, 6);
  const peak = entries.length ? entries[0][1] : 0;

  if (!entries.length) return <p className="muted">Sem dados para o recorte atual.</p>;

  return (
    <div className="breakdown-list">
      {entries.map(([label, value], index) => {
        const width = peak ? Math.max((value / peak) * 100, 7) : 0;
        return (
          <div className="breakdown-row" key={label}>
            <div className="breakdown-label">
              <span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }} />
              <strong>{formatter(label)}</strong>
            </div>
            <div className="breakdown-track">
              <div
                className="breakdown-fill"
                style={{ width: `${width.toFixed(1)}%`, background: chartColors[index % chartColors.length] }}
              />
            </div>
            <span>{formatNumber(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function GapPercentChart({ reports }) {
  const entries = reports.filter((report) => report.minimumGap > 0 || report.idealGap > 0).slice(0, 8);

  if (!entries.length) return <p className="muted">Sem gaps percentuais no recorte atual.</p>;

  return (
    <div className="gap-chart">
      {entries.map((report) => (
        <div className="gap-row" key={report.groupKey}>
          <div className="gap-row-head">
            <strong>{report.groupName}</strong>
            <span>{report.consultantLabel ? `Consultor: ${report.consultantLabel} · ` : ''}{percent(report.idealGap, 6)} de GAP ideal</span>
          </div>
          <div className="gap-track">
            <div className={`gap-fill ${report.status}`} style={{ width: `${report.idealGapPercent.toFixed(1)}%` }} />
          </div>
          <p>Falta para o minimo (1 de cada pilar): {report.minimumDeficitText || 'atendido'}</p>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, formatter }) {
  const entries = Object.entries(data).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let cursor = 0;
  const gradient = entries.length
    ? entries.map(([, value], index) => {
      const start = cursor;
      const end = cursor + (value / total) * 360;
      cursor = end;
      return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
    }).join(', ')
    : '#e4e7ec 0deg 360deg';

  return (
    <div className="donut-layout">
      <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }}>
        <div>
          <strong>{formatNumber(total)}</strong>
          <span>registros</span>
        </div>
      </div>
      <div className="donut-legend">
        {entries.map(([label, value], index) => (
          <div key={label}>
            <span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }} />
            <span>{formatter(label)}</span>
            <strong>{percent(value, total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ current, reference }) {
  const labels = ['Volume', 'Operacao', 'Cobertura', 'Qualidade', 'Diversidade'];
  const size = 260;
  const center = size / 2;
  const maxRadius = 92;

  function pointAt(index, value) {
    const angle = (-90 + (360 / labels.length) * index) * (Math.PI / 180);
    const radius = (Math.max(0, Math.min(100, value)) / 100) * maxRadius;
    return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
  }

  function polygon(values) {
    return values.map((value, index) => pointAt(index, value).join(',')).join(' ');
  }

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar de performance regional">
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <polygon
            key={step}
            points={labels.map((_, index) => pointAt(index, step * 100).join(',')).join(' ')}
            className="radar-ring"
          />
        ))}
        {labels.map((label, index) => {
          const [axisX, axisY] = pointAt(index, 100);
          const [labelX, labelY] = pointAt(index, 116);
          return (
            <g key={label}>
              <line x1={center} y1={center} x2={axisX} y2={axisY} className="radar-axis" />
              <text x={labelX} y={labelY} textAnchor="middle">{label}</text>
            </g>
          );
        })}
        <polygon points={polygon(reference)} className="radar-area reference" />
        <polygon points={polygon(current)} className="radar-area current" />
        {current.map((value, index) => {
          const [x, y] = pointAt(index, value);
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.5" className="radar-point" />;
        })}
      </svg>
      <div className="radar-legend">
        <span><i className="legend-line cyan" />Recorte atual</span>
        <span><i className="legend-line amber" />Meta de referencia</span>
      </div>
    </div>
  );
}

function MiniPagination({ currentPage, totalPages, onPrevious, onNext }) {
  return (
    <div className="mini-pagination">
      <span>Pagina {currentPage} de {totalPages}</span>
      <div>
        <button className="icon-button" disabled={currentPage === 1} onClick={onPrevious} type="button">‹</button>
        <button className="icon-button" disabled={currentPage === totalPages} onClick={onNext} type="button">›</button>
      </div>
    </div>
  );
}

export default function DashboardClient({ initialCityCache = [], initialWorkshopCategories = [] }) {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [priorityPage, setPriorityPage] = useState(1);
  const [missingCityPage, setMissingCityPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [fitRequestToken, setFitRequestToken] = useState(0);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  useEffect(() => {
    if (!isMapFullscreen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsMapFullscreen(false);
    }

    document.body.classList.add('map-fullscreen-active');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('map-fullscreen-active');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapFullscreen]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch('/data/workshops.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar dataset (${response.status})`);
        const payload = await response.json();
        if (!cancelled) {
          setWorkshops(enrichWorkshops(payload, initialCityCache, initialWorkshopCategories));
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Nao foi possivel carregar o dataset.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [initialCityCache, initialWorkshopCategories]);

  const filteredWorkshops = useMemo(() => filterWorkshops(workshops, filters), [filters, workshops]);

  useEffect(() => {
    if (selectedId && !filteredWorkshops.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [filteredWorkshops, selectedId]);

  const conceptOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'concept').map((value) => ({ value, label: value }))],
    [workshops],
  );
  const checkoutOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'checkoutType').map((value) => ({ value, label: value }))],
    [workshops],
  );
  const consultantOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'consultantLabel').map((value) => ({ value, label: value }))],
    [workshops],
  );
  const responsibleOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'responsibleLabel').map((value) => ({ value, label: value }))],
    [workshops],
  );
  const networkOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'networkId').map((value) => ({ value, label: `Rede ${value}` }))],
    [workshops],
  );
  const brandOptions = useMemo(() => {
    const labels = new Map();
    workshops.forEach((item) => { if (item.brandSlug) labels.set(item.brandSlug, item.brandLabel); });
    return [
      { value: 'all', label: 'Todas' },
      ...[...labels.entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR')).map(([value, label]) => ({ value, label })),
    ];
  }, [workshops]);
  const categoryOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'categoryId').map((value) => ({ value, label: `Categoria ${value}` }))],
    [workshops],
  );
  const stateOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'stateCode').map((value) => ({ value, label: formatStateLabel(value) }))],
    [workshops],
  );
  const cityOptions = useMemo(() => {
    const scoped = filters.state === 'all' ? workshops : workshops.filter((item) => item.stateCode === filters.state);
    const uniqueCities = [...new Map(
      scoped
        .filter((item) => item.cityKey && item.cityDisplayName)
        .map((item) => [item.cityKey, item.cityDisplayName]),
    ).entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'));

    return [{ value: 'all', label: 'Todas' }, ...uniqueCities.map(([value, label]) => ({ value, label }))];
  }, [filters.state, workshops]);
  const regionServiceOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'regionServiceId').map((value) => ({ value, label: `Servico ${value}` }))],
    [workshops],
  );
  const regionPartOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'regionPartId').map((value) => ({ value, label: `Pecas ${value}` }))],
    [workshops],
  );

  const totalPages = Math.max(1, Math.ceil(filteredWorkshops.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredWorkshops.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = filteredWorkshops.filter((item) => item.isActive).length;
  const operationalCount = filteredWorkshops.filter((item) => item.isOperational).length;
  const blockedCount = filteredWorkshops.filter((item) => item.isBlocked).length;
  const outsideCount = filteredWorkshops.filter((item) => !item.isInBrazil).length;
  const insideCount = filteredWorkshops.filter((item) => item.isInBrazil).length;
  const cityResolvedCount = filteredWorkshops.filter((item) => item.hasResolvedCity).length;
  const unresolvedCityCount = filteredWorkshops.filter((item) => !item.hasResolvedCity).length;
  const networkCount = new Set(filteredWorkshops.map((item) => item.networkId).filter(Boolean)).size;
  const franchiseDistribution = countBy(filteredWorkshops.filter((item) => item.franchiseId), 'franchiseId');
  const cityPrecisionRate = filteredWorkshops.length ? (cityResolvedCount / filteredWorkshops.length) * 100 : 0;
  const strategicDimension = filters.strategicView;
  const strategicSummary = useMemo(() => buildStrategicSummary(filteredWorkshops, strategicDimension), [filteredWorkshops, strategicDimension]);
  const missingCitySummary = useMemo(() => buildMissingCitySummary(filteredWorkshops), [filteredWorkshops]);
  const currentScopeLabel = filters.state !== 'all' ? formatStateLabel(filters.state) : 'Brasil';
  const strategicScopeLabel = strategicDimension === 'city'
    ? 'Cidades'
    : strategicDimension === 'state'
      ? 'Estados'
      : strategicDimension === 'region_service'
        ? 'Regioes de servico'
        : 'Regioes de pecas';
  const oficinaGapTotal = strategicSummary.reports.reduce((sum, report) => sum + report.minimumDeficit.oficina, 0);
  const vidrosGapTotal = strategicSummary.reports.reduce((sum, report) => sum + report.minimumDeficit.vidros, 0);
  const pneusGapTotal = strategicSummary.reports.reduce((sum, report) => sum + report.minimumDeficit.pneus, 0);
  const conceptDistribution = countBy(filteredWorkshops, 'concept');
  const coverageDistribution = countBy(filteredWorkshops, 'coverageLabel');
  const stateDistribution = countBy(filteredWorkshops.filter((item) => item.stateCode), 'stateCode');
  const cityDistribution = countBy(filteredWorkshops.filter((item) => item.cityDisplayName), 'cityDisplayName');
  const totalOutside = workshops.filter((item) => !item.isInBrazil).length;

  const radarCurrent = [
    Math.min(100, filteredWorkshops.length ? (filteredWorkshops.length / Math.max(workshops.length, 1)) * 140 : 0),
    filteredWorkshops.length ? (operationalCount / filteredWorkshops.length) * 100 : 0,
    strategicSummary.reports.length ? ((strategicSummary.reports.length - strategicSummary.criticalStates.length) / strategicSummary.reports.length) * 100 : 0,
    filteredWorkshops.length ? (insideCount / filteredWorkshops.length) * 100 : 0,
    Math.min(100, networkCount * 12),
  ];
  const radarReference = [78, 88, 82, 94, 70];

  const priorityTotalPages = Math.max(1, Math.ceil(strategicSummary.topPriorityStates.length / PRIORITY_PAGE_SIZE));
  const currentPriorityPage = Math.min(priorityPage, priorityTotalPages);
  const priorityItems = strategicSummary.topPriorityStates.slice((currentPriorityPage - 1) * PRIORITY_PAGE_SIZE, currentPriorityPage * PRIORITY_PAGE_SIZE);

  const missingCityTotalPages = Math.max(1, Math.ceil(missingCitySummary.items.length / MISSING_CITY_PAGE_SIZE));
  const currentMissingCityPage = Math.min(missingCityPage, missingCityTotalPages);
  const missingCityItems = missingCitySummary.items.slice((currentMissingCityPage - 1) * MISSING_CITY_PAGE_SIZE, currentMissingCityPage * MISSING_CITY_PAGE_SIZE);

  function updateFilter(key, value) {
    setFilters((previous) => {
      if (key === 'state') return { ...previous, state: value, city: 'all' };
      if (key === 'franchiseId' && value === '1') return { ...previous, franchiseId: value, locationScope: 'in_brazil' };
      return { ...previous, [key]: value };
    });
    setPage(1);
    setPriorityPage(1);
    setMissingCityPage(1);
    setFitRequestToken((previous) => previous + 1);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
    setPriorityPage(1);
    setMissingCityPage(1);
    setSelectedId(null);
    setFitRequestToken((previous) => previous + 1);
  }

  if (loading) {
    return <StatusCard title="Carregando dashboard" description="Lendo o dataset exportado e preparando a visao operacional." />;
  }

  if (error) {
    return <StatusCard title="Falha ao carregar os dados" description={error} />;
  }

  return (
    <div className="command-shell">
      <span className="ambient-glow glow-cyan" aria-hidden="true" />
      <span className="ambient-glow glow-amber" aria-hidden="true" />
      <aside className="command-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>DriveB Ops</strong>
            <span>Command Center</span>
          </div>
        </div>

        <div className="solution-panel">
          <span className="solution-eyebrow">Solucao</span>
          <SegmentedControl
            value={filters.franchiseId}
            onChange={(value) => updateFilter('franchiseId', value)}
            options={solutionOptions}
            ariaLabel="Solucao"
          />
        </div>

        <div className="filter-panel">
          <div className="panel-heading compact">
            <span>Filtros estrategicos</span>
            <button className="text-button" onClick={resetFilters} type="button">Limpar</button>
          </div>

          <label className="search-control">
            <span>Busca</span>
            <input
              type="search"
              placeholder="Oficina, SAP, CNPJ, UF"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>

          <div className="filter-stack">
            <FilterSelect label="Consultor" value={filters.consultant} onChange={(value) => updateFilter('consultant', value)} options={consultantOptions} />
            <FilterSelect label="Estado (UF)" value={filters.state} onChange={(value) => updateFilter('state', value)} options={stateOptions} />
            <FilterSelect label="Cidade" value={filters.city} onChange={(value) => updateFilter('city', value)} options={cityOptions} />
            <FilterSelect label="Status cidade" value={filters.cityResolution} onChange={(value) => updateFilter('cityResolution', value)} options={cityResolutionOptions} />
            <FilterSelect label="Responsavel (base)" value={filters.responsible} onChange={(value) => updateFilter('responsible', value)} options={responsibleOptions} />
            <FilterSelect label="Conceito" value={filters.concept} onChange={(value) => updateFilter('concept', value)} options={conceptOptions} />
            <FilterSelect label="Rede" value={filters.networkId} onChange={(value) => updateFilter('networkId', value)} options={networkOptions} />
            <FilterSelect label="Marca" value={filters.brand} onChange={(value) => updateFilter('brand', value)} options={brandOptions} />
            <FilterSelect label="Categoria" value={filters.categoryId} onChange={(value) => updateFilter('categoryId', value)} options={categoryOptions} />
            <FilterSelect label="Checkout" value={filters.checkoutType} onChange={(value) => updateFilter('checkoutType', value)} options={checkoutOptions} />
            <FilterSelect label="Regiao servico" value={filters.regionServiceId} onChange={(value) => updateFilter('regionServiceId', value)} options={regionServiceOptions} />
            <FilterSelect label="Regiao pecas" value={filters.regionPartId} onChange={(value) => updateFilter('regionPartId', value)} options={regionPartOptions} />
          </div>

          <div className="filter-grid-tight">
            <FilterSelect label="Status" value={filters.isActive} onChange={(value) => updateFilter('isActive', value)} options={activeStatusOptions} />
            <FilterSelect label="Bloqueada" value={filters.isBlocked} onChange={(value) => updateFilter('isBlocked', value)} options={boolOptions} />
            <FilterSelect label="Offline" value={filters.isOffline} onChange={(value) => updateFilter('isOffline', value)} options={boolOptions} />
            <FilterSelect label="Fee" value={filters.isFee} onChange={(value) => updateFilter('isFee', value)} options={boolOptions} />
            <FilterSelect label="Margem" value={filters.isMargin} onChange={(value) => updateFilter('isMargin', value)} options={boolOptions} />
          </div>
        </div>

        <div className="sidebar-actions">
          <FilterSelect label="Visao estrategica" value={filters.strategicView} onChange={(value) => updateFilter('strategicView', value)} options={strategicViewOptions} />
          <FilterSelect label="Mapa base" value={filters.mapTheme} onChange={(value) => updateFilter('mapTheme', value)} options={mapThemeOptions} />
          <FilterSelect label="Recorte geografico" value={filters.locationScope} onChange={(value) => updateFilter('locationScope', value)} options={locationOptions} />
          <button className="primary-button" onClick={() => setFitRequestToken((previous) => previous + 1)} type="button">Reenquadrar mapa</button>
        </div>
      </aside>

      <main className="command-main">
        <header className="topbar">
          <div>
            <div className="title-row">
              <h1>Capilaridade das Oficinas</h1>
              <span className="scope-pill">{currentScopeLabel}</span>
            </div>
            <p>Analise de distribuicao, cobertura operacional e oportunidades de expansao da rede credenciada.</p>
          </div>
          <div className="topbar-status">
            <div>
              <span>Ultima atualizacao</span>
              <strong>Hoje, base filtrada</strong>
            </div>
            <Link className="app-switch-link" href="/estudo-capilaridade">
              <span aria-hidden="true">▤</span> Estudo de Capilaridade
            </Link>
            <Link className="app-switch-link" href="/visao-comercial">
              <span aria-hidden="true">◆</span> Visao Comercial
            </Link>
            <Link className="app-switch-link" href="/radar-precos">
              <span aria-hidden="true">◎</span> Radar de Precos
            </Link>
            <a className="app-switch-link" href="https://demandpipe-crm.vercel.app/" target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">⇄</span> CRM DemandPipe
            </a>
            <button className="icon-button" onClick={() => setFitRequestToken((previous) => previous + 1)} title="Atualizar enquadramento" type="button">↻</button>
            <div className="operator-card">
              <span className="operator-avatar">DB</span>
              <div>
                <strong>DriveB</strong>
                <span>{filters.franchiseId === 'all' ? 'DriveB e Outros' : solutionLabel(filters.franchiseId)}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="kpi-grid">
          <KpiCard
            label="Total no recorte"
            value={formatNumber(filteredWorkshops.length)}
            meta={`${formatNumber(workshops.length)} registros na base`}
            badge="Base atual"
            icon="◦"
          />
          <KpiCard
            label="Gap de oficinas"
            value={formatNumber(oficinaGapTotal)}
            meta={`+ ${formatNumber(vidrosGapTotal)} vidros e ${formatNumber(pneusGapTotal)} pneus no minimo`}
            tone="amber"
            badge={oficinaGapTotal ? 'Alvo' : 'Atendido'}
            icon="●"
          />
          <KpiCard
            label={`${strategicScopeLabel} criticas`}
            value={formatNumber(strategicSummary.criticalStates.length)}
            meta={`${formatNumber(blockedCount)} bloqueadas no recorte`}
            tone="rose"
            badge={strategicSummary.criticalStates.length ? 'Atencao' : 'OK'}
            icon="!"
          />
          <KpiCard
            label="Taxa operacional"
            value={percent(operationalCount, filteredWorkshops.length)}
            meta={`${formatNumber(activeCount)} ativas`}
            tone="green"
            badge={operationalCount ? 'Monitorada' : 'Sem dados'}
            icon="◷"
          />
        </section>

        <section className={`data-alert ${totalOutside ? '' : 'hidden'}`}>
          <strong>{formatNumber(totalOutside)}</strong> registros da base estao fora do bounding box do Brasil; no recorte atual sao <strong>{formatNumber(outsideCount)}</strong>.
        </section>

        <section className="dashboard-grid">
          <article className={`panel map-panel ${isMapFullscreen ? 'is-fullscreen' : ''}`}>
            <div className="panel-heading">
              <div>
                <h2>Heatmap de Capilaridade</h2>
                <p>
                  Mapa, pontos clicaveis e reenquadramento conforme filtros ativos.
                  {cityResolvedCount ? ` ${percent(cityResolvedCount, filteredWorkshops.length)} do recorte ja esta agregado por cidade.` : ' Sem cidade resolvida no recorte atual.'}
                  {unresolvedCityCount ? ` ${formatNumber(unresolvedCityCount)} registros ainda estao sem cidade.` : ''}
                </p>
              </div>
              <div className="map-panel-controls">
                <SegmentedControl value={filters.layerMode} onChange={(value) => updateFilter('layerMode', value)} options={layerOptions} ariaLabel="Camada do mapa" />
                <button
                  className="icon-button"
                  onClick={() => setIsMapFullscreen((previous) => !previous)}
                  title={isMapFullscreen ? 'Sair da tela cheia' : 'Ver mapa em tela cheia'}
                  type="button"
                >
                  {isMapFullscreen ? '⤡' : '⤢'}
                </button>
              </div>
            </div>
            <MapView
              workshops={filteredWorkshops}
              selectedId={selectedId}
              onSelect={setSelectedId}
              layerMode={filters.layerMode}
              mapTheme={filters.mapTheme}
              fitRequestToken={fitRequestToken}
              isFullscreen={isMapFullscreen}
            />
          </article>

          <aside className="panel priority-panel">
            <div className="panel-heading">
              <div>
                <h2>Alvos Prioritarios</h2>
                <p>{strategicScopeLabel} com maior deficit de cobertura no recorte atual. Exibindo {formatNumber(priorityItems.length)} de {formatNumber(strategicSummary.topPriorityStates.length)}.</p>
              </div>
            </div>
            <div className="priority-list">
              {priorityItems.length ? (
                priorityItems.map((report, index) => (
                  <PriorityTarget key={report.groupKey} report={report} index={(currentPriorityPage - 1) * PRIORITY_PAGE_SIZE + index} />
                ))
              ) : (
                <p className="muted">Nenhuma localidade com gap no recorte atual.</p>
              )}
            </div>
            <MiniPagination
              currentPage={currentPriorityPage}
              totalPages={priorityTotalPages}
              onPrevious={() => setPriorityPage((previous) => Math.max(1, previous - 1))}
              onNext={() => setPriorityPage((previous) => Math.min(priorityTotalPages, previous + 1))}
            />
          </aside>
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Precisao de geocodificacao</h2>
                <p>Toda oficina tem latitude/longitude. Esse indicador mostra quantas ja tiveram a cidade/UF identificada automaticamente a partir dessa coordenada.</p>
              </div>
            </div>
            <div className="breakdown-list">
              <div className="breakdown-row">
                <div className="breakdown-label">
                  <span className="legend-dot" style={{ background: chartColors[0] }} />
                  <strong>Cidade identificada pela coordenada</strong>
                </div>
                <div className="breakdown-track">
                  <div className="breakdown-fill" style={{ width: `${cityPrecisionRate.toFixed(1)}%`, background: chartColors[0] }} />
                </div>
                <span>{formatNumber(cityResolvedCount)}</span>
              </div>
              <div className="breakdown-row">
                <div className="breakdown-label">
                  <span className="legend-dot" style={{ background: chartColors[3] }} />
                  <strong>Ainda sem cidade identificada</strong>
                </div>
                <div className="breakdown-track">
                  <div className="breakdown-fill" style={{ width: `${Math.max(0, 100 - cityPrecisionRate).toFixed(1)}%`, background: chartColors[3] }} />
                </div>
                <span>{formatNumber(unresolvedCityCount)}</span>
              </div>
            </div>
          </article>

          <article className="panel priority-panel">
            <div className="panel-heading">
              <div>
                <h2>Estados com cidade pendente</h2>
                <p>Oficinas que tem coordenadas validas, mas cuja cidade/UF ainda nao foi determinada a partir delas. Agrupado pelo estado ja identificado (via coordenada ou DDD).</p>
              </div>
            </div>
            <div className="priority-list">
              {Object.keys(missingCitySummary.byState).length ? (
                Object.entries(missingCitySummary.byState)
                  .sort((left, right) => right[1] - left[1])
                  .slice(0, 6)
                  .map(([label, value], index) => (
                    <div className="priority-target attention" key={label}>
                      <span className="target-rank">{index + 1}</span>
                      <div>
                        <strong>{label}</strong>
                        <p>{formatNumber(value)} oficinas com coordenada mas sem cidade identificada</p>
                      </div>
                      <span className="status-chip attention">Pendencia</span>
                    </div>
                  ))
              ) : (
                <p className="muted">Nenhuma pendencia de cidade no recorte atual.</p>
              )}
            </div>
          </article>
        </section>

        <section className="analytics-grid">
          <article className="panel">
            <div className="panel-heading">
              <h2>Distribuicao por Cobertura</h2>
            </div>
            <DonutChart data={coverageDistribution} formatter={(label) => label} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Porcentagem de Gap</h2>
                <p>
                  Gap = quanto falta para a localidade ter, em operacoes ativas e nao bloqueadas, o minimo de 1 oficina + 1 vidros + 1 pneus (ou o ideal de 2 de cada).
                  Cada barra e uma localidade critica ou em atencao, com o consultor responsavel pela zona.
                  {filters.consultant !== 'all' ? ` Filtrado para ${filters.consultant}.` : ' Use o filtro "Consultor" para ver so a zona de um consultor.'}
                </p>
              </div>
            </div>
            <GapPercentChart reports={strategicSummary.topPriorityStates} />
          </article>
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel">
            <div className="panel-heading">
              <h2>Radar de Performance Regional</h2>
            </div>
            <RadarChart current={radarCurrent} reference={radarReference} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>Distribuicao por Solucao</h2>
            </div>
            <Breakdown data={franchiseDistribution} formatter={(label) => solutionLabel(label)} />
          </article>
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel">
            <div className="panel-heading">
              <h2>Distribuicao por Conceito</h2>
            </div>
            <Breakdown data={conceptDistribution} formatter={(label) => label} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>{strategicDimension === 'city' ? 'Distribuicao por Cidade' : strategicDimension === 'state' ? 'Distribuicao por Estado' : strategicDimension === 'region_service' ? 'Distribuicao por Regiao de servico' : 'Distribuicao por Regiao de pecas'}</h2>
            </div>
            <Breakdown
              data={strategicDimension === 'city' ? cityDistribution : strategicDimension === 'state' ? stateDistribution : strategicDimension === 'region_service' ? countBy(filteredWorkshops.filter((item) => item.regionServiceLabel), 'regionServiceLabel') : countBy(filteredWorkshops.filter((item) => item.regionPartLabel), 'regionPartLabel')}
              formatter={(label) => (strategicDimension === 'state' ? formatStateLabel(label) : label)}
            />
          </article>
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel priority-panel">
            <div className="panel-heading">
              <h2>Pendencias de cidade</h2>
            </div>
            <div className="priority-list">
              {missingCityItems.length ? (
                missingCityItems.map((item, index) => (
                  <CityGapItem key={`${item.id}-${index}`} item={item} index={(currentMissingCityPage - 1) * MISSING_CITY_PAGE_SIZE + index} />
                ))
              ) : (
                <p className="muted">Nenhuma oficina sem cidade resolvida no recorte atual.</p>
              )}
            </div>
            <MiniPagination
              currentPage={currentMissingCityPage}
              totalPages={missingCityTotalPages}
              onPrevious={() => setMissingCityPage((previous) => Math.max(1, previous - 1))}
              onNext={() => setMissingCityPage((previous) => Math.min(missingCityTotalPages, previous + 1))}
            />
          </article>
        </section>

        <section className="panel table-panel">
          <div className="panel-heading table-heading">
            <div>
              <h2>Oficinas Filtradas</h2>
              <p>Mostrando {formatNumber(pageItems.length)} de {formatNumber(filteredWorkshops.length)} registros no recorte atual.</p>
            </div>
            <div className="table-actions">
              <input
                type="search"
                placeholder="Buscar oficina..."
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
              <button className="icon-button" onClick={() => downloadCsv(filteredWorkshops)} title="Exportar CSV" type="button">⇩</button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome da oficina</th>
                  <th>Estado</th>
                  <th>Cobertura</th>
                  <th>Rede</th>
                  <th>Status</th>
                  <th>Contato</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`${selectedId === item.id ? 'is-selected' : ''} ${!item.isOperational ? 'is-alert' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td>
                      <div className="workshop-title">
                        <span className="row-icon" aria-hidden="true">⌁</span>
                        <div>
                          <strong>{item.displayName}</strong>
                          <span>SAP {item.sapId || '-'} · {item.corporateName || 'Sem razao social'}</span>
                          <span className="muted-small">{item.consultantLabel || 'Sem consultor mapeado'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.cityDisplayName || `Cidade pendente - ${formatStateLabel(item.stateCode)}`}</td>
                    <td><WorkshopBadges item={item} /></td>
                    <td>Rede {item.networkId || '-'}<br /><span className="muted-small">Franchise {item.franchiseId || '-'} | Categoria {item.categoria || item.categoryId || '-'}</span></td>
                    <td>
                      <span className={`status-chip ${item.isOperational ? 'ideal' : item.isBlocked ? 'critical' : 'attention'}`}>
                        {item.isOperational ? 'Operacional' : item.isBlocked ? 'Bloqueada' : 'Monitorar'}
                      </span>
                    </td>
                    <td>{item.phone || item.ownerMobilePhone || 'N/D'}<br /><span className="muted-small">{item.email || item.ownerEmail || 'Sem e-mail'}</span></td>
                    <td>
                      <a className="action-link" href={googleMapsUrl(item)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                        Mapa
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span>Mostrando pagina {currentPage} de {totalPages}</span>
            <div>
              <button className="icon-button" disabled={currentPage === 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))} type="button">‹</button>
              <button className="page-button is-active" type="button">{currentPage}</button>
              <button className="icon-button" disabled={currentPage === totalPages} onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))} type="button">›</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
