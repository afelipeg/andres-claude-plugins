import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LeakDetectorPage } from './pages/LeakDetectorPage';
import { MediaArchitectPage } from './pages/MediaArchitectPage';
import { CampaignOpsPage } from './pages/CampaignOpsPage';
import { ExecutiveBridgePage } from './pages/ExecutiveBridgePage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="leak-detector" element={<LeakDetectorPage />} />
        <Route path="media-architect" element={<MediaArchitectPage />} />
        <Route path="campaign-ops" element={<CampaignOpsPage />} />
        <Route path="executive-bridge" element={<ExecutiveBridgePage />} />
      </Route>
    </Routes>
  );
}
