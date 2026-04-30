import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { PageLoader } from "./components/PageLoader";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const BrowsePage = lazy(() => import("./pages/BrowsePage").then((module) => ({ default: module.BrowsePage })));
const GeneSearchPage = lazy(() => import("./pages/GeneSearchPage").then((module) => ({ default: module.GeneSearchPage })));
const GeneMarkerDetailPage = lazy(() => import("./pages/GeneMarkerDetailPage").then((module) => ({ default: module.GeneMarkerDetailPage })));
const StudyDetailPage = lazy(() => import("./pages/StudyDetailPage").then((module) => ({ default: module.StudyDetailPage })));
const DownloadsPage = lazy(() => import("./pages/DownloadsPage").then((module) => ({ default: module.DownloadsPage })));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage").then((module) => ({ default: module.StatisticsPage })));
const HelpPage = lazy(() => import("./pages/HelpPage").then((module) => ({ default: module.HelpPage })));
const SurvivalAnalysisPage = lazy(() => import("./pages/SurvivalAnalysisPage").then((module) => ({ default: module.SurvivalAnalysisPage })));
const VafAnalysisPage = lazy(() => import("./pages/VafAnalysisPage").then((module) => ({ default: module.VafAnalysisPage })));

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader message="Loading page..." />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/gene-search" element={<GeneSearchPage />} />
          <Route path="/gene-search/:geneSymbol" element={<GeneMarkerDetailPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/survival" element={<SurvivalAnalysisPage />} />
          <Route path="/vaf-analysis" element={<VafAnalysisPage />} />
          <Route path="/studies/:id" element={<StudyDetailPage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
