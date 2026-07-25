// GET /api/nearest-region?lat=<위도>&lon=<경도>
// 랭킹 앱 코드 그대로 재사용 (import 경로만 조정).
// 좌표에서 가장 가까운 시군구를 centroid 최근접 매칭으로 찾음.

import SIGUNGU from '../data/sigungu.json' with { type: 'json' };

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearest(list, lat, lon, getLat, getLon) {
  let best = null;
  let bestDist = Infinity;
  for (const item of list) {
    const d = haversineKm(lat, lon, getLat(item), getLon(item));
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return { item: best, distanceKm: bestDist };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'lat/lon 쿼리 파라미터가 올바르지 않습니다.' });
  }

  const cityResult = findNearest(SIGUNGU, lat, lon, (c) => c.lat, (c) => c.lon);
  if (!cityResult.item) {
    return res.status(404).json({ error: '가장 가까운 시군구를 찾지 못했습니다.' });
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  return res.status(200).json({
    city: {
      code: cityResult.item.code,
      nameKo: cityResult.item.nameKo,
      lat: cityResult.item.lat,
      lon: cityResult.item.lon,
      distanceKm: Math.round(cityResult.distanceKm * 10) / 10,
    },
  });
}
