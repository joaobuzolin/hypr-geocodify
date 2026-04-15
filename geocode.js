// Vercel Serverless Function — HERE Geocoding API proxy
// Adaptado da Netlify Function original. Mesma lógica, formato Vercel.

const HERE_KEY = process.env.HERE_API_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = req.query?.q;
  if (!q || !HERE_KEY) {
    return res.status(400).json({ error: 'Missing query or HERE_API_KEY' });
  }

  const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(q)}&in=countryCode:BRA&limit=1&lang=pt-BR&apiKey=${HERE_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  return res.status(resp.status).json(data);
}
