'use client';

import { useEffect, useRef, useState } from 'react';
import { googleMapsUrl } from '../lib/workshop-utils';
import { brandIconUrl, workshopBrands } from '../lib/workshop-brands';

const BRAZIL_CENTER = [-14.235, -51.9253];
const SOUTH_AMERICA_BOUNDS = [
  [-35.5, -74.5],
  [7.5, -28.0],
];

const DEFAULT_MARKER_ICON_SRC = '/icons/car-marker-network.png';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadMarkerIcons() {
  const brandEntries = await Promise.all(
    workshopBrands.map(async (brand) => [brand.slug, await loadImage(brandIconUrl(brand.slug))]),
  );
  const defaultIcon = await loadImage(DEFAULT_MARKER_ICON_SRC);
  return { default: defaultIcon, brands: Object.fromEntries(brandEntries) };
}

// Tiles Esri (ArcGIS Online), sem necessidade de API key. "light" traz relevo/hillshade real.
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, USGS, NGA, EPA';

const tileThemes = {
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    options: {},
    attribution: ESRI_ATTRIBUTION,
  },
  voyager: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {},
    attribution: ESRI_ATTRIBUTION,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {},
    attribution: ESRI_ATTRIBUTION,
  },
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: {},
    attribution: ESRI_ATTRIBUTION,
  },
};

function getTileThemeConfig(theme) {
  return tileThemes[theme] || tileThemes.light;
}

function getHeatStyle(zoom) {
  if (zoom <= 4) return { radius: 18, blur: 14, minOpacity: 0.2 };
  if (zoom <= 5) return { radius: 20, blur: 16, minOpacity: 0.22 };
  if (zoom <= 6) return { radius: 22, blur: 18, minOpacity: 0.25 };
  if (zoom <= 7) return { radius: 24, blur: 20, minOpacity: 0.28 };
  return { radius: 26, blur: 22, minOpacity: 0.3 };
}

function getMarkerRadius(zoom, isSelected) {
  if (isSelected) return 13;
  if (zoom <= 4) return 6;
  if (zoom <= 6) return 7;
  return 8;
}

function getGridSize(zoom) {
  if (zoom <= 4) return 1.4;
  if (zoom <= 5) return 0.95;
  if (zoom <= 6) return 0.65;
  if (zoom <= 7) return 0.4;
  if (zoom <= 8) return 0.22;
  return 0;
}

function buildCityBuckets(workshops) {
  const buckets = new Map();
  workshops.forEach((item) => {
    if (!item.cityKey || !item.cityName) return;
    const key = `city:${item.cityKey}`;
    const current = buckets.get(key) || { count: 0, latSum: 0, lngSum: 0, blocked: 0 };
    current.count += 1;
    current.latSum += item.lat;
    current.lngSum += item.lng;
    current.blocked += item.isBlocked ? 1 : 0;
    buckets.set(key, current);
  });

  return buckets;
}

function buildCoordinateBuckets(workshops, zoom) {
  const gridSize = getGridSize(zoom);

  if (!gridSize) {
    return workshops.map((item) => ({
      count: 1,
      lat: item.lat,
      lng: item.lng,
      blockedRatio: item.isBlocked ? 1 : 0,
    }));
  }

  const buckets = new Map();
  workshops.forEach((item) => {
    const latBucket = Math.round(item.lat / gridSize);
    const lngBucket = Math.round(item.lng / gridSize);
    const key = `${latBucket}:${lngBucket}`;
    const current = buckets.get(key) || { count: 0, latSum: 0, lngSum: 0, blocked: 0 };
    current.count += 1;
    current.latSum += item.lat;
    current.lngSum += item.lng;
    current.blocked += item.isBlocked ? 1 : 0;
    buckets.set(key, current);
  });

  return [...buckets.values()].map((bucket) => ({
    count: bucket.count,
    lat: bucket.latSum / bucket.count,
    lng: bucket.lngSum / bucket.count,
    blockedRatio: bucket.blocked / bucket.count,
  }));
}

function buildHeatPoints(workshops, zoom) {
  const resolvedByCity = [];
  const unresolved = [];

  workshops.forEach((item) => {
    if (item.cityKey && item.cityName) {
      resolvedByCity.push(item);
      return;
    }
    unresolved.push(item);
  });

  const cityBuckets = [...buildCityBuckets(resolvedByCity).values()].map((bucket) => ({
    count: bucket.count,
    lat: bucket.latSum / bucket.count,
    lng: bucket.lngSum / bucket.count,
    blockedRatio: bucket.blocked / bucket.count,
  }));
  const coordinateBuckets = buildCoordinateBuckets(unresolved, zoom);
  const grouped = [...cityBuckets, ...coordinateBuckets];

  if (!grouped.length) return [];

  const peak = grouped.reduce((max, bucket) => Math.max(max, bucket.count), 1);

  return grouped.map((bucket) => {
    const normalized = bucket.count / peak;
    const weight = Math.min(1, 0.18 + normalized * 0.72 - bucket.blockedRatio * 0.08);

    return [
      bucket.lat,
      bucket.lng,
      Math.max(0.12, weight),
    ];
  });
}

