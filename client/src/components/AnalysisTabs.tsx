import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Activity, TrendingUp, BarChart3, FileText, PieChart, Users } from "lucide-react";
import type { Greeks } from "@shared/schema";
import { GreeksDashboard } from "./GreeksDashboard";

interface AnalysisTabsProps {
  greeks: Greeks;
}

export function AnalysisTabs({ greeks }: AnalysisTabsProps) {
  return (
    <Tabs defaultValue="greeks" className="w-full">
      <TabsList className="grid w-full grid-cols-6 h-7">
        <TabsTrigger value="greeks" className="text-[10px] h-6" data-testid="tab-greeks">
          <Activity className="h-2.5 w-2.5 mr-0.5" />
          Greeks
        </TabsTrigger>
        <TabsTrigger value="expected-move" className="text-[10px] h-6" data-testid="tab-expected-move">
          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
          Expected
        </TabsTrigger>
        <TabsTrigger value="volatility-skew" className="text-[10px] h-6" data-testid="tab-volatility-skew">
          <BarChart3 className="h-2.5 w-2.5 mr-0.5" />
          Vol Skew
        </TabsTrigger>
        <TabsTrigger value="option-overview" className="text-[10px] h-6" data-testid="tab-option-overview">
          <FileText className="h-2.5 w-2.5 mr-0.5" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="analysis" className="text-[10px] h-6" data-testid="tab-analysis">
          <PieChart className="h-2.5 w-2.5 mr-0.5" />
          Analysis
        </TabsTrigger>
        <TabsTrigger value="open-interest" className="text-[10px] h-6" data-testid="tab-open-interest">
          <Users className="h-2.5 w-2.5 mr-0.5" />
          OI
        </TabsTrigger>
      </TabsList>

      <TabsContent value="greeks" className="mt-2">
        <GreeksDashboard greeks={greeks} />
      </TabsContent>

      <TabsContent value="expected-move" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Expected Move</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-0.5">1 Standard Deviation</p>
              <p className="text-lg font-bold font-mono">±$5.20</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-0.5">2 Standard Deviations</p>
              <p className="text-lg font-bold font-mono">±$10.40</p>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="volatility-skew" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Volatility Skew</h3>
          <div className="h-32 flex items-center justify-center bg-muted/30 rounded-md">
            <p className="text-xs text-muted-foreground">Volatility skew chart</p>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="option-overview" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Option Overview</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <span className="text-xs font-medium">Total Contracts</span>
              <span className="text-xs font-mono font-semibold">2</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <span className="text-xs font-medium">Total Premium</span>
              <span className="text-xs font-mono font-semibold">$350.00</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted/30 rounded-md">
              <span className="text-xs font-medium">Margin Requirement</span>
              <span className="text-xs font-mono font-semibold">$2,500.00</span>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="analysis" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Strategy Analysis</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-0.5">Win Rate</p>
              <p className="text-lg font-bold">68%</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-md">
              <p className="text-[10px] text-muted-foreground mb-0.5">Average Return</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-500">+12.3%</p>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="open-interest" className="mt-2">
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Open Interest</h3>
          <div className="h-32 flex items-center justify-center bg-muted/30 rounded-md">
            <p className="text-xs text-muted-foreground">Open interest chart</p>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
