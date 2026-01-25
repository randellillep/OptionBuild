import { OptionDataRow, OptionType } from "./types";
import { OptionSnapshotImpl, OptionChain } from "./market";

export interface AlpacaOptionBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  vw: number;
}

export interface AlpacaOptionQuote {
  t: string;
  ax: string;
  ap: number;
  as: number;
  bx: string;
  bp: number;
  bs: number;
  c: string;
}

export interface AlpacaStockBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  vw: number;
}

export function parseOptionSymbol(symbol: string): {
  underlying: string;
  expiration: Date;
  optionType: OptionType;
  strike: number;
} | null {
  const match = symbol.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/);
  if (!match) return null;

  const [, underlying, dateStr, typeChar, strikeStr] = match;
  
  const year = 2000 + parseInt(dateStr.substring(0, 2));
  const month = parseInt(dateStr.substring(2, 4)) - 1;
  const day = parseInt(dateStr.substring(4, 6));
  const expiration = new Date(year, month, day);
  
  const optionType: OptionType = typeChar === "C" ? "call" : "put";
  const strike = parseInt(strikeStr) / 1000;

  return { underlying, expiration, optionType, strike };
}

export function buildOptionSymbol(
  underlying: string,
  expiration: Date,
  optionType: OptionType,
  strike: number
): string {
  const year = (expiration.getFullYear() % 100).toString().padStart(2, "0");
  const month = (expiration.getMonth() + 1).toString().padStart(2, "0");
  const day = expiration.getDate().toString().padStart(2, "0");
  const typeChar = optionType === "call" ? "C" : "P";
  const strikeStr = Math.round(strike * 1000).toString().padStart(8, "0");
  
  return `${underlying}${year}${month}${day}${typeChar}${strikeStr}`;
}

export class CSVDataLoader {
  static parseCSV(csvContent: string): OptionDataRow[] {
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows: OptionDataRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      if (values.length < headers.length) continue;

      const row: Record<string, any> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      rows.push({
        timestamp: row.timestamp || row.date,
        optionSymbol: row.optionsymbol || row.symbol || row.option_symbol,
        optionType: (row.optiontype || row.type || row.option_type || "").toLowerCase(),
        strike: parseFloat(row.strike || "0"),
        expiration: row.expiration || row.exp || row.expiry,
        bid: parseFloat(row.bid || "0"),
        ask: parseFloat(row.ask || "0"),
        underlyingPrice: parseFloat(row.underlyingprice || row.underlying || row.stock_price || "0"),
        impliedVolatility: row.iv ? parseFloat(row.iv) : undefined,
        delta: row.delta ? parseFloat(row.delta) : undefined,
        gamma: row.gamma ? parseFloat(row.gamma) : undefined,
        theta: row.theta ? parseFloat(row.theta) : undefined,
        vega: row.vega ? parseFloat(row.vega) : undefined,
      });
    }

    return rows;
  }

  static buildOptionChains(rows: OptionDataRow[]): Map<string, OptionChain> {
    const chainsByDate = new Map<string, OptionChain>();

    for (const row of rows) {
      const timestamp = new Date(row.timestamp);
      const dateKey = timestamp.toDateString();

      if (!chainsByDate.has(dateKey)) {
        chainsByDate.set(dateKey, new OptionChain(timestamp, row.underlyingPrice));
      }

      const chain = chainsByDate.get(dateKey)!;
      
      const snapshot = new OptionSnapshotImpl({
        timestamp,
        optionSymbol: row.optionSymbol,
        optionType: row.optionType as OptionType,
        strike: row.strike,
        expiration: new Date(row.expiration),
        bid: row.bid,
        ask: row.ask,
        underlyingPrice: row.underlyingPrice,
        impliedVolatility: row.impliedVolatility,
        delta: row.delta,
        gamma: row.gamma,
        theta: row.theta,
        vega: row.vega,
      });

      chain.addSnapshot(snapshot);
    }

    return chainsByDate;
  }

  static getTimestamps(rows: OptionDataRow[]): Date[] {
    const timestamps = new Set<string>();
    rows.forEach(row => timestamps.add(new Date(row.timestamp).toDateString()));
    return Array.from(timestamps)
      .map(d => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());
  }
}

