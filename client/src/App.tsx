import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Builder from "@/pages/Builder";
import Login from "@/pages/Login";
import Backtest from "@/pages/Backtest";
import OptionFinder from "@/pages/OptionFinder";
import SavedTrades from "@/pages/SavedTrades";
import Share from "@/pages/Share";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/builder" component={Builder} />
      <Route path="/login" component={Login} />
      <Route path="/backtest" component={Backtest} />
      <Route path="/option-finder" component={OptionFinder} />
      <Route path="/saved-trades" component={SavedTrades} />
      <Route path="/share/:encoded" component={Share} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
