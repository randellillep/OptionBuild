import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Minus, Plus, X, RotateCcw, Check, EyeOff, Undo2, Trash2, Calendar } from "lucide-react";
import type { OptionLeg, MarketOptionChainSummary, ClosingTransaction } from "@shared/schema";
import { calculateGreeks, calculateImpliedVolatility } from "@/lib/options-pricing";

interface OptionMarketData {
  bid?: number;
  ask?: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  volume?: number;
}

interface OptionDetailsPanelProps {
  leg: OptionLeg;
  optionsChainData?: MarketOptionChainSummary;
  underlyingPrice: number;
  volatility?: number;
  onUpdateLeg?: (updates: Partial<OptionLeg>) => void;
  onAddToStrategy?: () => void;
  onClose: () => void;
  // Available expirations for Change Expiration feature
  availableExpirations?: string[];
  // Callback to update global expiration (updates heatmap and top bar)
  onChangeGlobalExpiration?: (days: number, date: string) => void;
  // View mode for closed positions
  isClosedView?: boolean;
  // Selected closing entry ID (for per-entry operations)
  selectedEntryId?: string | null;
  // Callback to reopen a closed entry as a NEW separate leg (with optional ID to preserve sort order)
  onReopenAsNewLeg?: (leg: Omit<OptionLeg, "id">, preserveOrderFromId?: string) => void;
  // Legacy props for backward compatibility
  symbol?: string;
  expirationDate?: string | null;
  marketData?: OptionMarketData;
  onUpdateQuantity?: (quantity: number) => void;
  onSwitchType?: () => void;
  onChangePosition?: () => void;
  onRemove?: () => void;
}

