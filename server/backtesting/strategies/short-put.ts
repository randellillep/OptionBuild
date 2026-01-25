import { BaseStrategy } from "./base";
import { StrategyContext, StrategySignal, OptionSnapshot, Position } from "../types";
import { OptionChain } from "../market";

export interface ShortPutConfig {
  minDTE: number;
  maxDTE: number;
  minPremium: number;
  minStrikeDistancePercent: number;
  maxStrikeDistancePercent: number;
  targetDelta?: number;
  maxOpenPositions: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  exitDTE: number;
}

export class ShortPutStrategy extends BaseStrategy {
  name = "Short Put";
  private config: ShortPutConfig;

  constructor(config: Partial<ShortPutConfig> = {}) {
    super();
    this.config = {
      minDTE: config.minDTE ?? 30,
      maxDTE: config.maxDTE ?? 60,
      minPremium: config.minPremium ?? 0.50,
      minStrikeDistancePercent: config.minStrikeDistancePercent ?? 5,
      maxStrikeDistancePercent: config.maxStrikeDistancePercent ?? 15,
      targetDelta: config.targetDelta,
      maxOpenPositions: config.maxOpenPositions ?? 1,
      takeProfitPercent: config.takeProfitPercent ?? 50,
      stopLossPercent: config.stopLossPercent ?? 200,
      exitDTE: config.exitDTE ?? 7,
    };
  }

  onTimestamp(context: StrategyContext): StrategySignal[] {
    const signals: StrategySignal[] = [];

    signals.push(...this.checkExits(context));
    signals.push(...this.checkEntries(context));

    return signals;
  }

  private checkExits(context: StrategyContext): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const { portfolio, optionChain } = context;

    for (const position of portfolio.openPositions) {
      if (position.option.optionType !== "put" || position.direction !== "short") {
        continue;
      }

      const currentOption = optionChain.find(
        o => o.optionSymbol === position.option.optionSymbol
      );

      if (!currentOption) {
        const daysToExpiry = Math.ceil(
          (position.option.expiration.getTime() - context.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysToExpiry <= 0) {
          const intrinsicValue = Math.max(0, position.option.strike - context.underlyingPrice);
          signals.push({
            action: "close",
            position,
            reason: `expired_${intrinsicValue > 0 ? "itm" : "otm"}`,
          });
        }
        continue;
      }

      const pnlPercent = this.getPositionPnLPercent(
        position.entryPrice,
        currentOption.getMidPrice(),
        position.direction
      );

      if (pnlPercent >= this.config.takeProfitPercent) {
        signals.push({
          action: "close",
          position,
          reason: `take_profit_${pnlPercent.toFixed(1)}%`,
        });
        continue;
      }

      if (pnlPercent <= -this.config.stopLossPercent) {
        signals.push({
          action: "close",
          position,
          reason: `stop_loss_${pnlPercent.toFixed(1)}%`,
        });
        continue;
      }

      const dte = currentOption.getDTE();
      if (dte <= this.config.exitDTE) {
        signals.push({
          action: "close",
          position,
          reason: `exit_dte_${dte}`,
        });
        continue;
      }
    }

    return signals;
  }

  private checkEntries(context: StrategyContext): StrategySignal[] {
    const signals: StrategySignal[] = [];
    const { portfolio, optionChain, underlyingPrice } = context;

    const openShortPuts = portfolio.openPositions.filter(
      p => p.option.optionType === "put" && p.direction === "short"
    ).length;

    if (openShortPuts >= this.config.maxOpenPositions) {
      return signals;
    }

    let candidates = this.selectOTMPuts(
      optionChain,
      this.config.minDTE,
      this.config.maxDTE,
      this.config.minPremium
    );

    candidates = this.selectByStrikeDistance(
      candidates,
      this.config.minStrikeDistancePercent,
      this.config.maxStrikeDistancePercent
    );

    if (this.config.targetDelta !== undefined) {
      candidates = this.selectByDelta(
        candidates,
        this.config.targetDelta - 0.05,
        this.config.targetDelta + 0.05
      );
    }

    candidates = this.sortByPremiumDesc(candidates);

    if (candidates.length > 0) {
      const selected = candidates[0];
      signals.push({
        action: "open",
        option: selected,
        direction: "short",
        quantity: 1,
        reason: `sell_put_${selected.strike}_${selected.getDTE()}dte_$${selected.getMidPrice().toFixed(2)}`,
      });
    }

    return signals;
  }
}
