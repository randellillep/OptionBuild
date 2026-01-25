export type OptionType = "call" | "put";

export interface OptionSnapshot {
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
  
  getMidPrice(): number;
  isOTM(): boolean;
  getDTE(): number;
  getStrikeDistance(): number;
  getStrikeDistancePercent(): number;
  hasValidQuote(): boolean;
}

export interface Position {
  id: string;
  option: OptionSnapshot;
  entryPrice: number;
  entryTimestamp: Date;
  quantity: number;
  direction: "long" | "short";
  isOpen: boolean;
  exitPrice?: number;
  exitTimestamp?: Date;
  pnl?: number;
}

export interface Trade {
  positionId: string;
  optionSymbol: string;
  optionType: OptionType;
  strike: number;
  expiration: Date;
  direction: "long" | "short";
  quantity: number;
  entryPrice: number;
  entryTimestamp: Date;
  exitPrice: number;
  exitTimestamp: Date;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
}

export interface PortfolioState {
  cash: number;
  openPositions: Position[];
  closedTrades: Trade[];
  initialCash: number;
}

export interface StrategySignal {
  action: "open" | "close";
  option?: OptionSnapshot;
  position?: Position;
  direction?: "long" | "short";
  quantity?: number;
  reason: string;
}

export interface StrategyContext {
  timestamp: Date;
  optionChain: OptionSnapshot[];
  portfolio: PortfolioState;
  underlyingPrice: number;
}

export interface Strategy {
  name: string;
  onTimestamp(context: StrategyContext): StrategySignal[];
}

export interface BacktestConfig {
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCash: number;
  strategy: Strategy;
}

export interface BacktestResult {
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCash: number;
  finalCash: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  trades: Trade[];
  equityCurve: { timestamp: Date; equity: number }[];
}

export interface OptionDataRow {
  timestamp: string;
  optionSymbol: string;
  optionType: string;
  strike: number;
  expiration: string;
  bid: number;
  ask: number;
  underlyingPrice: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
}
