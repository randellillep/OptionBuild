import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface RangeVolatilitySlidersProps {
  range: number;
  onRangeChange: (value: number) => void;
  impliedVolatility: number;
  onVolatilityChange: (value: number) => void;
  calculatedIV?: number;
  onResetIV?: () => void;
}

export function RangeVolatilitySliders({
  range,
  onRangeChange,
  impliedVolatility,
  onVolatilityChange,
  calculatedIV,
  onResetIV,
}: RangeVolatilitySlidersProps) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-6">
        {/* Range slider */}
        <div className="flex items-center gap-3 flex-1">
          <Label className="text-xs font-semibold whitespace-nowrap">RANGE:</Label>
          <Slider
            value={[range]}
            onValueChange={([value]) => onRangeChange(value)}
            min={0.1}
            max={50}
            step={0.1}
            className="flex-1"
            data-testid="slider-range"
          />
          <span className="text-xs font-mono font-semibold w-14 text-right">±{range.toFixed(1)}%</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* IV slider */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-1">
            <Label className="text-xs font-semibold whitespace-nowrap">IV:</Label>
            {calculatedIV && (
              <span className="text-[10px] text-muted-foreground" data-testid="text-base-iv">
                ({calculatedIV}%)
              </span>
            )}
          </div>
          <Slider
            value={[impliedVolatility]}
            onValueChange={([value]) => onVolatilityChange(value)}
            min={10}
            max={100}
            step={1}
            className="flex-1"
            data-testid="slider-volatility"
          />
          <span className="text-xs font-mono font-semibold w-8 text-right" data-testid="text-current-iv">{impliedVolatility}%</span>
          {onResetIV && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onResetIV}
              className="h-6 w-6"
              data-testid="button-reset-iv"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
