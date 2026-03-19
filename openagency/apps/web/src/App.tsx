import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
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
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { VisionPage } from './pages/VisionPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { AssistantPage } from './pages/AssistantPage';
import { HistoryPage } from './pages/HistoryPage';
import { DataPage } from './pages/DataPage';
import { McpMarketplacePage } from './pages/McpMarketplacePage';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { ProfilePage } from './pages/settings/ProfilePage';
import { UsersPage } from './pages/settings/UsersPage';
import { BillingSettingsPage } from './pages/settings/BillingSettingsPage';
import { NotificationsPage } from './pages/settings/NotificationsPage';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';

// ─── Demo pages (from landing-scorecard_Plinth, hardcoded investor data) ─────
import DemoCommandCenter from './pages/demo/CommandCenter';
import DemoWasteWaterfall from './pages/demo/WasteWaterfall';
import DemoMediaArchitect from './pages/demo/MediaArchitect';
import DemoCampaignOps from './pages/demo/CampaignOps';
import DemoExecutiveBridge from './pages/demo/ExecutiveBridge';
import DemoRecoveryScorecard from './pages/demo/RecoveryScorecard';
import DemoPlatforms from './pages/demo/Platforms';
import DemoArchitecture from './pages/demo/Architecture';
import DemoConsumption from './pages/demo/Consumption';
import DemoBilling from './pages/demo/Billing';

// ─── /app/* route subtree ─────────────────────────────────────────────────────
// Real backend, requires VITE_API_URL. Uses the openagency Layout sidebar.
function AppRoutes() {
  return (
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="onboarding" element={<OnboardingPage />} />
      <Route path="assistant" element={<AssistantPage />} />
      <Route path="assistant/:id" element={<AssistantPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="scorecard" element={<ScorecardPage />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="command-center" element={<CommandCenterPage />} />
      <Route path="leak-detector" element={<LeakDetectorPage />} />
      <Route path="media-architect" element={<MediaArchitectPage />} />
      <Route path="campaign-ops" element={<CampaignOpsPage />} />
      <Route path="executive-bridge" element={<ExecutiveBridgePage />} />
      <Route path="integrations" element={<IntegrationsPage />} />
      <Route path="data" element={<DataPage />} />
      <Route path="marketplace" element={<McpMarketplacePage />} />
      <Route path="architecture" element={<ArchitecturePage />} />
      <Route path="consumption" element={<ConsumptionPage />} />
      <Route path="admin" element={<SuperAdminDashboard />} />
      <Route path="settings" element={<SettingsLayout />}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="billing" element={<BillingSettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
    </Route>
  );
}

export function App() {
  return (
    <Routes>
      {/* Root — landing page */}
      <Route index element={<LandingPage />} />

      {/* /login — authentication screen */}
      <Route path="login" element={<LoginPage />} />

      {/* /accept-invite — invite acceptance page */}
      <Route path="accept-invite" element={<AcceptInvitePage />} />

      {/* /vision — cinematic vision page */}
      <Route path="vision" element={<VisionPage />} />

      {/* /demo/* — investor demo room (landing-scorecard_Plinth pages, hardcoded) */}
      <Route path="demo" element={<DemoCommandCenter />} />
      <Route path="demo/waste" element={<DemoWasteWaterfall />} />
      <Route path="demo/media-architect" element={<DemoMediaArchitect />} />
      <Route path="demo/campaign-ops" element={<DemoCampaignOps />} />
      <Route path="demo/executive-bridge" element={<DemoExecutiveBridge />} />
      <Route path="demo/recovery" element={<DemoRecoveryScorecard />} />
      <Route path="demo/platforms" element={<DemoPlatforms />} />
      <Route path="demo/architecture" element={<DemoArchitecture />} />
      <Route path="demo/consumption" element={<DemoConsumption />} />
      <Route path="demo/billing" element={<DemoBilling />} />

      {/* /app/* — real backend connected dashboard */}
      <Route path="app">{AppRoutes()}</Route>

      {/* OAuth callback — outside layout */}
      <Route path="auth/callback" element={<AuthCallbackPage />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
