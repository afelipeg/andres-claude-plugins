import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// ─── Eager imports (landing experience + auth — must load instantly) ──────────
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { VisionPage } from './pages/VisionPage';

// ─── Demo pages (eager — investor-facing, must load instantly) ───────────────
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

// ─── Lazy /app/* pages (code-split per route) ───────────────────────────────
// All pages use named exports, so we remap them to default for React.lazy.
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const AssistantPage = lazy(() => import('./pages/AssistantPage').then(m => ({ default: m.AssistantPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const ScorecardPage = lazy(() => import('./pages/ScorecardPage').then(m => ({ default: m.ScorecardPage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const CommandCenterPage = lazy(() => import('./pages/CommandCenterPage').then(m => ({ default: m.CommandCenterPage })));
const LeakDetectorPage = lazy(() => import('./pages/LeakDetectorPage').then(m => ({ default: m.LeakDetectorPage })));
const MediaArchitectPage = lazy(() => import('./pages/MediaArchitectPage').then(m => ({ default: m.MediaArchitectPage })));
const CampaignOpsPage = lazy(() => import('./pages/CampaignOpsPage').then(m => ({ default: m.CampaignOpsPage })));
const ExecutiveBridgePage = lazy(() => import('./pages/ExecutiveBridgePage').then(m => ({ default: m.ExecutiveBridgePage })));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const DataPage = lazy(() => import('./pages/DataPage').then(m => ({ default: m.DataPage })));
const McpMarketplacePage = lazy(() => import('./pages/McpMarketplacePage').then(m => ({ default: m.McpMarketplacePage })));
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage').then(m => ({ default: m.ArchitecturePage })));
const ConsumptionPage = lazy(() => import('./pages/ConsumptionPage').then(m => ({ default: m.ConsumptionPage })));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const AgencyDashboard = lazy(() => import('./pages/AgencyDashboard').then(m => ({ default: m.AgencyDashboard })));

// Settings sub-pages
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const ProfilePage = lazy(() => import('./pages/settings/ProfilePage').then(m => ({ default: m.ProfilePage })));
const UsersPage = lazy(() => import('./pages/settings/UsersPage').then(m => ({ default: m.UsersPage })));
const BillingSettingsPage = lazy(() => import('./pages/settings/BillingSettingsPage').then(m => ({ default: m.BillingSettingsPage })));
const NotificationsPage = lazy(() => import('./pages/settings/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const UsageLimitsPage = lazy(() => import('./pages/settings/UsageLimitsPage').then(m => ({ default: m.UsageLimitsPage })));

// ─── Loading fallback ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center" style={{ height: '60vh' }}>
      <div className="text-center text-zinc-400">
        <div
          className="mx-auto mb-3 h-8 w-8 rounded-full border-[3px] border-zinc-200 border-t-blue-800 animate-spin"
        />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}

// ─── /app/* route subtree ─────────────────────────────────────────────────────
// Real backend, requires VITE_API_URL. Uses the openagency Layout sidebar.
function AppRoutes() {
  return (
    <Route element={<Layout />}>
      <Route index element={<Suspense fallback={<PageLoader />}><HomePage /></Suspense>} />
      <Route path="onboarding" element={<Suspense fallback={<PageLoader />}><OnboardingPage /></Suspense>} />
      <Route path="assistant" element={<Suspense fallback={<PageLoader />}><AssistantPage /></Suspense>} />
      <Route path="assistant/:id" element={<Suspense fallback={<PageLoader />}><AssistantPage /></Suspense>} />
      <Route path="history" element={<Suspense fallback={<PageLoader />}><HistoryPage /></Suspense>} />
      <Route path="scorecard" element={<Suspense fallback={<PageLoader />}><ScorecardPage /></Suspense>} />
      <Route path="billing" element={<Suspense fallback={<PageLoader />}><BillingPage /></Suspense>} />
      <Route path="command-center" element={<Suspense fallback={<PageLoader />}><CommandCenterPage /></Suspense>} />
      <Route path="leak-detector" element={<Suspense fallback={<PageLoader />}><LeakDetectorPage /></Suspense>} />
      <Route path="media-architect" element={<Suspense fallback={<PageLoader />}><MediaArchitectPage /></Suspense>} />
      <Route path="campaign-ops" element={<Suspense fallback={<PageLoader />}><CampaignOpsPage /></Suspense>} />
      <Route path="executive-bridge" element={<Suspense fallback={<PageLoader />}><ExecutiveBridgePage /></Suspense>} />
      <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />
      <Route path="data" element={<Suspense fallback={<PageLoader />}><DataPage /></Suspense>} />
      <Route path="marketplace" element={<Suspense fallback={<PageLoader />}><McpMarketplacePage /></Suspense>} />
      <Route path="architecture" element={<Suspense fallback={<PageLoader />}><ArchitecturePage /></Suspense>} />
      <Route path="consumption" element={<Suspense fallback={<PageLoader />}><ConsumptionPage /></Suspense>} />
      <Route path="admin" element={<Suspense fallback={<PageLoader />}><SuperAdminDashboard /></Suspense>} />
      <Route path="agency-dashboard" element={<Suspense fallback={<PageLoader />}><AgencyDashboard /></Suspense>} />
      <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsLayout /></Suspense>}>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
        <Route path="billing" element={<Suspense fallback={<PageLoader />}><BillingSettingsPage /></Suspense>} />
        <Route path="notifications" element={<Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>} />
        <Route path="usage" element={<Suspense fallback={<PageLoader />}><UsageLimitsPage /></Suspense>} />
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