export class AlpacaDataLoader {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(apiKey: string, apiSecret: string, isPaper: boolean = true) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = "https://data.alpaca.markets";
  }

  private async fetchWithAuth(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": this.apiKey,
        "APCA-API-SECRET-KEY": this.apiSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getStockBars(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string = "1Day"
  ): Promise<Map<string, number>> {
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    
    const url = `${this.baseUrl}/v2/stocks/${symbol}/bars?start=${start}&end=${end}&timeframe=${timeframe}&adjustment=split`;
    
    const data = await this.fetchWithAuth(url);
    const pricesByDate = new Map<string, number>();

    if (data.bars) {
      for (const bar of data.bars) {
        const date = new Date(bar.t).toDateString();
        pricesByDate.set(date, bar.c);
      }
    }

    return pricesByDate;
  }

  async getOptionChain(
    underlying: string,
    expiration: Date
  ): Promise<OptionChain | null> {
    const expirationStr = expiration.toISOString().split("T")[0];
    const url = `${this.baseUrl}/v1beta1/options/snapshots/${underlying}?expiration_date=${expirationStr}`;

    try {
      const data = await this.fetchWithAuth(url);
      
      if (!data.snapshots) return null;

      const chain = new OptionChain(new Date(), 0);

      for (const [symbol, snapshot] of Object.entries(data.snapshots as Record<string, any>)) {
        const parsed = parseOptionSymbol(symbol);
        if (!parsed) continue;

        const quote = snapshot.latestQuote;
        const greeks = snapshot.greeks;

        if (!quote) continue;

        const optionSnapshot = new OptionSnapshotImpl({
          timestamp: new Date(quote.t),
          optionSymbol: symbol,
          optionType: parsed.optionType,
          strike: parsed.strike,
          expiration: parsed.expiration,
          bid: quote.bp || 0,
          ask: quote.ap || 0,
          underlyingPrice: snapshot.underlyingPrice || 0,
          impliedVolatility: snapshot.impliedVolatility,
          delta: greeks?.delta,
          gamma: greeks?.gamma,
          theta: greeks?.theta,
          vega: greeks?.vega,
          rho: greeks?.rho,
        });

        chain.addSnapshot(optionSnapshot);
      }

      return chain;
    } catch (error) {
      console.error(`[AlpacaDataLoader] Error fetching option chain: ${error}`);
      return null;
    }
  }

  async getHistoricalOptionBars(
    optionSymbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string = "1Day"
  ): Promise<AlpacaOptionBar[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    
    const url = `${this.baseUrl}/v1beta1/options/bars?symbols=${optionSymbol}&start=${start}&end=${end}&timeframe=${timeframe}`;
    
    try {
      const data = await this.fetchWithAuth(url);
      return data.bars?.[optionSymbol] || [];
    } catch (error) {
      console.error(`[AlpacaDataLoader] Error fetching option bars: ${error}`);
      return [];
    }
  }

  async getAvailableExpirations(underlying: string): Promise<Date[]> {
    const url = `${this.baseUrl}/v1beta1/options/snapshots/${underlying}`;
    
    try {
      const data = await this.fetchWithAuth(url);
      
      if (!data.snapshots) return [];

      const expirations = new Set<string>();
      for (const symbol of Object.keys(data.snapshots)) {
        const parsed = parseOptionSymbol(symbol);
        if (parsed) {
          expirations.add(parsed.expiration.toISOString().split("T")[0]);
        }
      }

      return Array.from(expirations)
        .map(d => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());
    } catch (error) {
      console.error(`[AlpacaDataLoader] Error fetching expirations: ${error}`);
      return [];
    }
  }
}
