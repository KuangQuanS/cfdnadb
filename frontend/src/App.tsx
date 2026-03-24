import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { BrowsePage } from "./pages/BrowsePage";
import { StudyDetailPage } from "./pages/StudyDetailPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { VisualizationsPage } from "./pages/VisualizationsPage";
import { AboutPage } from "./pages/AboutPage";
import { VcfDemoPage } from "./pages/VcfDemoPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/vcf-demo" element={<VcfDemoPage />} />
        <Route path="/studies/:id" element={<StudyDetailPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="/visualizations" element={<VisualizationsPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </AppShell>
  );
}
