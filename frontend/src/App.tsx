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
const AboutPage = lazy(() => import("./pages/AboutPage").then((module) => ({ default: module.AboutPage })));
const MutationAnalysisPage = lazy(() => import("./pages/MutationAnalysisPage").then((module) => ({ default: module.MutationAnalysisPage })));

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader message="Loading page..." />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/gene-search" element={<GeneSearchPage />} />
          <Route path="/gene-search/:markerDbId" element={<GeneMarkerDetailPage />} />
          <Route path="/mutation-analysis" element={<MutationAnalysisPage />} />
          <Route path="/studies/:id" element={<StudyDetailPage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
