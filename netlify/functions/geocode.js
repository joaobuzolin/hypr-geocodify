// Netlify Function — HERE Geocoding API proxy (placeholder)
// The frontend currently calls HERE API directly with the client-side key.
// This function exists for future migration to server-side key management.

const HERE_KEY = process.env.HERE_API_KEY;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const q = event.queryStringParameters?.q;
  if (!q || !HERE_KEY) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing query or HERE_API_KEY' }) };
  }

  const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(q)}&in=countryCode:BRA&limit=1&lang=pt-BR&apiKey=${HERE_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  return { statusCode: resp.status, headers, body: JSON.stringify(data) };
};
