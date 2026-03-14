import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CommandCenter from "./pages/demo/CommandCenter";
import WasteWaterfall from "./pages/demo/WasteWaterfall";
import RecoveryScorecard from "./pages/demo/RecoveryScorecard";
import Platforms from "./pages/demo/Platforms";
import Architecture from "./pages/demo/Architecture";
import MediaArchitect from "./pages/demo/MediaArchitect";
import CampaignOps from "./pages/demo/CampaignOps";
import ExecutiveBridge from "./pages/demo/ExecutiveBridge";
import Consumption from "./pages/demo/Consumption";
import BillingPage from "./pages/demo/Billing";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/demo"} component={CommandCenter} />
      <Route path={"/demo/waste"} component={WasteWaterfall} />
      <Route path={"/demo/media-architect"} component={MediaArchitect} />
      <Route path={"/demo/campaign-ops"} component={CampaignOps} />
      <Route path={"/demo/executive-bridge"} component={ExecutiveBridge} />
      <Route path={"/demo/recovery"} component={RecoveryScorecard} />
      <Route path={"/demo/platforms"} component={Platforms} />
      <Route path={"/demo/architecture"} component={Architecture} />
      <Route path={"/demo/consumption"} component={Consumption} />
      <Route path={"/demo/billing"} component={BillingPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
