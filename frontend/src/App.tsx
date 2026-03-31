import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { BrowsePage } from "./pages/BrowsePage";
import { StudyDetailPage } from "./pages/StudyDetailPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { AboutPage } from "./pages/AboutPage";
import { GeneSearchPage } from "./pages/GeneSearchPage";
import { MutationAnalysisPage } from "./pages/MutationAnalysisPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/gene-search" element={<GeneSearchPage />} />
        <Route path="/mutation-analysis" element={<MutationAnalysisPage />} />
        <Route path="/studies/:id" element={<StudyDetailPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </AppShell>
  );
}
