import { OptionSnapshot, OptionType } from "./types";

export class OptionSnapshotImpl implements OptionSnapshot {
  timestamp: Date;
  optionSymbol: string;
  optionType: OptionType;
  strike: number;
  expiration: Date;
  bid: number;
  ask: number;
  underlyingPrice: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;

  constructor(data: {
    timestamp: Date;
    optionSymbol: string;
    optionType: OptionType;
    strike: number;
    expiration: Date;
    bid: number;
    ask: number;
    underlyingPrice: number;
    impliedVolatility?: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    rho?: number;
  }) {
    this.timestamp = data.timestamp;
    this.optionSymbol = data.optionSymbol;
    this.optionType = data.optionType;
    this.strike = data.strike;
    this.expiration = data.expiration;
    this.bid = data.bid;
    this.ask = data.ask;
    this.underlyingPrice = data.underlyingPrice;
    this.impliedVolatility = data.impliedVolatility;
    this.delta = data.delta;
    this.gamma = data.gamma;
    this.theta = data.theta;
    this.vega = data.vega;
    this.rho = data.rho;
  }

  getMidPrice(): number {
    return (this.bid + this.ask) / 2;
  }

  isOTM(): boolean {
    if (this.optionType === "put") {
      return this.strike < this.underlyingPrice;
    } else {
      return this.strike > this.underlyingPrice;
    }
  }

  isITM(): boolean {
    return !this.isOTM();
  }

  isATM(tolerance: number = 0.02): boolean {
    const percentDiff = Math.abs(this.strike - this.underlyingPrice) / this.underlyingPrice;
    return percentDiff <= tolerance;
  }

  getDTE(): number {
    const diffMs = this.expiration.getTime() - this.timestamp.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  getStrikeDistance(): number {
    return Math.abs(this.strike - this.underlyingPrice);
  }

  getStrikeDistancePercent(): number {
    return (this.getStrikeDistance() / this.underlyingPrice) * 100;
  }

  getMoneyness(): number {
    if (this.optionType === "call") {
      return this.underlyingPrice / this.strike;
    } else {
      return this.strike / this.underlyingPrice;
    }
  }

  getSpread(): number {
    return this.ask - this.bid;
  }

  getSpreadPercent(): number {
    const mid = this.getMidPrice();
    if (mid === 0) return 0;
    return (this.getSpread() / mid) * 100;
  }

  hasValidQuote(): boolean {
    return this.bid > 0 && this.ask > 0 && this.ask >= this.bid;
  }

  hasGreeks(): boolean {
    return this.delta !== undefined && 
           this.gamma !== undefined && 
           this.theta !== undefined && 
           this.vega !== undefined;
  }

  hasIV(): boolean {
    return this.impliedVolatility !== undefined && this.impliedVolatility > 0;
  }
}

export class OptionChain {
  private snapshots: OptionSnapshot[] = [];
  private timestamp: Date;
  private underlyingPrice: number;

  constructor(timestamp: Date, underlyingPrice: number) {
    this.timestamp = timestamp;
    this.underlyingPrice = underlyingPrice;
  }

  addSnapshot(snapshot: OptionSnapshot): void {
    this.snapshots.push(snapshot);
  }

  getAll(): OptionSnapshot[] {
    return [...this.snapshots];
  }

  getCalls(): OptionSnapshot[] {
    return this.snapshots.filter(s => s.optionType === "call");
  }

  getPuts(): OptionSnapshot[] {
    return this.snapshots.filter(s => s.optionType === "put");
  }

  getByExpiration(expiration: Date): OptionSnapshot[] {
    return this.snapshots.filter(s => 
      s.expiration.toDateString() === expiration.toDateString()
    );
  }

  getByDTE(minDTE: number, maxDTE: number): OptionSnapshot[] {
    return this.snapshots.filter(s => {
      const dte = s.getDTE();
      return dte >= minDTE && dte <= maxDTE;
    });
  }

  getOTM(): OptionSnapshot[] {
    return this.snapshots.filter(s => s.isOTM());
  }

  getITM(): OptionSnapshot[] {
    return this.snapshots.filter(s => !s.isOTM());
  }

  getByStrikeRange(minStrike: number, maxStrike: number): OptionSnapshot[] {
    return this.snapshots.filter(s => s.strike >= minStrike && s.strike <= maxStrike);
  }

  getByMinPremium(minPremium: number): OptionSnapshot[] {
    return this.snapshots.filter(s => s.getMidPrice() >= minPremium);
  }

  findBySymbol(optionSymbol: string): OptionSnapshot | undefined {
    return this.snapshots.find(s => s.optionSymbol === optionSymbol);
  }

  findClosestStrike(strike: number, optionType: OptionType): OptionSnapshot | undefined {
    const options = this.snapshots.filter(s => s.optionType === optionType);
    if (options.length === 0) return undefined;
    
    return options.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.strike - strike);
      const currentDiff = Math.abs(current.strike - strike);
      return currentDiff < closestDiff ? current : closest;
    });
  }

  findByDelta(targetDelta: number, optionType: OptionType): OptionSnapshot | undefined {
    const options = this.snapshots.filter(s => 
      s.optionType === optionType && s.delta !== undefined
    );
    if (options.length === 0) return undefined;

    return options.reduce((closest, current) => {
      const closestDiff = Math.abs((closest.delta || 0) - targetDelta);
      const currentDiff = Math.abs((current.delta || 0) - targetDelta);
      return currentDiff < closestDiff ? current : closest;
    });
  }

  getExpirations(): Date[] {
    const expirations = new Set<string>();
    this.snapshots.forEach(s => expirations.add(s.expiration.toISOString()));
    return Array.from(expirations).map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  }

  getStrikes(): number[] {
    const strikes = new Set<number>();
    this.snapshots.forEach(s => strikes.add(s.strike));
    return Array.from(strikes).sort((a, b) => a - b);
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getUnderlyingPrice(): number {
    return this.underlyingPrice;
  }

  size(): number {
    return this.snapshots.length;
  }
}
