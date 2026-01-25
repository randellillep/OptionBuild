import { 
  Strategy, 
  StrategyContext, 
  BacktestResult, 
  Trade,
  OptionSnapshot 
} from "./types";
import { Portfolio } from "./portfolio";
import { OptionChain, OptionSnapshotImpl } from "./market";

export interface BacktesterConfig {
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCash: number;
  strategy: Strategy;
}

export interface BacktestLog {
  timestamp: Date;
  type: "entry" | "exit" | "info";
  message: string;
  details?: Record<string, any>;
}

export class Backtester {
  private config: BacktesterConfig;
  private portfolio: Portfolio;
  private logs: BacktestLog[] = [];
  private equityCurve: { timestamp: Date; equity: number }[] = [];
  private currentTimestamp: Date | null = null;
  private onProgress?: (progress: number, message: string) => void;

  constructor(config: BacktesterConfig) {
    this.config = config;
    this.portfolio = new Portfolio(config.initialCash);
  }

  setProgressCallback(callback: (progress: number, message: string) => void): void {
    this.onProgress = callback;
  }

  private log(type: "entry" | "exit" | "info", message: string, details?: Record<string, any>): void {
    this.logs.push({
      timestamp: this.currentTimestamp || new Date(),
      type,
      message,
      details,
    });
    console.log(`[Backtest ${type.toUpperCase()}] ${message}`);
  }

  async runWithData(
    optionChainsByDate: Map<string, OptionChain>,
    stockPricesByDate: Map<string, number>
  ): Promise<BacktestResult> {
    const timestamps = this.getTimestampsInRange(optionChainsByDate);
    
    if (timestamps.length === 0) {
      throw new Error("No data available for the specified date range");
    }

    this.log("info", `Starting backtest for ${this.config.symbol}`);
    this.log("info", `Date range: ${timestamps[0].toDateString()} to ${timestamps[timestamps.length - 1].toDateString()}`);
    this.log("info", `Initial cash: $${this.config.initialCash.toLocaleString()}`);

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      this.currentTimestamp = timestamp;
      const dateKey = timestamp.toDateString();

      const optionChain = optionChainsByDate.get(dateKey);
      const underlyingPrice = stockPricesByDate.get(dateKey);

      if (!optionChain || !underlyingPrice) {
        continue;
      }

      const context: StrategyContext = {
        timestamp,
        optionChain: optionChain.getAll(),
        portfolio: this.portfolio.getState(),
        underlyingPrice,
      };

      const signals = this.config.strategy.onTimestamp(context);

      for (const signal of signals) {
        if (signal.action === "close" && signal.position) {
          const currentOption = optionChain.findBySymbol(signal.position.option.optionSymbol);
          
          if (currentOption) {
            const trade = this.portfolio.closePosition(
              signal.position.id,
              currentOption,
              signal.reason
            );

            if (trade) {
              this.log("exit", 
                `Closed ${trade.direction} ${trade.optionType} ${trade.strike} @ $${trade.exitPrice.toFixed(2)} | PnL: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(1)}%) | Reason: ${trade.exitReason}`,
                { trade }
              );
            }
          } else {
            const intrinsicValue = this.calculateIntrinsicValue(
              signal.position.option.optionType,
              signal.position.option.strike,
              underlyingPrice
            );
            
            const trade = this.portfolio.closePositionAtExpiration(
              signal.position.id,
              intrinsicValue,
              timestamp
            );

            if (trade) {
              this.log("exit",
                `Expired ${trade.direction} ${trade.optionType} ${trade.strike} @ $${trade.exitPrice.toFixed(2)} | PnL: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(1)}%)`,
                { trade }
              );
            }
          }
        }

        if (signal.action === "open" && signal.option) {
          const position = this.portfolio.openPosition(
            signal.option,
            signal.direction || "long",
            signal.quantity || 1
          );

          if (position) {
            this.log("entry",
              `Opened ${position.direction} ${position.option.optionType} ${position.option.strike} @ $${position.entryPrice.toFixed(2)} | ${position.option.getDTE()} DTE | Reason: ${signal.reason}`,
              { position }
            );
          }
        }
      }

      const currentPrices = this.getCurrentPrices(optionChain);
      const equity = this.portfolio.getTotalEquity(currentPrices);
      this.equityCurve.push({ timestamp, equity });

      if (this.onProgress) {
        const progress = Math.round((i / timestamps.length) * 100);
        this.onProgress(progress, `Processing ${timestamp.toDateString()}`);
      }
    }

