export class FastWoWGoldError extends Error {
  code: string;
  status: number;
}
export interface Game { id: number; name: string; unit: string; minQuantity: number; maxQuantity: number }
export interface Catalog {
  games: Game[];
  currencies: { code: string; symbol: string; name: string }[];
  paymentMethodsByCurrency: Record<string, { id: number; name: string }[]>;
}
export interface GameDetails extends Game {
  servers: { id: number; name: string }[];
  serversTotalMatching: number;
  deliveryMethods: { id: number; name: string; description?: string }[];
}
export interface Order { gameId: number; serverId: number; quantity: number; currency?: string }
export interface Quote {
  gameId: number; serverId: number; serverName: string; quantity: number; unit: string; currency: string;
  total: number;
  /** total / quantity, rounded to 8 decimals. */
  unitPrice: number;
  indicative: true;
}
export interface Client {
  getCatalog(): Promise<Catalog>;
  getGame(gameId: number, options?: { query?: string; limit?: number }): Promise<GameDetails>;
  getQuote(order: Order): Promise<Quote>;
}
export function createClient(options?: { baseUrl?: string; fetch?: typeof fetch }): Client;
export function buyUrl(order: Pick<Order, 'gameId' | 'serverId' | 'quantity'>, options?: { source?: string; baseUrl?: string }): string;
export function parseGold(text: string): number;
export function formatGold(copper: number): string;
export function afterAuctionCut(copper: number, cutRate: number): number;
