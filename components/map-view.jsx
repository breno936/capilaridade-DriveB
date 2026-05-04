'use client';

import { useEffect, useRef, useState } from 'react';
import { conceptColor, googleMapsUrl } from '../lib/workshop-utils';

const BRAZIL_CENTER = [-14.235, -51.9253];
const SOUTH_AMERICA_BOUNDS = [
  [-35.5, -74.5],
  [7.5, -28.0],
];

function getHeatStyle(zoom) {
  if (zoom <= 4) return { radius: 18, blur: 14, minOpacity: 0.2 };
  if (zoom <= 5) return { radius: 20, blur: 16, minOpacity: 0.22 };
  if (zoom <= 6) return { radius: 22, blur: 18, minOpacity: 0.25 };
  if (zoom <= 7) return { radius: 24, blur: 20, minOpacity: 0.28 };
  return { radius: 26, blur: 22, minOpacity: 0.3 };
}

function getMarkerStyle(item, zoom, isSelected) {
  const radius = isSelected ? 9 : zoom <= 4 ? 5 : zoom <= 6 ? 6 : 7;
  return {
    radius,
    weight: isSelected ? 3 : 2,
    color: isSelected ? '#f8fafc' : '#0f172a',
    fillColor: conceptColor(item.concept),
    fillOpacity: isSelected ? 1 : 0.92,
    opacity: 1,
  };
}

function getGridSize(zoom) {
  if (zoom <= 4) return 1.4;
  if (zoom <= 5) return 0.95;
  if (zoom <= 6) return 0.65;
  if (zoom <= 7) return 0.4;
  if (zoom <= 8) return 0.22;
  return 0;
}

function buildHeatPoints(workshops, zoom) {
  const gridSize = getGridSize(zoom);

  if (!gridSize) {
    return workshops.map((item) => [item.lat, item.lng, item.isBlocked ? 0.35 : 0.55]);
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

  const grouped = [...buckets.values()];
  const peak = grouped.reduce((max, bucket) => Math.max(max, bucket.count), 1);

  return grouped.map((bucket) => {
    const blockedRatio = bucket.blocked / bucket.count;
    const normalized = bucket.count / peak;
    const weight = Math.min(1, 0.18 + normalized * 0.72 - blockedRatio * 0.08);

    return [
      bucket.latSum / bucket.count,
      bucket.lngSum / bucket.count,
      Math.max(0.12, weight),
    ];
  });
}

export default function MapView({ workshops, selectedId, onSelect, layerMode, fitRequestToken }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerByIdRef = useRef(new Map());
  const [zoom, setZoom] = useState(4);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;

      const leafletModule = await import('leaflet');
      const L = leafletModule.default || leafletModule;
      window.L = L;
      await import('leaflet.heat');
      if (cancelled || !containerRef.current) return;

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

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
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
      map.on('zoomend', () => setZoom(map.getZoom()));
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
    };
  }, []);

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

    workshops.forEach((item) => {
      const marker = L.circleMarker(
        [item.lat, item.lng],
        {
          pane: 'markerPaneStrong',
          bubblingMouseEvents: false,
          ...getMarkerStyle(item, zoom, selectedId === item.id),
        },
      ).bindPopup([
        '<div>',
        `<strong>${item.displayName}</strong><br/>`,
        `<span>${item.corporateName || ''}</span><br/>`,
        `<span>Conceito: ${item.concept || 'N/D'}</span><br/>`,
        `<span>Estado: ${item.stateCode || 'N/D'}${item.stateName ? ` - ${item.stateName}` : ''}</span><br/>`,
        item.cityDisplayName ? `<span>Cidade: ${item.cityDisplayName}</span><br/>` : '',
        `<span>Cobertura: ${item.coverageLabel || 'Oficina'}</span><br/>`,
        `<span>Rede: ${item.networkId || 'N/D'} - Categoria: ${item.categoryId || 'N/D'}</span><br/>`,
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
      marker.on('click', () => onSelect(item.id));
      marker.on('click', () => marker.openPopup());
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
  }, [layerMode, onSelect, selectedId, workshops, zoom]);

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
  }, [fitRequestToken, workshops]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerByIdRef.current.get(selectedId);
    if (!map || !marker) return;

    const latLng = marker.getLatLng();
    map.flyTo([latLng.lat, latLng.lng], Math.max(map.getZoom(), 8), { duration: 0.6 });
    marker.openPopup();
  }, [selectedId]);

  return <div ref={containerRef} className="map-canvas" />;
}

