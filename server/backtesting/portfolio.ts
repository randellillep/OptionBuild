import { nanoid } from "nanoid";
import { OptionSnapshot, Position, Trade, PortfolioState } from "./types";

export class Portfolio {
  private cash: number;
  private initialCash: number;
  private openPositions: Map<string, Position> = new Map();
  private closedTrades: Trade[] = [];

  constructor(initialCash: number) {
    this.cash = initialCash;
    this.initialCash = initialCash;
  }

  getState(): PortfolioState {
    return {
      cash: this.cash,
      openPositions: Array.from(this.openPositions.values()),
      closedTrades: [...this.closedTrades],
      initialCash: this.initialCash,
    };
  }

  getCash(): number {
    return this.cash;
  }

  getOpenPositions(): Position[] {
    return Array.from(this.openPositions.values());
  }

  getClosedTrades(): Trade[] {
    return [...this.closedTrades];
  }

  getOpenPositionCount(): number {
    return this.openPositions.size;
  }

  openPosition(
    option: OptionSnapshot,
    direction: "long" | "short",
    quantity: number = 1
  ): Position | null {
    const entryPrice = option.getMidPrice();
    const contractMultiplier = 100;
    const totalCost = entryPrice * contractMultiplier * quantity;

    if (direction === "long" && this.cash < totalCost) {
      console.log(`[Portfolio] Insufficient cash to open long position. Need: $${totalCost}, Have: $${this.cash}`);
      return null;
    }

    const position: Position = {
      id: nanoid(),
      option: option,
      entryPrice: entryPrice,
      entryTimestamp: option.timestamp,
      quantity: quantity,
      direction: direction,
      isOpen: true,
    };

    if (direction === "long") {
      this.cash -= totalCost;
    } else {
      this.cash += totalCost;
    }

    this.openPositions.set(position.id, position);
    return position;
  }

  closePosition(
    positionId: string,
    currentOption: OptionSnapshot,
    exitReason: string
  ): Trade | null {
    const position = this.openPositions.get(positionId);
    if (!position) {
      console.log(`[Portfolio] Position ${positionId} not found`);
      return null;
    }

    const exitPrice = currentOption.getMidPrice();
    const contractMultiplier = 100;
    
    let pnl: number;
    if (position.direction === "long") {
      pnl = (exitPrice - position.entryPrice) * contractMultiplier * position.quantity;
      this.cash += exitPrice * contractMultiplier * position.quantity;
    } else {
      pnl = (position.entryPrice - exitPrice) * contractMultiplier * position.quantity;
      this.cash -= exitPrice * contractMultiplier * position.quantity;
    }

    const pnlPercent = (pnl / (position.entryPrice * contractMultiplier * position.quantity)) * 100;

    const trade: Trade = {
      positionId: position.id,
      optionSymbol: position.option.optionSymbol,
      optionType: position.option.optionType,
      strike: position.option.strike,
      expiration: position.option.expiration,
      direction: position.direction,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      entryTimestamp: position.entryTimestamp,
      exitPrice: exitPrice,
      exitTimestamp: currentOption.timestamp,
      pnl: pnl,
      pnlPercent: pnlPercent,
      exitReason: exitReason,
    };

    position.isOpen = false;
    position.exitPrice = exitPrice;
    position.exitTimestamp = currentOption.timestamp;
    position.pnl = pnl;

    this.openPositions.delete(positionId);
    this.closedTrades.push(trade);

    return trade;
  }

  closePositionAtExpiration(
    positionId: string,
    expirationValue: number,
    timestamp: Date
  ): Trade | null {
    const position = this.openPositions.get(positionId);
    if (!position) {
      console.log(`[Portfolio] Position ${positionId} not found`);
      return null;
    }

    const contractMultiplier = 100;
    
    let pnl: number;
    if (position.direction === "long") {
      pnl = (expirationValue - position.entryPrice) * contractMultiplier * position.quantity;
      this.cash += expirationValue * contractMultiplier * position.quantity;
    } else {
      pnl = (position.entryPrice - expirationValue) * contractMultiplier * position.quantity;
      this.cash -= expirationValue * contractMultiplier * position.quantity;
    }

    const pnlPercent = position.entryPrice > 0 
      ? (pnl / (position.entryPrice * contractMultiplier * position.quantity)) * 100
      : 0;

    const trade: Trade = {
      positionId: position.id,
      optionSymbol: position.option.optionSymbol,
      optionType: position.option.optionType,
      strike: position.option.strike,
      expiration: position.option.expiration,
      direction: position.direction,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      entryTimestamp: position.entryTimestamp,
      exitPrice: expirationValue,
      exitTimestamp: timestamp,
      pnl: pnl,
      pnlPercent: pnlPercent,
      exitReason: "expiration",
    };

    position.isOpen = false;
    position.exitPrice = expirationValue;
    position.exitTimestamp = timestamp;
    position.pnl = pnl;

    this.openPositions.delete(positionId);
    this.closedTrades.push(trade);

    return trade;
  }

  getPositionPnL(positionId: string, currentPrice: number): number {
    const position = this.openPositions.get(positionId);
    if (!position) return 0;

    const contractMultiplier = 100;
    if (position.direction === "long") {
      return (currentPrice - position.entryPrice) * contractMultiplier * position.quantity;
    } else {
      return (position.entryPrice - currentPrice) * contractMultiplier * position.quantity;
    }
  }

  getPositionPnLPercent(positionId: string, currentPrice: number): number {
    const position = this.openPositions.get(positionId);
    if (!position || position.entryPrice === 0) return 0;

    if (position.direction === "long") {
      return ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    } else {
      return ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    }
  }

  getTotalEquity(currentPrices: Map<string, number>): number {
    let equity = this.cash;
    
    for (const positionId of Array.from(this.openPositions.keys())) {
      const position = this.openPositions.get(positionId)!;
      const currentPrice = currentPrices.get(position.option.optionSymbol) || position.entryPrice;
      const contractMultiplier = 100;
      
      if (position.direction === "long") {
        equity += currentPrice * contractMultiplier * position.quantity;
      } else {
        equity -= currentPrice * contractMultiplier * position.quantity;
        equity += position.entryPrice * contractMultiplier * position.quantity * 2;
      }
    }
    
    return equity;
  }

  reset(): void {
    this.cash = this.initialCash;
    this.openPositions.clear();
    this.closedTrades = [];
  }
}
