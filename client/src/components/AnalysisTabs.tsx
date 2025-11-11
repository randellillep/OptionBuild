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
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="greeks" className="text-xs" data-testid="tab-greeks">
          <Activity className="h-3 w-3 mr-1" />
          Greeks
        </TabsTrigger>
        <TabsTrigger value="expected-move" className="text-xs" data-testid="tab-expected-move">
          <TrendingUp className="h-3 w-3 mr-1" />
          Expected Move
        </TabsTrigger>
        <TabsTrigger value="volatility-skew" className="text-xs" data-testid="tab-volatility-skew">
          <BarChart3 className="h-3 w-3 mr-1" />
          Volatility Skew
        </TabsTrigger>
        <TabsTrigger value="option-overview" className="text-xs" data-testid="tab-option-overview">
          <FileText className="h-3 w-3 mr-1" />
          Option Overview
        </TabsTrigger>
        <TabsTrigger value="analysis" className="text-xs" data-testid="tab-analysis">
          <PieChart className="h-3 w-3 mr-1" />
          Analysis
        </TabsTrigger>
        <TabsTrigger value="open-interest" className="text-xs" data-testid="tab-open-interest">
          <Users className="h-3 w-3 mr-1" />
          Open Interest
        </TabsTrigger>
      </TabsList>

      <TabsContent value="greeks" className="mt-6">
        <GreeksDashboard greeks={greeks} />
      </TabsContent>

      <TabsContent value="expected-move" className="mt-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Expected Move</h3>
          <p className="text-sm text-muted-foreground">
            Expected move analysis based on implied volatility and time to expiration.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">1 Standard Deviation</p>
              <p className="text-2xl font-bold font-mono">±$5.20</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">2 Standard Deviations</p>
              <p className="text-2xl font-bold font-mono">±$10.40</p>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="volatility-skew" className="mt-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Volatility Skew</h3>
          <p className="text-sm text-muted-foreground">
            Implied volatility across different strike prices.
          </p>
          <div className="mt-4 h-64 flex items-center justify-center bg-muted/30 rounded-md">
            <p className="text-muted-foreground">Volatility skew chart visualization</p>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="option-overview" className="mt-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Option Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
              <span className="text-sm font-medium">Total Contracts</span>
              <span className="text-sm font-mono font-semibold">2</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
              <span className="text-sm font-medium">Total Premium</span>
              <span className="text-sm font-mono font-semibold">$350.00</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-md">
              <span className="text-sm font-medium">Margin Requirement</span>
              <span className="text-sm font-mono font-semibold">$2,500.00</span>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="analysis" className="mt-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Strategy Analysis</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Detailed analysis of your options strategy performance.
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
              <p className="text-xl font-bold">68%</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Average Return</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-500">+12.3%</p>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="open-interest" className="mt-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Open Interest</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Volume and open interest data for selected options.
          </p>
          <div className="mt-4 h-64 flex items-center justify-center bg-muted/30 rounded-md">
            <p className="text-muted-foreground">Open interest chart visualization</p>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
