# @fastwowgold/quote

Tiny, zero-dependency client for [FastWoWGold](https://fastwowgold.com)'s public price quote API,
plus helpers for WoW gold / silver / copper amounts. Works in Node 18+ and browsers.

```bash
npm install @fastwowgold/quote
```

## Get a live quote

```js
import { createClient, buyUrl } from '@fastwowgold/quote';

const client = createClient();                       // defaults to https://fastwowgold.com
const { games } = await client.getCatalog();
const game = games.find((g) => g.name === 'WoW Retail US');
const { servers } = await client.getGame(game.id, { query: 'area 52', limit: 5 });

const quote = await client.getQuote({ gameId: game.id, serverId: servers[0].id, quantity: game.minQuantity, currency: 'USD' });
console.log(quote.total, quote.currency, quote.unitPrice);   // indicative price
console.log(buyUrl(quote));                                   // checkout link, prefilled
```

Errors are thrown as `FastWoWGoldError` with a `code` (for example `NO_QUOTE` when a server has no price right now,
`INVALID_QUANTITY`, `NETWORK`) and the HTTP `status`.

`unitPrice` is `total / quantity` rounded to 8 decimals.

Quotes are **indicative**; the final price is confirmed at checkout. The API is rate limited per IP.

## Gold helpers

```js
import { parseGold, formatGold, afterAuctionCut } from '@fastwowgold/quote';

parseGold('12g 34s 56c');        // 123456 (copper; 1g = 100s = 10,000c)
formatGold(123456);              // "12g 34s 56c"
afterAuctionCut(10000, 0.05);    // 9500 - the cut differs by game version, so you pass it in
```

## See also

A free in-browser calculator built on the same API: [WoW Gold Calculator](https://fastwowgold.github.io/wow-gold-calculator/).

## Notes

Trading in-game currency may violate game publishers' Terms of Service. Use at your own risk.

Prices provided live by [FastWoWGold](https://fastwowgold.com).

MIT licensed.