export default function MapView({ workshops, selectedId, onSelect, layerMode, mapTheme, fitRequestToken, isFullscreen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());
  const iconsRef = useRef(null);
  const carRendererRef = useRef(null);
  const measureLayerRef = useRef(null);
  const measurePointsRef = useRef([]);
  const measureModeRef = useRef(false);
  const [zoom, setZoom] = useState(4);
  const [mapReady, setMapReady] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);

  function addMeasurePoint(latlng) {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = measureLayerRef.current;
    if (!L || !map || !layer) return;

    const points = measurePointsRef.current.length >= 2 ? [latlng] : [...measurePointsRef.current, latlng];
    measurePointsRef.current = points;

    layer.clearLayers();
    points.forEach((point) => {
      L.circleMarker(point, {
        radius: 6,
        weight: 2,
        color: '#f6b21a',
        fillColor: '#f6b21a',
        fillOpacity: 1,
      }).addTo(layer);
    });

    if (points.length === 2) {
      const [pointA, pointB] = points;
      L.polyline(points, { color: '#6c5dd3', weight: 3, dashArray: '6 8' }).addTo(layer);
      const distanceKm = map.distance(pointA, pointB) / 1000;
      const midpoint = [(pointA[0] + pointB[0]) / 2, (pointA[1] + pointB[1]) / 2];
      L.tooltip({ permanent: true, direction: 'center', className: 'measure-distance-label' })
        .setLatLng(midpoint)
        .setContent(`${distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km (linha reta)`)
        .addTo(layer);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;

      const leafletModule = await import('leaflet');
      const L = leafletModule.default || leafletModule;
      window.L = L;
      await import('leaflet.heat');
      if (cancelled || !containerRef.current) return;

      iconsRef.current = await loadMarkerIcons();
      if (cancelled || !containerRef.current) return;

      const CarCanvas = L.Canvas.extend({
        _updateCircle(layer) {
          if (!this._drawing || layer._empty()) return;

          const icon = layer.options.markerIcon;
          if (!icon) {
            L.Canvas.prototype._updateCircle.call(this, layer);
            return;
          }

          const ctx = this._ctx;
          const p = layer._point;
          const height = layer._radius * (layer.options.isBrand ? 3.1 : 2.6);
          const width = height * (icon.naturalWidth / icon.naturalHeight);

          ctx.save();
          if (layer.options.isSelected) {
            ctx.shadowColor = 'rgba(248, 250, 252, 0.9)';
            ctx.shadowBlur = 10;
          }
          ctx.drawImage(icon, p.x - width / 2, p.y - height / 2, width, height);
          ctx.restore();
        },
      });

      const map = L.map(containerRef.current, {
        zoomControl: false,
        preferCanvas: true,
        maxBounds: SOUTH_AMERICA_BOUNDS,
        maxBoundsViscosity: 0.65,
      }).setView(BRAZIL_CENTER, 4);

      map.createPane('heatPane');
      map.getPane('heatPane').style.zIndex = 320;
      map.createPane('markerPaneStrong');
      map.getPane('markerPaneStrong').style.zIndex = 470;

      carRendererRef.current = new CarCanvas({ pane: 'markerPaneStrong' });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      const themeConfig = getTileThemeConfig(mapTheme);
      tileLayerRef.current = L.tileLayer(themeConfig.url, {
        maxZoom: 18,
        ...themeConfig.options,
        attribution: themeConfig.attribution,
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      heatLayerRef.current = L.heatLayer([], {
        pane: 'heatPane',
        radius: 18,
        blur: 14,
        maxZoom: 7,
        minOpacity: 0.2,
        gradient: {
          0.15: '#60a5fa',
          0.35: '#22d3ee',
          0.58: '#fde047',
          0.8: '#fb923c',
          1.0: '#ef4444',
        },
      });
      markersLayerRef.current = L.layerGroup();
      measureLayerRef.current = L.layerGroup().addTo(map);
      map.on('zoomend', () => setZoom(map.getZoom()));
      map.on('click', (event) => {
        if (!measureModeRef.current) return;
        addMeasurePoint([event.latlng.lat, event.latlng.lng]);
      });
      if (!cancelled) setMapReady(true);
    }

    setup();

    return () => {
      cancelled = true;
      markerByIdRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      leafletRef.current = null;
      heatLayerRef.current = null;
      markersLayerRef.current = null;
      tileLayerRef.current = null;
      carRendererRef.current = null;
      measureLayerRef.current = null;
      measurePointsRef.current = [];
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    measureModeRef.current = measureMode;
    if (!measureMode) {
      measurePointsRef.current = [];
      measureLayerRef.current?.clearLayers();
    }
  }, [measureMode]);

  useEffect(() => {
    const map = mapRef.current;
    const tileLayer = tileLayerRef.current;
    const L = leafletRef.current;
    if (!map || !tileLayer || !L) return;

    map.removeLayer(tileLayer);
    const themeConfig = getTileThemeConfig(mapTheme);
    tileLayerRef.current = L.tileLayer(themeConfig.url, {
      maxZoom: 18,
      ...themeConfig.options,
      attribution: themeConfig.attribution,
    }).addTo(map);
  }, [mapTheme]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const heatLayer = heatLayerRef.current;
    const markersLayer = markersLayerRef.current;
    if (!L || !map || !heatLayer || !markersLayer) return;

    const heatStyle = getHeatStyle(zoom);
    heatLayer.setOptions({
      radius: heatStyle.radius,
      blur: heatStyle.blur,
      minOpacity: heatStyle.minOpacity,
    });
    heatLayer.setLatLngs(buildHeatPoints(workshops, zoom));

    markersLayer.clearLayers();
    markerByIdRef.current.clear();

    const icons = iconsRef.current;
    const carRenderer = carRendererRef.current;

    workshops.forEach((item) => {
      const isSelected = selectedId === item.id;
      const brand = item.brandSlug ? { slug: item.brandSlug, label: item.brandLabel } : null;
      const brandIcon = brand && icons?.brands[brand.slug];
      const markerIcon = icons ? (brandIcon || icons.default) : null;
      const marker = L.circleMarker(
        [item.lat, item.lng],
        {
          renderer: carRenderer,
          bubblingMouseEvents: false,
          radius: getMarkerRadius(zoom, isSelected),
          markerIcon,
          isBrand: Boolean(brandIcon),
          isSelected,
        },
      ).bindPopup([
        '<div>',
        `<strong>${item.displayName}</strong><br/>`,
        `<span>${item.corporateName || ''}</span><br/>`,
        brand ? `<span>Rede: ${brand.label}</span><br/>` : '',
        `<span>Conceito: ${item.concept || 'N/D'}</span><br/>`,
        `<span>Franchise: ${item.franchiseId || 'N/D'}</span><br/>`,
        `<span>Estado: ${item.stateCode || 'N/D'}${item.stateName ? ` - ${item.stateName}` : ''}</span><br/>`,
        item.cityDisplayName ? `<span>Cidade: ${item.cityDisplayName}</span><br/>` : '',
        `<span>Cobertura: ${item.serviceTypeLabel || item.coverageLabel || 'Oficina'}</span><br/>`,
        item.categoria
          ? `<span>Categoria: ${item.categoria}</span><br/>`
          : `<span>Rede: ${item.networkId || 'N/D'} - Categoria: ${item.categoryId || 'N/D'}</span><br/>`,
        `<span>Contato: ${item.phone || item.ownerMobilePhone || 'N/D'}</span><br/>`,
        `<a class="link-button" target="_blank" rel="noreferrer" href="${googleMapsUrl(item)}">Abrir no Google Maps</a>`,
        '</div>',
      ].join(''));

      marker.bindTooltip(item.displayName, {
        direction: 'top',
        offset: [0, -8],
        opacity: 0.92,
      });
      marker.on('mouseover', () => marker.openTooltip());
      marker.on('mouseout', () => marker.closeTooltip());
      marker.on('click', () => {
        if (measureModeRef.current) {
          addMeasurePoint([item.lat, item.lng]);
          return;
        }
        onSelect(item.id);
        marker.openPopup();
      });
      markerByIdRef.current.set(item.id, marker);
      markersLayer.addLayer(marker);
    });

    if (layerMode === 'heat' || layerMode === 'both') {
      if (!map.hasLayer(heatLayer)) map.addLayer(heatLayer);
    } else if (map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
    }

    if (layerMode === 'points' || layerMode === 'both') {
      if (!map.hasLayer(markersLayer)) map.addLayer(markersLayer);
    } else if (map.hasLayer(markersLayer)) {
      map.removeLayer(markersLayer);
    }
  }, [layerMode, onSelect, selectedId, workshops, zoom, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!workshops.length) {
      map.setView(BRAZIL_CENTER, 4);
      return;
    }

    const L = leafletRef.current;
    const bounds = L.latLngBounds(workshops.map((item) => [item.lat, item.lng]));
    map.fitBounds(bounds.pad(0.12), { maxZoom: 8 });
  }, [fitRequestToken, workshops, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerByIdRef.current.get(selectedId);
    if (!map || !marker) return;

    const latLng = marker.getLatLng();
    map.flyTo([latLng.lat, latLng.lng], Math.max(map.getZoom(), 8), { duration: 0.6 });
    marker.openPopup();
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const timeoutId = window.setTimeout(() => map.invalidateSize(), 220);
    return () => window.clearTimeout(timeoutId);
  }, [isFullscreen]);

  return (
    <div className="map-canvas-wrapper">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-measure-control">
        <button
          className={`icon-button ${measureMode ? 'is-active' : ''}`}
          onClick={() => setMeasureMode((previous) => !previous)}
          title={measureMode ? 'Sair do modo medir distancia' : 'Medir distancia entre 2 pontos'}
          type="button"
        >
          ⟷
        </button>
        {measureMode ? <span className="map-measure-hint">Clique em 2 pontos do mapa para medir a distancia</span> : null}
      </div>
    </div>
  );
}