export function OptionDetailsPanel({
  leg,
  optionsChainData,
  underlyingPrice,
  volatility = 0.3,
  onUpdateLeg,
  onAddToStrategy,
  onClose,
  availableExpirations = [],
  onChangeGlobalExpiration,
  isClosedView = false,
  selectedEntryId,
  onReopenAsNewLeg,
  // Legacy props
  symbol: legacySymbol,
  expirationDate: legacyExpirationDate,
  marketData: legacyMarketData,
  onUpdateQuantity,
  onSwitchType,
  onChangePosition,
  onRemove,
}: OptionDetailsPanelProps) {
  // Extract market data from optionsChainData if available
  const getMarketData = (): OptionMarketData | undefined => {
    if (legacyMarketData) {
      // Legacy market data - ALWAYS recalculate Greeks using Black-Scholes
      // This ensures consistent Greeks regardless of data source
      const effectiveIV = leg.impliedVolatility || legacyMarketData.iv || volatility;
      const greeks = calculateGreeks(leg, underlyingPrice, effectiveIV);
      const multiplier = leg.position === "long" ? 1 : -1;
      return {
        ...legacyMarketData,
        iv: leg.impliedVolatility || legacyMarketData.iv,
        delta: (greeks.delta / leg.quantity) * multiplier,
        gamma: (greeks.gamma / leg.quantity) * multiplier,
        theta: (greeks.theta / leg.quantity) * multiplier,
        vega: (greeks.vega / leg.quantity) * multiplier,
        rho: (greeks.rho / leg.quantity) * multiplier,
      };
    }
    if (!optionsChainData || !optionsChainData.quotes) {
      // No market data - calculate Greeks using Black-Scholes
      const greeks = calculateGreeks(leg, underlyingPrice, volatility);
      const multiplier = leg.position === "long" ? 1 : -1;
      return {
        bid: undefined,
        ask: undefined,
        iv: leg.impliedVolatility,
        delta: (greeks.delta / leg.quantity) * multiplier, // Normalize to per-contract and apply position
        gamma: (greeks.gamma / leg.quantity) * multiplier,
        theta: (greeks.theta / leg.quantity) * multiplier,
        vega: (greeks.vega / leg.quantity) * multiplier,
        rho: (greeks.rho / leg.quantity) * multiplier,
        volume: undefined,
      };
    }
    
    const option = optionsChainData.quotes.find((opt: any) => 
      Math.abs(opt.strike - leg.strike) < 0.01 && opt.side.toLowerCase() === leg.type
    );
    
    if (!option) {
      // No matching option found - calculate Greeks using Black-Scholes
      const greeks = calculateGreeks(leg, underlyingPrice, volatility);
      const multiplier = leg.position === "long" ? 1 : -1;
      return {
        bid: undefined,
        ask: undefined,
        iv: leg.impliedVolatility,
        delta: (greeks.delta / leg.quantity) * multiplier, // Normalize to per-contract and apply position
        gamma: (greeks.gamma / leg.quantity) * multiplier,
        theta: (greeks.theta / leg.quantity) * multiplier,
        vega: (greeks.vega / leg.quantity) * multiplier,
        rho: (greeks.rho / leg.quantity) * multiplier,
        volume: undefined,
      };
    }
    
    // ALWAYS calculate Greeks using Black-Scholes closed-form formulas
    // This ensures consistent, stable Greeks that match industry standards
    // API-provided Greeks may vary based on vendor methodology
    
    // Calculate mid from bid/ask if mid is missing or zero
    const optionMid = option.mid > 0 ? option.mid 
      : (option.bid > 0 && option.ask > 0) ? (option.bid + option.ask) / 2 
      : 0;
    
    // ALWAYS calculate IV from market price to match industry standards (OptionStrat)
    // Don't trust leg.impliedVolatility as it may contain inflated vendor IV
    // Use at least 0.5 DTE (half a trading day) for very short-dated options
    const effectiveDTE = Math.max(0.5, leg.expirationDays || 1);
    
    let effectiveIV: number;
    if (optionMid > 0 && underlyingPrice > 0 && (leg.type === 'call' || leg.type === 'put')) {
      effectiveIV = calculateImpliedVolatility(
        leg.type,
        underlyingPrice,
        leg.strike,
        effectiveDTE,
        optionMid
      );
    } else if (leg.impliedVolatility) {
      // Fallback to stored IV only if we can't calculate from market
      effectiveIV = leg.impliedVolatility;
    } else {
      effectiveIV = option.iv || volatility;
    }
    
    const greeks = calculateGreeks(leg, underlyingPrice, effectiveIV);
    const multiplier = leg.position === "long" ? 1 : -1;
    
    return {
      bid: option.bid || 0,
      ask: option.ask || 0,
      iv: effectiveIV, // Use calculated IV
      delta: (greeks.delta / leg.quantity) * multiplier,
      gamma: (greeks.gamma / leg.quantity) * multiplier,
      theta: (greeks.theta / leg.quantity) * multiplier,
      vega: (greeks.vega / leg.quantity) * multiplier,
      rho: (greeks.rho / leg.quantity) * multiplier,
      volume: option.volume || 0,
    };
  };

  const marketData = getMarketData();
  const symbol = legacySymbol || optionsChainData?.symbol || "N/A";
  const expirationDate = legacyExpirationDate || (optionsChainData?.expirations?.[0] || null);
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
  };

  const formatGreek = (value: number | undefined, decimals: number = 4) => {
    if (value === undefined) return "—";
    return value.toFixed(decimals);
  };

  const formatPrice = (value: number | undefined) => {
    if (value === undefined) return "—";
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined) return "—";
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatStrike = (strike: number) => {
    return strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2).replace(/\.?0+$/, '');
  };
  
  const title = `${symbol.toUpperCase()} ${formatStrike(leg.strike)}${leg.type === "call" ? "C" : "P"} ${formatDate(expirationDate)}`;
  const positionText = leg.position === "long" ? "Buy" : "Sell";
  const oppositePosition = leg.position === "long" ? "Sell" : "Buy";
  
  // Calculate remaining quantity (original - closed)
  // ALL closing entries reduce quantity (excluded entries still count as sold, just hide P/L)
  const closedQuantity = leg.closingTransaction?.isEnabled 
    ? (leg.closingTransaction?.entries 
        ? leg.closingTransaction.entries.reduce((sum, e) => sum + e.quantity, 0)
        : (leg.closingTransaction?.quantity || 0))
    : 0;
  const remainingQuantity = leg.quantity - closedQuantity;
  // Display remaining quantity for open positions (use remaining if there are closings)
  const displayQuantity = leg.position === "long" 
    ? (closedQuantity > 0 ? remainingQuantity : leg.quantity)
    : (closedQuantity > 0 ? -remainingQuantity : -leg.quantity);
  
  // Calculate average of bid/ask for cost basis
  const calculateAverageCost = () => {
    if (marketData?.bid !== undefined && marketData?.ask !== undefined) {
      return (marketData.bid + marketData.ask) / 2;
    }
    return leg.premium;
  };
  
  // Use ref to track editing state - more reliable than state for blocking effects
  const isEditingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [costBasis, setCostBasis] = useState<number>(leg.premium);
  const [costBasisText, setCostBasisText] = useState<string>(leg.premium.toFixed(2));
  
  // Check if this leg has a manually edited or saved premium (persisted in leg data)
  // Both 'manual' and 'saved' should prevent market data from overwriting the premium
  const isManuallyEdited = leg.premiumSource === "manual" || leg.premiumSource === "saved";
  
  // Parse and validate cost basis text - returns valid number or null
  const parseValidCostBasis = (text: string): number | null => {
    // Only allow valid decimal numbers (digits, optional one decimal point, digits)
    const isValidFormat = /^\d*\.?\d*$/.test(text) && text !== '' && text !== '.';
    if (!isValidFormat) return null;
    
    const value = parseFloat(text);
    // Check for valid finite number in reasonable range (0 to 100000)
    if (isNaN(value) || !isFinite(value) || value < 0 || value > 100000) return null;
    return value;
  };
  
  // Commit the current edit value
  const commitCostBasisEdit = (text: string) => {
    const validValue = parseValidCostBasis(text);
    if (validValue !== null) {
      setCostBasis(validValue);
      setCostBasisText(validValue.toFixed(2));
      if (onUpdateLeg) {
        onUpdateLeg({ premium: validValue, premiumSource: "manual" });
      }
    } else {
      // Reset to previous valid value
      setCostBasisText(costBasis.toFixed(2));
    }
  };
  
  // Sync local state with leg premium when leg changes - but NOT during editing
  useEffect(() => {
    // Skip all updates while user is editing
    if (isEditingRef.current) return;
    
    setCostBasis(leg.premium);
    setCostBasisText(leg.premium.toFixed(2));
  }, [leg.premium, leg.premiumSource]);
  
  // Update cost basis when market data changes (only if not manually edited and not editing)
  useEffect(() => {
    // Skip all updates while user is editing
    if (isEditingRef.current) return;
    if (isManuallyEdited) return;
    
    if (marketData?.bid !== undefined && marketData?.ask !== undefined) {
      const avgCost = calculateAverageCost();
      setCostBasis(avgCost);
      setCostBasisText(avgCost.toFixed(2));
      // Update leg premium to match the calculated average
      if (onUpdateLeg) {
        onUpdateLeg({ premium: avgCost, premiumSource: "market" });
      }
    }
  }, [marketData?.bid, marketData?.ask, isManuallyEdited]);
  
  const handleCostBasisTextChange = (text: string) => {
    // Only allow valid input characters (digits and one decimal point)
    if (/^\d*\.?\d*$/.test(text)) {
      setCostBasisText(text);
    }
  };
  
  const handleCostBasisFocus = () => {
    // Set ref immediately - this blocks effects synchronously
    isEditingRef.current = true;
  };
  
  const handleCostBasisBlur = () => {
    // Commit the edit first, then allow updates again
    commitCostBasisEdit(costBasisText);
    // Small delay before allowing updates to prevent race conditions
    setTimeout(() => {
      isEditingRef.current = false;
    }, 100);
  };
  
  const handleResetCostBasis = () => {
    const avgCost = calculateAverageCost();
    setCostBasis(avgCost);
    setCostBasisText(avgCost.toFixed(2));
    // Reset to market-based pricing
    if (onUpdateLeg) onUpdateLeg({ premium: avgCost, premiumSource: "market" });
  };
  
  const handleQuantityDecrease = () => {
    if (leg.position === "long") {
      // Long position: decrease from positive (2 → 1)
      const newQuantity = Math.max(1, leg.quantity - 1);
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    } else {
      // Short position: increase magnitude (-1 → -2)
      const newQuantity = leg.quantity + 1;
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    }
  };
  
  const handleQuantityIncrease = () => {
    if (leg.position === "long") {
      // Long position: increase to positive (1 → 2)
      const newQuantity = leg.quantity + 1;
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    } else {
      // Short position: decrease magnitude (but keep at least -1) (-2 → -1)
      const newQuantity = Math.max(1, leg.quantity - 1);
      if (onUpdateQuantity) onUpdateQuantity(newQuantity);
      if (onUpdateLeg) onUpdateLeg({ quantity: newQuantity });
    }
  };

  // === Change Expiration State ===
  const [showExpirationPicker, setShowExpirationPicker] = useState(false);
  
  // === Closing Transaction State ===
  // Fix: Initialize to false - only open when explicitly clicked, not based on existing transactions
  const [showClosingSection, setShowClosingSection] = useState(false);
  // Default closing quantity to 1 when first enabling (not full position)
  // For existing transactions, calculate remaining quantity available to close from entries
  // Only count non-excluded entries to get accurate remaining open quantity
  const existingClosedQty = leg.closingTransaction?.entries
    ?.filter(e => !e.isExcluded)
    .reduce((sum, e) => sum + e.quantity, 0) || 0;
  const remainingToClose = Math.max(0, leg.quantity - existingClosedQty);
  const [closingQty, setClosingQty] = useState(Math.min(1, Math.max(1, remainingToClose)));
  const [closingPriceText, setClosingPriceText] = useState(
    (leg.closingTransaction?.closingPrice || marketData?.ask || leg.premium).toFixed(2)
  );
  const closingPriceEditingRef = useRef(false);
  
  // State for editing prices in closed view
  const [editingClosedOpenPrice, setEditingClosedOpenPrice] = useState(false);
  const [editingClosedClosePrice, setEditingClosedClosePrice] = useState(false);
  const [closedOpenPriceText, setClosedOpenPriceText] = useState("");
  const [closedClosePriceText, setClosedClosePriceText] = useState("");

  // Reset closing section state when leg changes
  useEffect(() => {
    setShowClosingSection(false);
    setShowExpirationPicker(false);
    // Reset closing quantity for the new leg
    const closedQty = leg.closingTransaction?.entries
      ?.filter(e => !e.isExcluded)
      .reduce((sum, e) => sum + e.quantity, 0) || 0;
    const remaining = Math.max(0, leg.quantity - closedQty);
    setClosingQty(Math.min(1, Math.max(1, remaining)));
    // Reset closing price
    const defaultPrice = marketData?.ask || leg.premium;
    setClosingPriceText(defaultPrice.toFixed(2));
  }, [leg.id]);

  // Sync closing transaction state with leg - but DON'T auto-open the section
  useEffect(() => {
    // Only update closing price text if already showing and not editing
    if (showClosingSection && !closingPriceEditingRef.current && leg.closingTransaction?.isEnabled) {
      setClosingPriceText(leg.closingTransaction.closingPrice.toFixed(2));
    }
  }, [leg.closingTransaction, showClosingSection]);

  const handleToggleClosing = (enabled: boolean) => {
    // Just toggle the UI section visibility - don't execute the sell yet
    setShowClosingSection(enabled);
    if (enabled) {
      // Initialize closing price to market ask or current premium
      const defaultPrice = marketData?.ask || leg.premium;
      setClosingPriceText(defaultPrice.toFixed(2));
      // Calculate remaining quantity available to close from non-excluded entries
      const alreadyClosed = leg.closingTransaction?.entries
        ?.filter(e => !e.isExcluded)
        .reduce((sum, e) => sum + e.quantity, 0) || 0;
      const remaining = Math.max(0, leg.quantity - alreadyClosed);
      setClosingQty(Math.min(1, Math.max(1, remaining))); // Default to 1 contract (or less if only 1 remaining)
    }
  };

  // Confirm the closing transaction - this actually executes the sell
  // Creates a new ClosingEntry with the current strike (immutable)
  const handleConfirmClose = () => {
    // Use explicit NaN check instead of || to allow 0 as valid closing price
    // This is important when user wants to close at $0 (e.g., option expired worthless)
    const parsedPrice = parseFloat(closingPriceText);
    const closingPrice = !isNaN(parsedPrice) ? parsedPrice : (marketData?.ask || leg.premium);
    
    // Create a new closing entry with the current strike and opening price (cost basis)
    // These values are captured as primitives and will NOT change when the leg is moved
    // Calculate the next visualOrder (max existing + 1, or 0 if no existing entries)
    const existingOrders = (leg.closingTransaction?.entries || []).map(e => e.visualOrder ?? 0);
    const nextVisualOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0;
    
    const newEntry: import("@shared/schema").ClosingEntry = {
      id: `close-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      quantity: closingQty,
      closingPrice: closingPrice,
      closedAt: new Date().toISOString(),
      strike: leg.strike, // Capture strike at time of close (immutable primitive)
      openingPrice: leg.premium, // Capture cost basis at time of close (immutable primitive)
      isExcluded: false,
      visualOrder: nextVisualOrder, // Stable visual position that doesn't change when entries are removed
    };
    
    // Deep copy ALL existing entries to prevent any shared references
    // This ensures that when the leg is later updated (e.g., dragged to new strike),
    // the closed entries' openingPrice and strike values are NOT mutated
    const existingEntries = (leg.closingTransaction?.entries || []).map(entry => ({
      ...entry // Create a new object for each entry
    }));
    const allEntries = [...existingEntries, newEntry];
    
    // Calculate aggregated values for compatibility
    const totalClosedQty = allEntries.reduce((sum, e) => sum + e.quantity, 0);
    const weightedAvgPrice = allEntries.reduce((sum, e) => sum + (e.closingPrice * e.quantity), 0) / totalClosedQty;
    
    const closing: ClosingTransaction = {
      quantity: totalClosedQty,
      closingPrice: weightedAvgPrice,
      isEnabled: true,
      entries: allEntries,
    };
    
    if (onUpdateLeg) onUpdateLeg({ closingTransaction: closing });
    setShowClosingSection(false);
    onClose(); // Close the popup after confirming the sell
  };

  // Cancel the closing interface
  const handleCancelClose = () => {
    setShowClosingSection(false);
  };

  const handleClosingQtyChange = (delta: number) => {
    // Calculate max closable from remaining open quantity (not already closed)
    const alreadyClosed = leg.closingTransaction?.entries
      ?.filter(e => !e.isExcluded)
      .reduce((sum, e) => sum + e.quantity, 0) || 0;
    const maxClosable = Math.max(1, leg.quantity - alreadyClosed);
    const newQty = Math.max(1, Math.min(maxClosable, closingQty + delta));
    setClosingQty(newQty);
    if (leg.closingTransaction?.isEnabled && onUpdateLeg) {
      onUpdateLeg({ 
        closingTransaction: { 
          ...leg.closingTransaction, 
          quantity: newQty 
        } 
      });
    }
  };

  const handleClosingPriceChange = (text: string) => {
    if (/^\d*\.?\d*$/.test(text)) {
      setClosingPriceText(text);
    }
  };

  const handleClosingPriceFocus = () => {
    closingPriceEditingRef.current = true;
  };

  const handleClosingPriceBlur = () => {
    closingPriceEditingRef.current = false;
    const price = parseFloat(closingPriceText);
    if (!isNaN(price) && price >= 0 && leg.closingTransaction?.isEnabled && onUpdateLeg) {
      setClosingPriceText(price.toFixed(2));
      onUpdateLeg({ 
        closingTransaction: { 
          ...leg.closingTransaction, 
          closingPrice: price 
        } 
      });
    }
  };

  // === Change Expiration Handler ===
  const handleChangeExpiration = (newExpirationDate: string) => {
    if (!onUpdateLeg) return;
    
    // Calculate new expirationDays from the selected date
    const expDate = new Date(newExpirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    // Update the leg's expiration
    onUpdateLeg({ 
      expirationDate: newExpirationDate,
      expirationDays: diffDays,
    });
    
    // Also update global expiration (updates heatmap and top bar)
    if (onChangeGlobalExpiration) {
      onChangeGlobalExpiration(diffDays, newExpirationDate);
    }
    
    setShowExpirationPicker(false);
  };

  // Format expiration dates for display - group by month
  // Use the same expirationDate that the header uses (global expiration from props)
  const formatExpirationDates = () => {
    if (!availableExpirations || availableExpirations.length === 0) return [];
    
    // Sort dates chronologically
    const sortedDates = [...availableExpirations].sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );
    
    // Group by month
    const grouped: { month: string; dates: { date: string; day: number; isCurrent: boolean }[] }[] = [];
    
    sortedDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      // Use same expirationDate as header (global from props, not leg-specific)
      const isCurrent = expirationDate === dateStr;
      
      let monthGroup = grouped.find(g => g.month === monthKey);
      if (!monthGroup) {
        monthGroup = { month: monthKey, dates: [] };
        grouped.push(monthGroup);
      }
      monthGroup.dates.push({ date: dateStr, day, isCurrent });
    });
    
    return grouped;
  };

  // === Exclude Toggle ===
  // For closed view with a specific entry, toggle that entry's exclusion
  // For open position view, toggle the leg's exclusion
  const handleToggleExclude = () => {
    if (!onUpdateLeg) return;
    
    // If we're in closed view and have a selected entry, toggle that entry's exclusion
    if (isClosedView && selectedEntryId && leg.closingTransaction?.entries) {
      // Deep copy ALL entries to prevent shared references
      const updatedEntries = leg.closingTransaction.entries.map(entry => {
        if (entry.id === selectedEntryId) {
          return { ...entry, isExcluded: !entry.isExcluded };
        }
        return { ...entry }; // Deep copy unchanged entries too
      });
      
      // Recalculate aggregated values from non-excluded entries
      const activeEntries = updatedEntries.filter(e => !e.isExcluded);
      const totalActiveQty = activeEntries.reduce((sum, e) => sum + e.quantity, 0);
      const weightedAvgPrice = totalActiveQty > 0 
        ? activeEntries.reduce((sum, e) => sum + (e.closingPrice * e.quantity), 0) / totalActiveQty
        : 0;
      
      onUpdateLeg({ 
        closingTransaction: {
          ...leg.closingTransaction,
          quantity: totalActiveQty,
          closingPrice: weightedAvgPrice,
          entries: updatedEntries,
        }
      });
    } else {
      // Toggle the leg's exclusion (for remaining open position)
      onUpdateLeg({ isExcluded: !leg.isExcluded });
    }
  };
  
  // Get the current entry if we have a selectedEntryId
  const selectedEntry = selectedEntryId 
    ? leg.closingTransaction?.entries?.find(e => e.id === selectedEntryId)
    : null;

  // === Reopen Closed Entry as NEW Separate Leg ===
  // Creates a new separate leg to keep boxes independent, but preserves sort order
  const handleReopenPosition = () => {
    if (!onUpdateLeg) return;
    
    // If we have a selectedEntryId, reopen as a NEW separate leg
    if (selectedEntryId && leg.closingTransaction?.entries && onReopenAsNewLeg) {
      const entryToReopen = leg.closingTransaction.entries.find(e => e.id === selectedEntryId);
      if (!entryToReopen) return;
      
      // Create a NEW leg with the reopened entry's data
      // CRITICAL: Inherit visualOrder from original leg to maintain exact position
      const newLeg: Omit<OptionLeg, "id"> = {
        type: leg.type,
        position: leg.position,
        strike: entryToReopen.strike,
        premium: leg.premium, // Original cost basis
        quantity: entryToReopen.quantity,
        expirationDays: leg.expirationDays,
        expirationDate: leg.expirationDate,
        premiumSource: leg.premiumSource,
        impliedVolatility: leg.impliedVolatility,
        entryUnderlyingPrice: leg.entryUnderlyingPrice ?? underlyingPrice,
        costBasisLocked: true,
        visualOrder: leg.visualOrder, // Inherit visualOrder to keep same position
      };
      
      // Remove the entry from the current leg's closing transaction
      const updatedEntries = leg.closingTransaction.entries
        .filter(e => e.id !== selectedEntryId)
        .map(e => ({ ...e }));
      const activeEntries = updatedEntries.filter(e => !e.isExcluded);
      const totalActiveQty = activeEntries.reduce((sum, e) => sum + e.quantity, 0);
      const weightedAvgPrice = totalActiveQty > 0 
        ? activeEntries.reduce((sum, e) => sum + (e.closingPrice * e.quantity), 0) / totalActiveQty
        : 0;
      
      const hasRemainingEntries = updatedEntries.length > 0;
      
      // Update the original leg: remove the entry AND reduce quantity
      // The reopened contracts are transferred to the new leg
      const newOriginalQuantity = leg.quantity - entryToReopen.quantity;
      
      onUpdateLeg({
        quantity: newOriginalQuantity,
        closingTransaction: hasRemainingEntries ? {
          ...leg.closingTransaction,
          quantity: totalActiveQty,
          closingPrice: weightedAvgPrice,
          entries: updatedEntries,
          isEnabled: true,
        } : {
          quantity: 0,
          closingPrice: 0,
          isEnabled: false,
          entries: [],
        }
      });
      
      // Add the new leg, preserving sort order from original leg's ID
      onReopenAsNewLeg(newLeg, leg.id);
      onClose();
      return;
    }
    
    // Legacy fallback: clear the entire closing transaction (old behavior)
    onUpdateLeg({ 
      closingTransaction: {
        quantity: 0,
        closingPrice: 0,
        isEnabled: false
      }
    });
    onClose();
  };

  // === Delete Specific Closing Entry ===
  // Removes the entry without restoring contracts to open position
  // The contracts are considered "removed" entirely (neither open nor closed)
  const handleDeleteClosingEntry = () => {
    if (!onUpdateLeg || !selectedEntryId || !leg.closingTransaction?.entries) return;
    
    const entryToDelete = leg.closingTransaction.entries.find(e => e.id === selectedEntryId);
    if (!entryToDelete) return;
    
    // Remove the entry from the entries array
    // Deep copy remaining entries to prevent shared references
    const updatedEntries = leg.closingTransaction.entries
      .filter(e => e.id !== selectedEntryId)
      .map(e => ({ ...e }));
    
    // Reduce the leg's quantity by the deleted entry's quantity
    // This ensures those contracts don't come back as "open"
    const newQuantity = Math.max(0, leg.quantity - entryToDelete.quantity);
    
    // Recalculate aggregated values from remaining non-excluded entries
    const activeEntries = updatedEntries.filter(e => !e.isExcluded);
    const totalActiveQty = activeEntries.reduce((sum, e) => sum + e.quantity, 0);
    const weightedAvgPrice = totalActiveQty > 0 
      ? activeEntries.reduce((sum, e) => sum + (e.closingPrice * e.quantity), 0) / totalActiveQty
      : 0;
    
    // If no entries left, disable the closing transaction entirely
    const hasRemainingEntries = updatedEntries.length > 0;
    
    onUpdateLeg({ 
      quantity: newQuantity,
      closingTransaction: hasRemainingEntries ? {
        ...leg.closingTransaction,
        quantity: totalActiveQty,
        closingPrice: weightedAvgPrice,
        entries: updatedEntries,
        isEnabled: true,
      } : {
        quantity: 0,
        closingPrice: 0,
        isEnabled: false,
        entries: [],
      }
    });
  };

  // Get the opposite action text for closing
  const closingActionText = leg.position === "long" ? "Sell to Close" : "Buy to Close";
  const closedActionText = leg.position === "long" ? "Sold" : "Bought";

  // Closed Position View - simplified view for positions that have been closed
  // Check for entries existence as backup in case isEnabled is not properly set
  const hasClosingEntries = leg.closingTransaction?.entries && leg.closingTransaction.entries.length > 0;
  if (isClosedView && leg.closingTransaction && (leg.closingTransaction.isEnabled || hasClosingEntries)) {
    const closedQty = leg.closingTransaction.quantity || 0;
    const closePrice = leg.closingTransaction.closingPrice || 0;
    const closingEntries = leg.closingTransaction.entries || [];
    const hasMultipleEntries = closingEntries.length > 1;
    
    // Get the selected entry if there's a selectedEntryId
    // This allows displaying the IMMUTABLE strike and cost basis from the entry itself
    const selectedClosedEntry = selectedEntryId 
      ? closingEntries.find(e => e.id === selectedEntryId)
      : (closingEntries.length === 1 ? closingEntries[0] : null);
    
    // Use entry's immutable strike and openingPrice if available, otherwise fall back to leg values (legacy)
    const displayStrike = selectedClosedEntry?.strike ?? leg.strike;
    const displayCostBasis = selectedClosedEntry?.openingPrice ?? leg.premium;
    
    // Create title using the ENTRY's immutable strike (not leg.strike which can change)
    const closedTitle = `${symbol.toUpperCase()} ${formatStrike(displayStrike)}${leg.type === "call" ? "C" : "P"} ${formatDate(expirationDate)}`;
    
    // P/L calculation using each entry's stored opening price (immutable cost basis)
    // For entries with openingPrice, use it; otherwise fall back to leg.premium (legacy)
    // Long: P/L = (closePrice - openingPrice) * qty * 100
    // Short: P/L = (openingPrice - closePrice) * qty * 100
    const profitLoss = closingEntries.reduce((total, entry) => {
      const costBasis = entry.openingPrice ?? leg.premium;
      const entryPL = leg.position === "long"
        ? (entry.closingPrice - costBasis) * entry.quantity * 100
        : (costBasis - entry.closingPrice) * entry.quantity * 100;
      return total + entryPL;
    }, 0);
    const isProfitable = profitLoss >= 0;
    
    // Labels based on position type
    const closePriceLabel = leg.position === "long" ? "Avg Sold Price" : "Avg Bought Price";
    const openPriceLabel = leg.position === "long" ? "Bought Price" : "Sold Price";

    return (
      <div 
        className="w-80 p-4 space-y-3 bg-background border border-sky-500 rounded-lg shadow-lg" 
        data-testid="option-details-panel-closed"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header for Closed Position */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{closedTitle}</h3>
            <Badge className="mt-1 text-xs bg-sky-600 text-white">
              <Check className="h-3 w-3 mr-1" />
              {closedActionText} {closedQty} Contract{closedQty !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6"
            data-testid="button-close-details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Closed Position Details */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{openPriceLabel}</label>
              {editingClosedOpenPrice && selectedClosedEntry ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={closedOpenPriceText}
                    onChange={(e) => setClosedOpenPriceText(e.target.value)}
                    onBlur={() => {
                      const price = parseFloat(closedOpenPriceText);
                      if (!isNaN(price) && price >= 0 && selectedClosedEntry && onUpdateLeg) {
                        const updatedEntries = (leg.closingTransaction?.entries || []).map(entry => 
                          entry.id === selectedClosedEntry.id 
                            ? { ...entry, openingPrice: price }
                            : entry
                        );
                        onUpdateLeg({
                          closingTransaction: {
                            ...leg.closingTransaction!,
                            entries: updatedEntries
                          }
                        });
                      }
                      setEditingClosedOpenPrice(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingClosedOpenPrice(false);
                    }}
                    autoFocus
                    className="w-16 h-6 px-1 text-sm font-mono font-semibold rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="input-closed-open-price"
                  />
                </div>
              ) : selectedClosedEntry ? (
                <div 
                  className="font-mono font-semibold cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                  onClick={() => {
                    setClosedOpenPriceText(displayCostBasis.toFixed(2));
                    setEditingClosedOpenPrice(true);
                  }}
                  data-testid="text-closed-open-price"
                >
                  ${displayCostBasis.toFixed(2)}
                </div>
              ) : (
                <div className="font-mono font-semibold" data-testid="text-closed-open-price">
                  ${displayCostBasis.toFixed(2)}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{closePriceLabel}</label>
              {editingClosedClosePrice && selectedClosedEntry ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={closedClosePriceText}
                    onChange={(e) => setClosedClosePriceText(e.target.value)}
                    onBlur={() => {
                      const price = parseFloat(closedClosePriceText);
                      if (!isNaN(price) && price >= 0 && selectedClosedEntry && onUpdateLeg) {
                        const updatedEntries = (leg.closingTransaction?.entries || []).map(entry => 
                          entry.id === selectedClosedEntry.id 
                            ? { ...entry, closingPrice: price }
                            : entry
                        );
                        const activeEntries = updatedEntries.filter(e => !e.isExcluded);
                        const totalActiveQty = activeEntries.reduce((sum, e) => sum + e.quantity, 0);
                        const weightedAvgPrice = totalActiveQty > 0 
                          ? activeEntries.reduce((sum, e) => sum + (e.closingPrice * e.quantity), 0) / totalActiveQty
                          : 0;
                        onUpdateLeg({
                          closingTransaction: {
                            ...leg.closingTransaction!,
                            closingPrice: weightedAvgPrice,
                            entries: updatedEntries
                          }
                        });
                      }
                      setEditingClosedClosePrice(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingClosedClosePrice(false);
                    }}
                    autoFocus
                    className="w-16 h-6 px-1 text-sm font-mono font-semibold rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="input-closed-close-price"
                  />
                </div>
              ) : selectedClosedEntry ? (
                <div 
                  className="font-mono font-semibold cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                  onClick={() => {
                    setClosedClosePriceText(closePrice.toFixed(2));
                    setEditingClosedClosePrice(true);
                  }}
                  data-testid="text-closed-close-price"
                >
                  ${closePrice.toFixed(2)}
                </div>
              ) : (
                <div className="font-mono font-semibold" data-testid="text-closed-close-price">
                  ${closePrice.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Show individual closing entries if multiple partial closes */}
          {hasMultipleEntries && (
            <div className="bg-muted/50 rounded p-2 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Closing Entries</label>
              {closingEntries.map((entry, idx) => {
                // Use entry's stored opening price (immutable cost basis), fallback to leg.premium for legacy
                const costBasis = entry.openingPrice ?? leg.premium;
                const entryPL = leg.position === "long"
                  ? (entry.closingPrice - costBasis) * entry.quantity * 100
                  : (costBasis - entry.closingPrice) * entry.quantity * 100;
                const entryProfitable = entryPL >= 0;
                return (
                  <div key={entry.id || idx} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      {entry.quantity} @ ${entry.closingPrice.toFixed(2)}
                    </span>
                    <span className={entryProfitable ? 'text-emerald-600' : 'text-rose-600'}>
                      {entryProfitable ? '+' : ''}${entryPL.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quantity Closed</label>
              <div className="font-mono font-semibold">{closedQty}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Total P/L</label>
              <div className={`font-mono font-semibold ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isProfitable ? '+' : ''}${profitLoss.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions for Closed Position */}
        <div className="space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8 gap-2"
            onClick={handleReopenPosition}
            data-testid="button-reopen-position"
          >
            <Undo2 className="h-3 w-3" />
            Reopen Position
          </Button>

          <Button
            variant={(selectedEntry?.isExcluded) ? "secondary" : "ghost"}
            size="sm"
            className={`w-full justify-start text-xs h-8 gap-2 ${(selectedEntry?.isExcluded) ? 'text-amber-600 dark:text-amber-400' : ''}`}
            onClick={handleToggleExclude}
            data-testid="button-toggle-exclude-closed"
          >
            <EyeOff className="h-3 w-3" />
            {(selectedEntry?.isExcluded) ? "Excluded from P/L" : "Exclude from P/L"}
          </Button>

          <Separator className="my-1" />

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8 gap-2 text-destructive hover:text-destructive"
            onClick={handleDeleteClosingEntry}
            data-testid="button-delete-closing-entry"
          >
            <Trash2 className="h-3 w-3" />
            Delete This Sale
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-80 max-h-[calc(100vh-8rem)] flex flex-col bg-background border border-border rounded-lg shadow-lg" 
      data-testid="option-details-panel"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header - fixed at top */}
      <div className="flex-none p-4 pb-0 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <Badge variant="outline" className="mt-1 text-xs">
              {positionText} {leg.type === "call" ? "Call" : "Put"}
            </Badge>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6"
            data-testid="button-close-details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />
      </div>
      
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3">

      {/* Quantity and Cost Basis - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Quantity Controls */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Quantity</label>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={handleQuantityDecrease}
              className="h-8 w-8"
              data-testid="button-decrease-quantity"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center font-mono font-semibold" data-testid="text-quantity">
              {displayQuantity}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleQuantityIncrease}
              className="h-8 w-8"
              data-testid="button-increase-quantity"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Cost Basis */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Cost Basis</label>
          <div className="flex items-center gap-1 relative">
            <span className="text-sm font-semibold select-none">$</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={costBasisText}
              onChange={(e) => handleCostBasisTextChange(e.target.value)}
              onFocus={handleCostBasisFocus}
              onBlur={handleCostBasisBlur}
              onClick={(e) => e.currentTarget.select()}
              onMouseDown={(e) => {
                // Set editing ref immediately on mousedown to block any pending updates
                isEditingRef.current = true;
              }}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="input-cost-basis"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleResetCostBasis}
              disabled={!marketData?.bid || !marketData?.ask}
              className="h-8 w-8 flex-shrink-0"
              title={marketData?.bid && marketData?.ask ? "Reset to market average" : "No market data available"}
              aria-label="Reset cost basis"
              data-testid="button-reset-cost-basis"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bid/Ask */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bid</span>
          <span className="font-mono font-semibold text-green-600 dark:text-green-400">{formatPrice(marketData?.bid)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ask</span>
          <span className="font-mono font-semibold text-red-600 dark:text-red-400">{formatPrice(marketData?.ask)}</span>
        </div>
        {marketData?.volume !== undefined && marketData?.volume > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Volume</span>
            <span className="font-mono font-semibold">{marketData.volume.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Greeks Section */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Greeks</label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">IV</span>
            <span className="font-mono font-semibold" data-testid="greek-iv">
              {formatPercent(marketData?.iv ?? leg.impliedVolatility)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delta</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.delta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gamma</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.gamma)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Theta</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.theta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vega</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.vega)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rho</span>
            <span className="font-mono font-semibold">{formatGreek(marketData?.rho)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-2">
        {onAddToStrategy ? (
          // Add mode - show "Add to Strategy" button
          <Button
            variant="default"
            size="sm"
            className="w-full text-xs"
            onClick={onAddToStrategy}
            data-testid="button-add-to-strategy"
          >
            Add to Strategy
          </Button>
        ) : (
          // Edit mode - show edit/remove actions
          <div className="space-y-1.5">
            {/* Switch to Call/Put */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs h-8 gap-2"
              onClick={() => {
                if (onSwitchType) onSwitchType();
                if (onUpdateLeg) onUpdateLeg({ type: leg.type === "call" ? "put" : "call" });
              }}
              data-testid="button-switch-type"
            >
              <RotateCcw className="h-3 w-3" />
              Switch to {leg.type === "call" ? "Put" : "Call"}
            </Button>

            {/* Buy/Sell to Close with expandable section */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 gap-2"
                onClick={() => handleToggleClosing(!showClosingSection)}
                data-testid="button-toggle-closing"
              >
                <Check className="h-3 w-3" />
                {closingActionText}
              </Button>

              {/* Expanded Closing Section */}
              {showClosingSection && (
                <div className="ml-5 p-2 rounded-md bg-muted/50 space-y-2">
                  {/* Closing Price and Quantity - Side by Side */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Closing Price */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Price</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={closingPriceText}
                        onChange={(e) => handleClosingPriceChange(e.target.value)}
                        onFocus={handleClosingPriceFocus}
                        onBlur={handleClosingPriceBlur}
                        onClick={(e) => e.currentTarget.select()}
                        onMouseDown={() => { closingPriceEditingRef.current = true; }}
                        className="w-full h-7 px-2 text-xs font-mono text-center rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        data-testid="input-closing-price"
                      />
                    </div>

                    {/* Closing Quantity */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Qty</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => handleClosingQtyChange(-1)}
                          disabled={closingQty <= 1}
                          data-testid="button-close-qty-decrease"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="flex-1 text-center font-mono text-xs font-semibold min-w-[24px]">
                          {closingQty === leg.quantity ? 'All' : closingQty}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => handleClosingQtyChange(1)}
                          disabled={closingQty >= leg.quantity}
                          data-testid="button-close-qty-increase"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Confirm and Cancel Buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-7 bg-sky-600 hover:bg-sky-700"
                      onClick={handleConfirmClose}
                      data-testid="button-confirm-close"
                    >
                      {closingActionText}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-7"
                      onClick={handleCancelClose}
                      data-testid="button-cancel-close"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Change Expiration - OptionStrat style */}
            {availableExpirations && availableExpirations.length > 0 && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8 gap-2"
                  onClick={() => setShowExpirationPicker(!showExpirationPicker)}
                  data-testid="button-change-expiration"
                >
                  <Calendar className="h-3 w-3" />
                  Change Expiration
                </Button>

                {/* Expanded Expiration Picker - OptionStrat calendar row style */}
                {showExpirationPicker && (
                  <div className="ml-5 p-2 rounded-md bg-muted/50 space-y-2">
                    {formatExpirationDates().map((monthGroup) => (
                      <div key={monthGroup.month} className="space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground text-center">
                          {monthGroup.month}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {monthGroup.dates.map(({ date, day, isCurrent }) => (
                            <button
                              key={date}
                              onClick={() => handleChangeExpiration(date)}
                              className={`
                                min-w-[28px] h-6 px-1.5 text-xs font-medium rounded transition-colors
                                ${isCurrent 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-muted hover:bg-accent hover:text-accent-foreground'
                                }
                              `}
                              data-testid={`button-expiration-${date}`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Exclude Toggle */}
            <Button
              variant={leg.isExcluded ? "secondary" : "ghost"}
              size="sm"
              className={`w-full justify-start text-xs h-8 gap-2 ${leg.isExcluded ? 'text-amber-600 dark:text-amber-400' : ''}`}
              onClick={handleToggleExclude}
              data-testid="button-toggle-exclude"
            >
              <EyeOff className="h-3 w-3" />
              {leg.isExcluded ? "Excluded from P/L" : "Exclude"}
            </Button>

            <Separator className="my-1" />

            {/* Remove */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs h-8 gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                if (onRemove) onRemove();
              }}
              data-testid="button-remove-leg"
            >
              <X className="h-3 w-3" />
              Remove
            </Button>
          </div>
        )}
      </div>
      {/* End scrollable content */}
      </div>
      
      {/* Bottom padding for scrollable panel */}
      <div className="flex-none p-2" />
    </div>
  );
}
