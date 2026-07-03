'use client';

import dynamic from 'next/dynamic';
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
  franchiseOptions,
  formatNumber,
  formatStateLabel,
  googleMapsUrl,
  layerOptions,
  locationOptions,
  mapThemeOptions,
  percent,
  strategicViewOptions,
  uniqueValues,
} from '../lib/workshop-utils';

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <div className="map-loading">Carregando mapa...</div>,
});

const PAGE_SIZE = 10;
const chartColors = ['#20c7df', '#3b82f6', '#f6b21a', '#7c8aa5', '#16a34a', '#ef4444'];

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

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="segmented-control" role="group" aria-label="Camada do mapa">
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
      <span className="badge info">{item.coverageLabel}</span>
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

  return (
    <div className={`priority-target ${report.status}`}>
      <span className="target-rank">{index + 1}</span>
      <div>
        <strong>{report.groupName}</strong>
        {report.locationHint ? <span className="muted-small">{report.locationHint}</span> : null}
        <p>{report.minimumDeficitText ? `Gap minimo: ${report.minimumDeficitText}` : `Gap ideal: ${report.idealDeficitText || 'atendido'}`}</p>
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
    : '#1c2437 0deg 360deg';

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
  const labels = ['Volume', 'Operação', 'Cobertura', 'Qualidade', 'Diversidade'];
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
        <span><i className="legend-line amber" />Meta de referência</span>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [fitRequestToken, setFitRequestToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch('/data/workshops.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar dataset (${response.status})`);
        const payload = await response.json();
        if (!cancelled) {
          setWorkshops(enrichWorkshops(payload));
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Não foi possível carregar o dataset.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const responsibleOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'responsibleLabel').map((value) => ({ value, label: value }))],
    [workshops],
  );
  const availableFranchiseOptions = franchiseOptions;
  const networkOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'networkId').map((value) => ({ value, label: `Rede ${value}` }))],
    [workshops],
  );
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
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'regionServiceId').map((value) => ({ value, label: `Serviço ${value}` }))],
    [workshops],
  );
  const regionPartOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'regionPartId').map((value) => ({ value, label: `Peças ${value}` }))],
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
        ? 'Regiões de serviço'
        : 'Regiões de peças';
  const minimumGapTotal = strategicSummary.reports.reduce((sum, report) => sum + report.minimumGap, 0);
  const idealGapTotal = strategicSummary.reports.reduce((sum, report) => sum + report.idealGap, 0);
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

  function updateFilter(key, value) {
    setFilters((previous) => (key === 'state' ? { ...previous, state: value, city: 'all' } : { ...previous, [key]: value }));
    setPage(1);
    setFitRequestToken((previous) => previous + 1);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
    setSelectedId(null);
    setFitRequestToken((previous) => previous + 1);
  }

  if (loading) {
    return <StatusCard title="Carregando dashboard" description="Lendo o dataset exportado e preparando a visão operacional." />;
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

        <div className="filter-panel">
          <div className="panel-heading compact">
            <span>Filtros estratégicos</span>
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
            <FilterSelect label="Estado (UF)" value={filters.state} onChange={(value) => updateFilter('state', value)} options={stateOptions} />
            <FilterSelect label="Cidade" value={filters.city} onChange={(value) => updateFilter('city', value)} options={cityOptions} />
            <FilterSelect label="Status cidade" value={filters.cityResolution} onChange={(value) => updateFilter('cityResolution', value)} options={cityResolutionOptions} />
            <FilterSelect label="Franchise" value={filters.franchiseId} onChange={(value) => updateFilter('franchiseId', value)} options={availableFranchiseOptions} />
            <FilterSelect label="Responsavel (base)" value={filters.responsible} onChange={(value) => updateFilter('responsible', value)} options={responsibleOptions} />
            <FilterSelect label="Conceito" value={filters.concept} onChange={(value) => updateFilter('concept', value)} options={conceptOptions} />
            <FilterSelect label="Rede" value={filters.networkId} onChange={(value) => updateFilter('networkId', value)} options={networkOptions} />
            <FilterSelect label="Categoria" value={filters.categoryId} onChange={(value) => updateFilter('categoryId', value)} options={categoryOptions} />
            <FilterSelect label="Checkout" value={filters.checkoutType} onChange={(value) => updateFilter('checkoutType', value)} options={checkoutOptions} />
            <FilterSelect label="Região serviço" value={filters.regionServiceId} onChange={(value) => updateFilter('regionServiceId', value)} options={regionServiceOptions} />
            <FilterSelect label="Região peças" value={filters.regionPartId} onChange={(value) => updateFilter('regionPartId', value)} options={regionPartOptions} />
          </div>

          <div className="filter-grid-tight">
            <FilterSelect label="Status" value={filters.isActive} onChange={(value) => updateFilter('isActive', value)} options={activeStatusOptions} />
            <FilterSelect label="Bloqueada" value={filters.isBlocked} onChange={(value) => updateFilter('isBlocked', value)} options={boolOptions} />
            <FilterSelect label="Offline" value={filters.isOffline} onChange={(value) => updateFilter('isOffline', value)} options={boolOptions} />
            <FilterSelect label="Fee" value={filters.isFee} onChange={(value) => updateFilter('isFee', value)} options={boolOptions} />
            <FilterSelect label="Margem" value={filters.isMargin} onChange={(value) => updateFilter('isMargin', value)} options={boolOptions} />
            <FilterSelect label="White label" value={filters.isWhiteLabel} onChange={(value) => updateFilter('isWhiteLabel', value)} options={boolOptions} />
            <FilterSelect label="Dahruj" value={filters.isDahruj} onChange={(value) => updateFilter('isDahruj', value)} options={boolOptions} />
            <FilterSelect label="Sem intermediação" value={filters.isNoIntermediation} onChange={(value) => updateFilter('isNoIntermediation', value)} options={boolOptions} />
          </div>
        </div>

        <div className="sidebar-actions">
          <FilterSelect label="Visao estrategica" value={filters.strategicView} onChange={(value) => updateFilter('strategicView', value)} options={strategicViewOptions} />
          <FilterSelect label="Mapa base" value={filters.mapTheme} onChange={(value) => updateFilter('mapTheme', value)} options={mapThemeOptions} />
          <FilterSelect label="Recorte geográfico" value={filters.locationScope} onChange={(value) => updateFilter('locationScope', value)} options={locationOptions} />
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
          <p>Análise de distribuição, cobertura operacional e oportunidades de expansão da rede credenciada.</p>
        </div>
        <div className="topbar-status">
          <div>
            <span>Última atualização</span>
            <strong>Hoje, base filtrada</strong>
          </div>
          <a className="app-switch-link" href="https://demandpipe-crm.vercel.app/" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">⇄</span> CRM DemandPipe
          </a>
          <button className="icon-button" onClick={() => setFitRequestToken((previous) => previous + 1)} title="Atualizar enquadramento" type="button">↻</button>
          <div className="operator-card">
            <span className="operator-avatar">DB</span>
            <div>
              <strong>DriveB</strong>
              <span>{filters.franchiseId === 'all' ? 'Franchises 1 e 2' : `Franchise ${filters.franchiseId}`}</span>
            </div>
          </div>
        </div>
        </header>

        <section className="kpi-grid">
          <KpiCard
            label="Total no recorte"
            value={formatNumber(filteredWorkshops.length)}
            meta={`${formatNumber(workshops.length)} registros na base`}
            badge="+ base atual"
            icon="▦"
          />
          <KpiCard
            label="Gaps mínimos"
            value={formatNumber(minimumGapTotal)}
            meta={`${formatNumber(idealGapTotal)} para meta ideal`}
            tone="amber"
            badge={minimumGapTotal ? 'Alvo' : 'Atendido'}
            icon="●"
          />
          <KpiCard
            label={`${strategicScopeLabel} criticas`}
            value={formatNumber(strategicSummary.criticalStates.length)}
            meta={`${formatNumber(blockedCount)} bloqueadas no recorte`}
            tone="rose"
            badge={strategicSummary.criticalStates.length ? 'Atenção' : 'OK'}
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
          <strong>{formatNumber(totalOutside)}</strong> registros da base estão fora do bounding box do Brasil; no recorte atual são <strong>{formatNumber(outsideCount)}</strong>.
        </section>

        <section className="dashboard-grid">
          <article className="panel map-panel">
            <div className="panel-heading">
              <div>
                <h2>Heatmap de Capilaridade</h2>
                <p>
                  Mapa, pontos clicaveis e reenquadramento conforme filtros ativos.
                  {cityResolvedCount ? ` ${percent(cityResolvedCount, filteredWorkshops.length)} do recorte ja esta agregado por cidade.` : ' Sem cidade resolvida no recorte atual.'}
                  {unresolvedCityCount ? ` ${formatNumber(unresolvedCityCount)} registros ainda estao sem cidade.` : ''}
                </p>
              </div>
              <SegmentedControl value={filters.layerMode} onChange={(value) => updateFilter('layerMode', value)} options={layerOptions} />
            </div>
            <MapView
              workshops={filteredWorkshops}
              selectedId={selectedId}
              onSelect={setSelectedId}
              layerMode={filters.layerMode}
              mapTheme={filters.mapTheme}
              fitRequestToken={fitRequestToken}
            />
          </article>

          <aside className="panel priority-panel">
            <div className="panel-heading">
              <div>
                <h2>Alvos Prioritarios</h2>
                <p>{strategicScopeLabel} com maior deficit de cobertura no recorte atual.</p>
              </div>
            </div>
            <div className="priority-list">
              {strategicSummary.topPriorityStates.length ? (
                strategicSummary.topPriorityStates.slice(0, 5).map((report, index) => (
                  <PriorityTarget key={report.groupKey} report={report} index={index} />
                ))
              ) : (
                <p className="muted">Nenhuma localidade com gap no recorte atual.</p>
              )}
            </div>
          </aside>
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel">
            <div className="panel-heading">
              <h2>Cidades pendentes</h2>
            </div>
            <div className="breakdown-list">
              <div className="breakdown-row">
                <div className="breakdown-label">
                  <span className="legend-dot" style={{ background: chartColors[0] }} />
                  <strong>Cidades resolvidas</strong>
                </div>
                <div className="breakdown-track">
                  <div className="breakdown-fill" style={{ width: `${cityPrecisionRate.toFixed(1)}%`, background: chartColors[0] }} />
                </div>
                <span>{formatNumber(cityResolvedCount)}</span>
              </div>
              <div className="breakdown-row">
                <div className="breakdown-label">
                  <span className="legend-dot" style={{ background: chartColors[3] }} />
                  <strong>Sem cidade resolvida</strong>
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
                <h2>Estados com pendencia</h2>
                <p>Onde ainda faltam cidades resolvidas na base atual.</p>
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
                        <p>{formatNumber(value)} registros sem cidade resolvida</p>
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
              <h2>Distribuição por Cobertura</h2>
            </div>
            <DonutChart data={coverageDistribution} formatter={(label) => label} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>Radar de Performance Regional</h2>
            </div>
            <RadarChart current={radarCurrent} reference={radarReference} />
          </article>
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel">
            <div className="panel-heading">
              <h2>Distribuicao por Franchise</h2>
            </div>
            <Breakdown data={franchiseDistribution} formatter={(label) => `Franchise ${label}`} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>Distribuicao por Conceito</h2>
            </div>
            <Breakdown data={conceptDistribution} formatter={(label) => label} />
          </article>
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel">
            <div className="panel-heading">
              <h2>{strategicDimension === 'city' ? 'Distribuicao por Cidade' : strategicDimension === 'state' ? 'Distribuicao por Estado' : strategicDimension === 'region_service' ? 'Distribuicao por Regiao de servico' : 'Distribuicao por Regiao de pecas'}</h2>
            </div>
            <Breakdown
              data={strategicDimension === 'city' ? cityDistribution : strategicDimension === 'state' ? stateDistribution : strategicDimension === 'region_service' ? countBy(filteredWorkshops.filter((item) => item.regionServiceLabel), 'regionServiceLabel') : countBy(filteredWorkshops.filter((item) => item.regionPartLabel), 'regionPartLabel')}
              formatter={(label) => (strategicDimension === 'state' ? formatStateLabel(label) : label)}
            />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>Amostra sem cidade</h2>
            </div>
            <div className="priority-list">
              {missingCitySummary.sample.length ? (
                missingCitySummary.sample.map((item, index) => (
                  <CityGapItem key={`${item.id}-${index}`} item={item} index={index} />
                ))
              ) : (
                <p className="muted">Nenhuma oficina sem cidade resolvida no recorte atual.</p>
              )}
            </div>
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
                  <th>Ações</th>
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
                          <span>SAP {item.sapId || '-'} · {item.corporateName || 'Sem razão social'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.cityDisplayName || `Cidade pendente - ${formatStateLabel(item.stateCode)}`}</td>
                    <td><WorkshopBadges item={item} /></td>
                    <td>Rede {item.networkId || '-'}<br /><span className="muted-small">Franchise {item.franchiseId || '-'} | Categoria {item.categoryId || '-'}</span></td>
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
            <span>Mostrando página {currentPage} de {totalPages}</span>
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
