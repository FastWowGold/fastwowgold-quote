// @fastwowgold/quote: client for FastWoWGold's public, read-only price quote API, plus gold helpers.
// Zero dependencies; needs a global fetch (Node 18+, browsers, Deno, Bun).

const DEFAULT_BASE_URL = 'https://fastwowgold.com';
// Per-unit prices are tiny (e.g. 0.0000507 per gold), so keep 8 decimals and drop floating-point noise.
const UNIT_PRICE_DECIMALS = 8;
const roundTo = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

export class FastWoWGoldError extends Error {
  constructor(message, { code = 'ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'FastWoWGoldError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Create an API client.
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 */
export function createClient(options = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new FastWoWGoldError('No fetch implementation available; pass options.fetch.', { code: 'NO_FETCH' });
  }

  async function request(path, init) {
    let response;
    try {
      response = await doFetch(baseUrl + path, init);
    } catch (e) {
      throw new FastWoWGoldError('Network error: ' + (e?.message ?? e), { code: 'NETWORK' });
    }
    let body = null;
    try { body = await response.json(); } catch { /* non-JSON error page */ }
    if (!response.ok) {
      const err = body?.error;
      throw new FastWoWGoldError(err?.message ?? `HTTP ${response.status}`, { code: err?.code ?? 'HTTP_' + response.status, status: response.status });
    }
    return body;
  }

  return {
    /** Games, currencies and payment methods. */
    getCatalog: () => request('/api/v1/catalog'),

    /** Servers (optionally filtered by name) and delivery methods for one game. */
    getGame(gameId, { query, limit } = {}) {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return request(`/api/v1/games/${encodeURIComponent(gameId)}${qs ? '?' + qs : ''}`);
    },

    /**
     * Price an order (nothing is created). Returns only the total and the per-unit price.
     * @param {{ gameId: number, serverId: number, quantity: number, currency?: string }} order
     */
    async getQuote({ gameId, serverId, quantity, currency = 'USD' }) {
      const q = await request('/api/v1/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, serverId, quantity, currency }),
      });
      return {
        gameId: q.gameId,
        serverId: q.serverId,
        serverName: q.serverName,
        quantity: q.quantity,
        unit: q.unit,
        currency: q.currency,
        total: q.total,
        unitPrice: q.quantity > 0 ? roundTo(q.total / q.quantity, UNIT_PRICE_DECIMALS) : 0,
        indicative: true, // final price is confirmed at checkout
      };
    },
  };
}

/** Checkout link on fastwowgold.com prefilled with the order. */
export function buyUrl({ gameId, serverId, quantity }, { source = 'npm', baseUrl = DEFAULT_BASE_URL } = {}) {
  const params = new URLSearchParams({
    GameId: String(gameId), ServerId: String(serverId), Quantity: String(quantity),
    utm_source: 'fastwowgold-quote', utm_medium: source, utm_campaign: 'gold-quote',
  });
  return baseUrl.replace(/\/+$/, '') + '/?' + params.toString();
}

// ---- gold / silver / copper helpers (1 gold = 100 silver = 10,000 copper) ----

/** Parse "12g 34s 56c" (any subset, any order, thousands separators allowed) into copper. */
export function parseGold(text) {
  const re = /(\d[\d,]*)\s*([gsc])/gi;
  const mult = { g: 10000, s: 100, c: 1 };
  let total = 0, matched = false, m;
  while ((m = re.exec(String(text))) !== null) {
    total += Number(m[1].replace(/,/g, '')) * mult[m[2].toLowerCase()];
    matched = true;
  }
  if (!matched) throw new FastWoWGoldError(`Cannot parse gold amount: "${text}"`, { code: 'PARSE' });
  return total;
}

/** Format copper as "12g 34s 56c", omitting zero parts after the first ("0c" for zero). */
export function formatGold(copper) {
  const total = Math.max(0, Math.round(copper));
  const g = Math.floor(total / 10000), s = Math.floor((total % 10000) / 100), c = total % 100;
  const parts = [];
  if (g) parts.push(`${g.toLocaleString('en-US')}g`);
  if (s) parts.push(`${s}s`);
  if (c || parts.length === 0) parts.push(`${c}c`);
  return parts.join(' ');
}

/**
 * What you receive after the auction house cut. The cut differs between game versions, so it is required.
 * @param {number} copper sale price in copper
 * @param {number} cutRate e.g. 0.05 for 5%
 */
export function afterAuctionCut(copper, cutRate) {
  if (!(cutRate >= 0 && cutRate < 1)) throw new FastWoWGoldError('cutRate must be in [0, 1)', { code: 'BAD_ARGUMENT' });
  return Math.floor(copper * (1 - cutRate));
}
