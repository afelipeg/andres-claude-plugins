import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LeakDetectorPage } from './pages/LeakDetectorPage';
import { MediaArchitectPage } from './pages/MediaArchitectPage';
import { CampaignOpsPage } from './pages/CampaignOpsPage';
import { ExecutiveBridgePage } from './pages/ExecutiveBridgePage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { ScorecardPage } from './pages/ScorecardPage';
import { BillingPage } from './pages/BillingPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { ConsumptionPage } from './pages/ConsumptionPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';

// ─── Shared route subtree ────────────────────────────────────────────
// Rendered under both /demo/* and /app/*.
// /demo/* — hardcoded investor demo room (in-browser engines, no API key needed).
// /app/*  — real backend, requires VITE_API_URL + VITE_API_KEY in the environment.
function AppRoutes() {
  return (
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="scorecard" element={<ScorecardPage />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="command-center" element={<CommandCenterPage />} />
      <Route path="leak-detector" element={<LeakDetectorPage />} />
      <Route path="media-architect" element={<MediaArchitectPage />} />
      <Route path="campaign-ops" element={<CampaignOpsPage />} />
      <Route path="executive-bridge" element={<ExecutiveBridgePage />} />
      <Route path="integrations" element={<IntegrationsPage />} />
      <Route path="architecture" element={<ArchitecturePage />} />
      <Route path="consumption" element={<ConsumptionPage />} />
    </Route>
  );
}

export function App() {
  return (
    <Routes>
      {/* Root — redirect to demo room */}
      <Route index element={<Navigate to="/demo" replace />} />

      {/* /demo/* — investor demo room, hardcoded data, no backend required */}
      <Route path="demo">{AppRoutes()}</Route>

      {/* /app/* — real backend connected dashboard (requires VITE_API_URL) */}
      <Route path="app">{AppRoutes()}</Route>

      {/* OAuth callback — outside layout */}
      <Route path="auth/callback" element={<AuthCallbackPage />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/demo" replace />} />
    </Routes>
  );
}
