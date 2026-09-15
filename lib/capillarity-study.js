import { normalizeText, stateNameByCode } from './workshop-utils';

const stateCodeByNormalizedName = Object.fromEntries(
  Object.entries(stateNameByCode).map(([code, name]) => [normalizeText(name), code]),
);

export function resolveStateCode(rawState) {
  const value = String(rawState || '').trim();
  if (!value) return '';
  if (value.length === 2) return value.toUpperCase();
  return stateCodeByNormalizedName[normalizeText(value)] || '';
}

export function buildCityKey(cityName, stateCode) {
  if (!cityName || !stateCode) return '';
  return `${normalizeText(cityName)}::${stateCode}`;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildCoverageIndex(workshops) {
  const index = new Map();

  workshops.forEach((item) => {
    if (!item.cityKey || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
    const current = index.get(item.cityKey) || {
      cityKey: item.cityKey,
      cityDisplayName: item.cityDisplayName || item.cityName,
      count: 0,
      latSum: 0,
      lngSum: 0,
      serviceCounts: {},
      brandCounts: {},
    };
    current.count += 1;
    current.latSum += item.lat;
    current.lngSum += item.lng;
    const tag = item.serviceType || 'oficina';
    current.serviceCounts[tag] = (current.serviceCounts[tag] || 0) + 1;
    const brand = item.brandLabel || 'Independente';
    current.brandCounts[brand] = (current.brandCounts[brand] || 0) + 1;
    index.set(item.cityKey, current);
  });

  index.forEach((entry) => {
    entry.lat = entry.latSum / entry.count;
    entry.lng = entry.lngSum / entry.count;
  });

  return index;
}

export function buildCityLookup(brCities) {
  const map = new Map();
  brCities.forEach((city) => {
    const key = buildCityKey(city.name, city.stateCode);
    if (key && !map.has(key)) map.set(key, city);
  });
  return map;
}

export function buildCityNameStatesIndex(brCities) {
  const index = new Map();
  brCities.forEach((city) => {
    const nameKey = normalizeText(city.name);
    if (!nameKey) return;
    const current = index.get(nameKey) || new Set();
    current.add(city.stateCode);
    index.set(nameKey, current);
  });
  return index;
}

export function inferStateCode(cityName, cityNameStatesIndex) {
  const candidates = cityNameStatesIndex.get(normalizeText(cityName));
  if (candidates && candidates.size === 1) return [...candidates][0];
  return '';
}

export function findNearestCoveredCity(lat, lng, coverageIndex) {
  let best = null;
  coverageIndex.forEach((entry) => {
    const distanceKm = haversineKm(lat, lng, entry.lat, entry.lng);
    if (!best || distanceKm < best.distanceKm) {
      best = {
        cityDisplayName: entry.cityDisplayName,
        distanceKm,
        count: entry.count,
        serviceCounts: entry.serviceCounts,
        brandCounts: entry.brandCounts,
      };
    }
  });
  return best;
}

export function generateCapillarityStudy({ rows, workshops, brCities }) {
  const coverageIndex = buildCoverageIndex(workshops);
  const cityLookup = buildCityLookup(brCities);
  const cityNameStatesIndex = buildCityNameStatesIndex(brCities);

  const results = rows.map((row) => {
    let stateCode = resolveStateCode(row.state);
    let stateInferred = false;
    if (!stateCode) {
      stateCode = inferStateCode(row.city, cityNameStatesIndex);
      stateInferred = Boolean(stateCode);
    }

    const cityKey = buildCityKey(row.city, stateCode);
    const coverage = cityKey ? coverageIndex.get(cityKey) : null;

    let status = 'unresolved';
    let nearestCityLabel = '';
    let nearestDistanceKm = null;
    let workshopCount = 0;
    let serviceCounts = null;
    let brandCounts = null;
    let nearestCoverage = null;

    if (coverage) {
      status = 'covered';
      workshopCount = coverage.count;
      serviceCounts = coverage.serviceCounts;
      brandCounts = coverage.brandCounts;
    } else {
      const target = cityKey ? cityLookup.get(cityKey) : null;
      if (target) {
        status = 'uncovered';
        const nearest = coverageIndex.size ? findNearestCoveredCity(target.lat, target.lng, coverageIndex) : null;
        if (nearest) {
          nearestDistanceKm = nearest.distanceKm;
          nearestCityLabel = `${Math.round(nearest.distanceKm)} km - ${nearest.cityDisplayName}`;
          nearestCoverage = nearest;
        }
      }
    }

    return {
      ...row,
      stateCode,
      stateInferred,
      status,
      hasWorkshop: status === 'covered',
      workshopCount,
      serviceCounts,
      brandCounts,
      nearestCityLabel,
      nearestDistanceKm,
      nearestCoverage,
    };
  });

  const total = results.length;
  const covered = results.filter((row) => row.status === 'covered').length;
  const uncovered = results.filter((row) => row.status === 'uncovered').length;
  const unresolved = results.filter((row) => row.status === 'unresolved').length;

  const summary = {
    total,
    covered,
    uncovered,
    unresolved,
    coveragePercent: total ? (covered / total) * 100 : 0,
    gapPercent: total ? ((uncovered + unresolved) / total) * 100 : 0,
  };

  return { results, summary };
}
