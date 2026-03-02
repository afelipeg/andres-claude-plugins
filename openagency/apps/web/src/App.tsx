import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LeakDetectorPage } from './pages/LeakDetectorPage';
import { MediaArchitectPage } from './pages/MediaArchitectPage';
import { CampaignOpsPage } from './pages/CampaignOpsPage';
import { ExecutiveBridgePage } from './pages/ExecutiveBridgePage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="command-center" element={<CommandCenterPage />} />
        <Route path="leak-detector" element={<LeakDetectorPage />} />
        <Route path="media-architect" element={<MediaArchitectPage />} />
        <Route path="campaign-ops" element={<CampaignOpsPage />} />
        <Route path="executive-bridge" element={<ExecutiveBridgePage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
      </Route>
      <Route path="auth/callback" element={<AuthCallbackPage />} />
    </Routes>
  );
}
