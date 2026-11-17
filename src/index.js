// YRTORUP Cloudflare Worker — replaces the Express server.js
// Static site files are served from the ./site directory via the ASSETS binding.

const SKINCASH_URL = "https://api.skincash.gg/v1/prices";
const FX_URL = "https://open.er-api.com/v6/latest/USD";
const CSAPI_V2_URL = "https://raw.githubusercontent.com/qwkdev/csapi/main/data2.json";

const PRICE_TTL = 5 * 60 * 1000;
const FX_TTL = 6 * 60 * 60 * 1000;
const IMAGE_INDEX_TTL = 24 * 60 * 60 * 1000;

let priceCache = null, priceCacheTime = 0, priceRefreshPromise = null;
let fxCache = null, fxCacheTime = 0, fxRefreshPromise = null;
let imageIndex = null, imageIndexTime = 0, imageIndexPromise = null;
let lastError = null;
const imageCache = new Map();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });

async function getRubRate() {
  if (fxCache && Date.now() - fxCacheTime < FX_TTL) return fxCache;
  if (fxRefreshPromise) return fxRefreshPromise;
  fxRefreshPromise = (async () => {
    const response = await fetch(FX_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Курс USD/RUB: HTTP ${response.status}`);
    const body = await response.json();
    const rate = Number(body?.rates?.RUB);
    if (body?.result !== "success" || !Number.isFinite(rate) || rate <= 0)
      throw new Error("Не удалось получить курс USD/RUB");
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
      fetch(SKINCASH_URL, {
        headers: { Accept: "application/json", "User-Agent": "YRTORUP/1.0 demo price sync" },
        signal: AbortSignal.timeout(60000)
      }),
      getRubRate()
    ]);
    if (!response.ok) throw new Error(`SkinCash API: HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body?.items))
      throw new Error("SkinCash вернул неожиданный формат: items[] отсутствует");
    const items = [];
    for (const row of body.items) {
      const name = String(row?.market_hash_name || "").trim();
      const usd = Number(row?.price);
      if (!name || !Number.isFinite(usd) || usd <= 0) continue;
      if (/(graffiti|spray|граффити|графити|\bcharm\b|брелок)/i.test(name)) continue;
      items.push({
        market_hash_name: name,
        price: Math.round(usd * fx.rate * 100) / 100,
        price_usd: usd,
        quantity: Number(row.quantity) || 0
      });
    }
    if (!items.length) throw new Error("SkinCash не вернул ни одной цены");
    const result = {
      success: true, source: "SkinCash", currency: "RUB", sourceCurrency: "USD",
      time: Math.floor(Date.now() / 1000), sourceUpdatedAt: body.updated_at || null,
      exchangeRate: fx.rate, exchangeRateUpdatedAt: fx.date, count: items.length, items
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

function normalizeSkinName(value) {
  return String(value || "").toLowerCase()
    .replace(/★/g, "").replace(/stattrak™?/g, "").replace(/souvenir/g, "")
    .replace(/\(?(factory new|minimal wear|field-tested|well-worn|battle-scarred)\)?/g, "")
    .replace(/[()]/g, " ").replace(/[™']/g, "").replace(/\s+/g, " ")
    .replace(/\s*\|\s*/g, "|").trim();
}
function phaseFromName(value) {
  const s = String(value || "").toLowerCase();
  const m = s.match(/phase\s*([1-4])/i);
  if (m) return `phase ${m[1]}`;
  for (const phase of ["black pearl", "sapphire", "ruby", "emerald"])
    if (s.includes(phase)) return phase;
  return "";
}
async function getImageIndex() {
  if (imageIndex && Date.now() - imageIndexTime < IMAGE_INDEX_TTL) return imageIndex;
  if (imageIndexPromise) return imageIndexPromise;
  imageIndexPromise = (async () => {
    const response = await fetch(CSAPI_V2_URL, {
      headers: { Accept: "application/json", "User-Agent": "YRTORUP/1.0 skin image catalog" },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`CS2 image catalog HTTP ${response.status}`);
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("CS2 image catalog has an unexpected format");
    imageIndex = data;
    imageIndexTime = Date.now();
    return data;
  })();
  try { return await imageIndexPromise; }
  finally { imageIndexPromise = null; }
}
function findImage(data, itemName) {
  const wanted = normalizeSkinName(itemName);
  const wantedPhase = phaseFromName(itemName);
  const rows = Object.entries(data);
  for (const [fullName, row] of rows)
    if (normalizeSkinName(fullName) === wanted && row?.image) return row.image;
  if (wantedPhase) {
    for (const [, row] of rows) {
      if (!row?.image || phaseFromName(row.phase || row["full-name"] || "") !== wantedPhase) continue;
      const rowBase = normalizeSkinName(row.name || "");
      const wantedBase = wanted.replace(/\s*phase\s*[1-4]|\s*(ruby|sapphire|black pearl|emerald)/i, "").trim();
      if (rowBase && (wantedBase.includes(rowBase) || rowBase.includes(wantedBase))) return row.image;
    }
  }
  return null;
}

async function handleApi(request) {
  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return json({
      ok: true, source: "SkinCash", currency: "RUB",
      priceCache: !!priceCache, priceCount: priceCache?.count || 0,
      lastUpdated: priceCacheTime || null, exchangeRate: fxCache?.rate || null, lastError
    });
  }

  if (url.pathname === "/api/prices/RUB.json") {
    const headers = { "Cache-Control": "no-store" };
    if (priceCache && Date.now() - priceCacheTime < PRICE_TTL)
      return json(priceCache, 200, headers);
    try {
      return json(await refreshPrices(), 200, headers);
    } catch (error) {
      console.error("[YRTORUP SkinCash prices]", error.message);
      if (priceCache)
        return json({ ...priceCache, stale: true, warning: lastError }, 200, headers);
      return json({
        success: false, source: "SkinCash", error: lastError || error.message, items: []
      }, 503, headers);
    }
  }

  if (url.pathname === "/api/skin-image") {
    const name = String(url.searchParams.get("name") || "").trim();
    if (!name || name.length > 180) return new Response(null, { status: 400 });
    const key = name.toLowerCase();
    const cached = imageCache.get(key);
    if (cached && cached.expires > Date.now()) {
      if (cached.url) return Response.redirect(cached.url, 302);
      return new Response(null, { status: 404 });
    }
    try {
      const index = await getImageIndex();
      const imageUrl = findImage(index, name);
      if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
        imageCache.set(key, { url: null, expires: Date.now() + 60 * 60 * 1000 });
        return new Response(null, { status: 404 });
      }
      imageCache.set(key, { url: imageUrl, expires: Date.now() + 24 * 60 * 60 * 1000 });
      return Response.redirect(imageUrl, 302);
    } catch (error) {
      console.warn("[YRTORUP CS2 image catalog]", name, error.message);
      return new Response(null, { status: 503 });
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      const response = await handleApi(request);
      if (response) return response;
    }
    // Static assets (including index.html) are served by Cloudflare's ASSETS binding.
    return env.ASSETS.fetch(request);
  }
};
