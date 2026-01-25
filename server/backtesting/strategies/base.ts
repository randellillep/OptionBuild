import { Strategy, StrategyContext, StrategySignal, OptionSnapshot } from "../types";

export abstract class BaseStrategy implements Strategy {
  abstract name: string;
  abstract onTimestamp(context: StrategyContext): StrategySignal[];

  protected selectOTMPuts(
    chain: OptionSnapshot[],
    minDTE: number,
    maxDTE: number,
    minPremium: number = 0
  ): OptionSnapshot[] {
    return chain.filter(option => 
      option.optionType === "put" &&
      option.isOTM() &&
      option.getDTE() >= minDTE &&
      option.getDTE() <= maxDTE &&
      option.getMidPrice() >= minPremium &&
      option.hasValidQuote()
    );
  }

  protected selectOTMCalls(
    chain: OptionSnapshot[],
    minDTE: number,
    maxDTE: number,
    minPremium: number = 0
  ): OptionSnapshot[] {
    return chain.filter(option => 
      option.optionType === "call" &&
      option.isOTM() &&
      option.getDTE() >= minDTE &&
      option.getDTE() <= maxDTE &&
      option.getMidPrice() >= minPremium &&
      option.hasValidQuote()
    );
  }

  protected selectByStrikeDistance(
    options: OptionSnapshot[],
    minDistancePercent: number,
    maxDistancePercent: number
  ): OptionSnapshot[] {
    return options.filter(option => {
      const distance = option.getStrikeDistancePercent();
      return distance >= minDistancePercent && distance <= maxDistancePercent;
    });
  }

  protected selectByDelta(
    options: OptionSnapshot[],
    minDelta: number,
    maxDelta: number
  ): OptionSnapshot[] {
    return options.filter(option => {
      if (option.delta === undefined) return false;
      const absDelta = Math.abs(option.delta);
      return absDelta >= minDelta && absDelta <= maxDelta;
    });
  }

  protected sortByPremiumDesc(options: OptionSnapshot[]): OptionSnapshot[] {
    return [...options].sort((a, b) => b.getMidPrice() - a.getMidPrice());
  }

  protected sortByPremiumAsc(options: OptionSnapshot[]): OptionSnapshot[] {
    return [...options].sort((a, b) => a.getMidPrice() - b.getMidPrice());
  }

  protected sortByStrikeDistanceAsc(options: OptionSnapshot[]): OptionSnapshot[] {
    return [...options].sort((a, b) => a.getStrikeDistance() - b.getStrikeDistance());
  }

  protected getPositionPnLPercent(
    entryPrice: number,
    currentPrice: number,
    direction: "long" | "short"
  ): number {
    if (entryPrice === 0) return 0;
    
    if (direction === "long") {
      return ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - currentPrice) / entryPrice) * 100;
    }
  }
}