    this.closeRemainingPositions(stockPricesByDate);

    return this.generateResult();
  }

  private getTimestampsInRange(optionChainsByDate: Map<string, OptionChain>): Date[] {
    const timestamps: Date[] = [];
    
    for (const dateKey of Array.from(optionChainsByDate.keys())) {
      const date = new Date(dateKey);
      if (date >= this.config.startDate && date <= this.config.endDate) {
        timestamps.push(date);
      }
    }

    return timestamps.sort((a, b) => a.getTime() - b.getTime());
  }

  private calculateIntrinsicValue(
    optionType: "call" | "put",
    strike: number,
    underlyingPrice: number
  ): number {
    if (optionType === "call") {
      return Math.max(0, underlyingPrice - strike);
    } else {
      return Math.max(0, strike - underlyingPrice);
    }
  }

  private getCurrentPrices(optionChain: OptionChain): Map<string, number> {
    const prices = new Map<string, number>();
    
    for (const option of optionChain.getAll()) {
      prices.set(option.optionSymbol, option.getMidPrice());
    }

    return prices;
  }

  private closeRemainingPositions(stockPricesByDate: Map<string, number>): void {
    const openPositions = this.portfolio.getOpenPositions();
    
    if (openPositions.length === 0) return;

    this.log("info", `Closing ${openPositions.length} remaining positions at end of backtest`);

    const lastDate = Array.from(stockPricesByDate.keys()).pop();
    const lastPrice = lastDate ? stockPricesByDate.get(lastDate) : undefined;

    for (const position of openPositions) {
      const underlyingPrice = lastPrice || position.option.underlyingPrice;
      const intrinsicValue = this.calculateIntrinsicValue(
        position.option.optionType,
        position.option.strike,
        underlyingPrice
      );

      const trade = this.portfolio.closePositionAtExpiration(
        position.id,
        intrinsicValue,
        this.currentTimestamp || new Date()
      );

      if (trade) {
        this.log("exit",
          `Force closed ${trade.direction} ${trade.optionType} ${trade.strike} @ $${trade.exitPrice.toFixed(2)} | PnL: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(1)}%) | Reason: end_of_backtest`,
          { trade }
        );
      }
    }
  }

  private generateResult(): BacktestResult {
    const trades = this.portfolio.getClosedTrades();
    const finalCash = this.portfolio.getCash();
    const totalPnL = finalCash - this.config.initialCash;
    const totalPnLPercent = (totalPnL / this.config.initialCash) * 100;

    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl <= 0).length;
    const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

    const maxDrawdown = this.calculateMaxDrawdown();

    this.log("info", `Backtest completed`);
    this.log("info", `Final cash: $${finalCash.toLocaleString()}`);
    this.log("info", `Total P&L: $${totalPnL.toFixed(2)} (${totalPnLPercent.toFixed(2)}%)`);
    this.log("info", `Total trades: ${trades.length} | Win rate: ${winRate.toFixed(1)}%`);
    this.log("info", `Max drawdown: ${maxDrawdown.toFixed(2)}%`);

    return {
      symbol: this.config.symbol,
      startDate: this.config.startDate,
      endDate: this.config.endDate,
      initialCash: this.config.initialCash,
      finalCash,
      totalPnL,
      totalPnLPercent,
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate,
      maxDrawdown,
      trades,
      equityCurve: this.equityCurve,
    };
  }

  private calculateMaxDrawdown(): number {
    if (this.equityCurve.length === 0) return 0;

    let peak = this.equityCurve[0].equity;
    let maxDrawdown = 0;

    for (const point of this.equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      const drawdown = ((peak - point.equity) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  getLogs(): BacktestLog[] {
    return [...this.logs];
  }
}
