import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface RangeVolatilitySlidersProps {
  range: number;
  onRangeChange: (value: number) => void;
  impliedVolatility: number;
  onVolatilityChange: (value: number) => void;
}

export function RangeVolatilitySliders({
  range,
  onRangeChange,
  impliedVolatility,
  onVolatilityChange,
}: RangeVolatilitySlidersProps) {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">RANGE:</Label>
            <span className="text-sm font-mono font-semibold">±{range}%</span>
          </div>
          <Slider
            value={[range]}
            onValueChange={([value]) => onRangeChange(value)}
            min={5}
            max={50}
            step={1}
            className="w-full"
            data-testid="slider-range"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>5%</span>
            <span>50%</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">IMPLIED VOLATILITY:</Label>
            <span className="text-sm font-mono font-semibold">{impliedVolatility}%</span>
          </div>
          <Slider
            value={[impliedVolatility]}
            onValueChange={([value]) => onVolatilityChange(value)}
            min={10}
            max={100}
            step={1}
            className="w-full"
            data-testid="slider-volatility"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>10%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
