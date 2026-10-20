import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, buyUrl, parseGold, formatGold, afterAuctionCut, FastWoWGoldError } from '../src/index.js';

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('getQuote returns only total and unit price, never the breakdown', async () => {
  let seen;
  const client = createClient({ fetch: async (url, init) => { seen = { url, init };
    return json(200, { gameId: 10, serverId: 35, serverName: 'Area 52', quantity: 500000, unit: 'Gold', currency: 'USD',
      total: 25, breakdown: { cost: 20, serviceFee: 3, paymentFee: 2 } }); } });
  const q = await client.getQuote({ gameId: 10, serverId: 35, quantity: 500000 });
  assert.equal(seen.url, 'https://fastwowgold.com/api/v1/quote');
  assert.deepEqual(JSON.parse(seen.init.body), { gameId: 10, serverId: 35, quantity: 500000, currency: 'USD' });
  assert.equal(q.total, 25);
  assert.equal(q.unitPrice, 0.00005);
  assert.ok(!('breakdown' in q));
});

test('unitPrice is rounded to 8 decimals without floating-point noise', async () => {
  const client = createClient({ fetch: async () => json(200, { gameId: 10, serverId: 35, serverName: 'A', quantity: 300000,
    unit: 'Gold', currency: 'USD', total: 15.21 }) });
  assert.equal((await client.getQuote({ gameId: 10, serverId: 35, quantity: 300000 })).unitPrice, 0.0000507);
});

test('API errors become FastWoWGoldError with the server error code', async () => {
  const client = createClient({ fetch: async () => json(409, { error: { code: 'NO_QUOTE', message: 'No price' } }) });
  await assert.rejects(client.getQuote({ gameId: 1, serverId: 1, quantity: 1 }),
    (e) => e instanceof FastWoWGoldError && e.code === 'NO_QUOTE' && e.status === 409);
});

test('getGame builds the query string', async () => {
  let url;
  const client = createClient({ baseUrl: 'http://localhost:5213/', fetch: async (u) => { url = u; return json(200, {}); } });
  await client.getGame(10, { query: 'area 52', limit: 5 });
  assert.equal(url, 'http://localhost:5213/api/v1/games/10?q=area+52&limit=5');
});

test('buyUrl prefills the order and tags the source', () => {
  const u = new URL(buyUrl({ gameId: 10, serverId: 35, quantity: 500000 }));
  assert.equal(u.origin, 'https://fastwowgold.com');
  assert.equal(u.searchParams.get('GameId'), '10');
  assert.equal(u.searchParams.get('utm_source'), 'fastwowgold-quote');
});

test('parseGold / formatGold round trip', () => {
  assert.equal(parseGold('12g 34s 56c'), 123456);
  assert.equal(parseGold('1,234g'), 12340000);
  assert.equal(parseGold('5s'), 500);
  assert.equal(formatGold(123456), '12g 34s 56c');
  assert.equal(formatGold(12340000), '1,234g');
  assert.equal(formatGold(0), '0c');
  assert.throws(() => parseGold('nothing'), { code: 'PARSE' });
});

test('afterAuctionCut requires a valid rate', () => {
  assert.equal(afterAuctionCut(10000, 0.05), 9500);
  assert.throws(() => afterAuctionCut(100, 1), { code: 'BAD_ARGUMENT' });
});
