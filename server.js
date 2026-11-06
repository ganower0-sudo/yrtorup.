const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const PRICE_REFRESH_MS = Math.max(5, Number(process.env.PRICE_REFRESH_MINUTES || 5)) * 60 * 1000;
const FX_REFRESH_MS = 6 * 60 * 60 * 1000;
const SKINCASH_URL = 'https://api.skincash.gg/v1/prices';
const FX_URL = 'https://open.er-api.com/v6/latest/USD';

let priceCache = null;
let priceCacheTime = 0;
let priceRefreshPromise = null;
let fxCache = null;
let fxCacheTime = 0;
let fxRefreshPromise = null;
let lastError = null;

async function getRubRate() {
  if (fxCache && Date.now() - fxCacheTime < FX_REFRESH_MS) return fxCache;
  if (fxRefreshPromise) return fxRefreshPromise;
  fxRefreshPromise = (async () => {
    const response = await fetch(FX_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Курс USD/RUB: HTTP ${response.status}`);
    const body = await response.json();
    const rate = Number(body?.rates?.RUB);
    if (body?.result !== 'success' || !Number.isFinite(rate) || rate <= 0) throw new Error('Не удалось получить курс USD/RUB');
    fxCache = { rate, date: body.time_last_update_utc || new Date().toISOString() };
    fxCacheTime = Date.now();
    return fxCache;
  })();
  try { return await fxRefreshPromise; }
  finally { fxRefreshPromise = null; }
}

async function refreshPrices() {
  if (priceRefreshPromise) return priceRefreshPromise;
  priceRefreshPromise = (async () => {
    const [response, fx] = await Promise.all([
      fetch(SKINCASH_URL, { headers: { Accept: 'application/json', 'User-Agent': 'YRTORUP/1.0 demo price sync' }, signal: AbortSignal.timeout(60000) }),
      getRubRate()
    ]);
    if (!response.ok) throw new Error(`SkinCash API: HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body?.items)) throw new Error('SkinCash вернул неожиданный формат: items[] отсутствует');
    const items = [];
    for (const row of body.items) {
      const name = String(row?.market_hash_name || '').trim();
      const usd = Number(row?.price);
      if (!name || !Number.isFinite(usd) || usd <= 0) continue;
      if (/(graffiti|spray|граффити|графити|\\bcharm\\b|брелок)/i.test(name)) continue;
      items.push({ market_hash_name: name, price: Math.round(usd * fx.rate * 100) / 100, price_usd: usd, quantity: Number(row.quantity) || 0 });
    }
    if (!items.length) throw new Error('SkinCash не вернул ни одной цены');
    const result = {
      success: true,
      source: 'SkinCash',
      currency: 'RUB',
      sourceCurrency: 'USD',
      time: Math.floor(Date.now() / 1000),
      sourceUpdatedAt: body.updated_at || null,
      exchangeRate: fx.rate,
      exchangeRateUpdatedAt: fx.date,
      count: items.length,
      items
    };
    priceCache = result;
    priceCacheTime = Date.now();
    lastError = null;
    return result;
  })();
  try { return await priceRefreshPromise; }
  catch (error) { lastError = error.message; throw error; }
  finally { priceRefreshPromise = null; }
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/prices/RUB.json', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  if (priceCache && Date.now() - priceCacheTime < PRICE_REFRESH_MS) return res.json(priceCache);
  try { return res.json(await refreshPrices()); }
  catch (error) {
    console.error('[YRTORUP SkinCash prices]', error.message);
    if (priceCache) return res.status(200).json({ ...priceCache, stale: true, warning: lastError });
    return res.status(503).json({ success: false, source: 'SkinCash', error: lastError || error.message, items: [] });
  }
});
app.get('/health', (_req, res) => res.json({ ok: true, source: 'SkinCash', currency: 'RUB', priceCache: !!priceCache, priceCount: priceCache?.count || 0, lastUpdated: priceCacheTime || null, exchangeRate: fxCache?.rate || null, lastError }));
app.listen(PORT, () => console.log(`YRTORUP SkinCash server listening on ${PORT}`));
