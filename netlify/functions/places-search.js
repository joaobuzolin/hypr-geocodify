// Netlify Function — Google Places API (New) proxy
// Keeps API key server-side, exposes two actions:
//   1. textSearch  — Text Search Essentials (IDs Only) → free & unlimited
//   2. details     — Place Details Essentials (name, address, location) → $5/1k, 10k free/mo

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'POST only' }) };
  }
  if (!API_KEY) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action } = body;

  try {
    if (action === 'textSearch') {
      return await handleTextSearch(body);
    } else if (action === 'details') {
      return await handleDetails(body);
    } else {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown action. Use textSearch or details.' }) };
    }
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};

// ─── Text Search (IDs Only) — FREE ──────────────────────────────────────────
async function handleTextSearch(body) {
  const { query, lat, lon, radius, bbox, pageToken } = body;

  if (!query) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'query required' }) };
  }

  const payload = {
    textQuery: query,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    pageSize: 20,
  };

  // locationRestriction with bounding box — HARD limit, prevents out-of-state results
  if (bbox && bbox.south != null && bbox.north != null && bbox.west != null && bbox.east != null) {
    payload.locationRestriction = {
      rectangle: {
        low: { latitude: bbox.south, longitude: bbox.west },
        high: { latitude: bbox.north, longitude: bbox.east },
      }
    };
  }
  // Fallback: locationBias with circle (for pin mode)
  else if (lat != null && lon != null && radius) {
    payload.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lon },
        radius: radius,
      }
    };
  }

  if (pageToken) {
    payload.pageToken = pageToken;
  }

  // IDs Only field mask — triggers FREE SKU
  const fieldMask = 'places.id';

  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();

  if (!resp.ok) {
    return { statusCode: resp.status, headers: HEADERS, body: JSON.stringify({ error: data.error?.message || 'Google API error', details: data }) };
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      placeIds: (data.places || []).map(p => p.id),
      nextPageToken: data.nextPageToken || null,
    }),
  };
}

// ─── Place Details Pro — $17/1k, 5k free/mo ────────────────────────────────
// displayName triggers Pro SKU but is essential for place name validation
// DO NOT add businessStatus, googleMapsUri, etc. unless strictly needed
async function handleDetails(body) {
  const { placeIds } = body;

  if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'placeIds array required' }) };
  }

  // Process in small parallel groups of 5 to avoid rate limiting
  const ids = placeIds.slice(0, 10);
  const results = [];
  const GROUP = 5;
  
  for (let i = 0; i < ids.length; i += GROUP) {
    const group = ids.slice(i, i + GROUP);
    const groupResults = await Promise.allSettled(
      group.map(async (pid) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const resp = await fetch(`https://places.googleapis.com/v1/places/${pid}`, {
              method: 'GET',
              headers: {
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types',
              },
            });
            if (resp.ok) {
              const d = await resp.json();
              return {
                place_id: d.id,
                name: d.displayName?.text || (d.formattedAddress || '').split(',')[0] || '',
                address: d.formattedAddress || '',
                lat: d.location?.latitude || null,
                lon: d.location?.longitude || null,
                types: d.types || [],
                status: '',
              };
            }
            if (resp.status === 429 && attempt === 0) {
              await new Promise(r => setTimeout(r, 300));
              continue;
            }
            return null;
          } catch {
            if (attempt === 0) { await new Promise(r => setTimeout(r, 200)); continue; }
            return null;
          }
        }
        return null;
      })
    );
    for (const r of groupResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ places: results }),
  };
}
