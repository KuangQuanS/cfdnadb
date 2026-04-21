import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { PageLoader } from "./PageLoader";
import headerBgPng from "../assets/background_original.png";
import siteLogoPng from "../assets/cfDNAlogo.png";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browse" },
  { to: "/statistics", label: "Statistics" },
  { to: "/downloads", label: "Downloads" },
  { to: "/help", label: "Help" }
];

function GeneMenu({ geneMenuActive }: { geneMenuActive: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  const dismiss = () => {
    setDismissed(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <div
      className={`site-nav-dropdown${dismissed ? " site-nav-dropdown-dismissed" : ""}`}
      onMouseLeave={() => setDismissed(false)}
    >
      <Link
        className={`nav-link nav-link-menu${geneMenuActive ? " active" : ""}`}
        to="/gene-search"
        onClick={dismiss}
        aria-haspopup="menu"
      >
        Gene Search
        <svg className="nav-caret" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <div className="site-nav-dropdown-menu" role="menu" aria-label="Gene tools">
        <NavLink
          to="/gene-search"
          onClick={dismiss}
          className={({ isActive }) => `site-nav-dropdown-link${isActive ? " active" : ""}`}
        >
          Gene Search
        </NavLink>
        <NavLink
          to="/survival"
          onClick={dismiss}
          className={({ isActive }) => `site-nav-dropdown-link${isActive ? " active" : ""}`}
        >
          Survival Analysis
        </NavLink>
      </div>
    </div>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const geneMenuActive = location.pathname.startsWith("/gene-search") || location.pathname.startsWith("/survival");
  const [routeLoading, setRouteLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const firstRenderRef = useRef(true);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    setRouteLoading(true);
    const timer = window.setTimeout(() => setRouteLoading(false), 260);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  const busy = routeLoading;

  useEffect(() => {
    let timer: number | undefined;

    if (busy && !showLoader) {
      timer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setShowLoader(true);
      }, 120);
    } else if (!busy && showLoader) {
      const elapsed = Date.now() - shownAtRef.current;
      timer = window.setTimeout(() => setShowLoader(false), Math.max(0, 240 - elapsed));
    }

    if (!busy && !showLoader) {
      setShowLoader(false);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [busy, showLoader]);

  return (
    <div className="app-shell">
      {showLoader ? <PageLoader overlay message="Loading page..." /> : null}

      <header
        className="site-header"
        style={{
          backgroundImage: `url(${headerBgPng})`
        }}
      >
        <div className="header-container">
          <div className="title-area">
            <div className="title-stack">
              <Link to="/" className="site-logo-link" aria-label="cfDNAdb Home">
                <img src={siteLogoPng} alt="cfDNAdb" className="site-logo-img" />
              </Link>
            </div>
          </div>
          <nav className="site-nav">
            {navItems.slice(0, 2).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}

            <GeneMenu geneMenuActive={geneMenuActive} />

            {navItems.slice(2).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className={`page-content${showLoader ? " page-content-loading" : ""}`}>{children}</main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <p className="footer-logo">cfdnadb</p>
            <p>
              A curated academic database of somatic mutations identified from plasma cell-free DNA across multiple cancer cohorts. Built to support liquid biopsy research, biomarker discovery, and cross-cohort comparative genomics.
            </p>
            <p className="footer-badges">
              <span className="footer-badge">hg38</span>
              <span className="footer-badge">MuTect2</span>
              <span className="footer-badge">ANNOVAR</span>
              <span className="footer-badge">Liquid biopsy</span>
              <span className="footer-badge">Open access</span>
            </p>
          </div>

          <div className="footer-col">
            <h4>Data</h4>
            <ul>
              <li>Plasma cfDNA, hg38 reference</li>
              <li>Targeted panel &amp; whole-exome sequencing</li>
              <li>Somatic SNVs and small indels</li>
              <li>Per-cohort aggregate files available for download</li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Methods</h4>
            <ul>
              <li>Alignment: BWA-MEM + GATK4 BQSR</li>
              <li>Calling: MuTect2 tumor-only + PoN + FilterMutectCalls</li>
              <li>Annotation: ANNOVAR (refGene, gnomAD, ClinVar)</li>
              <li>Query: embedded DuckDB JDBC over cohort aggregates</li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Institution</h4>
            <address>
              Lee Laboratory<br />
              Kunming Medical University<br />
              Kunming, Yunnan, China<br />
              <br />
              <a href="https://leelab.kmmu.edu.cn/cfdnadb/" style={{ color: "rgba(255,255,255,0.6)" }}>
                leelab.kmmu.edu.cn
              </a>
            </address>
          </div>
        </div>

        <div className="footer-citation">
          <div className="footer-citation-inner">
            <h4>Citation</h4>
            <p>
              Lee Lab. cfdnadb: a multi-cohort somatic variant database for circulating cell-free DNA research.
              Kunming Medical University. 2025. <a href="https://leelab.kmmu.edu.cn/cfdnadb/">https://leelab.kmmu.edu.cn/cfdnadb/</a>
            </p>
            <p className="footer-terms">
              Academic and non-commercial research use only. Variant calls are computational predictions and have not been individually validated — perform appropriate validation before reporting findings in a clinical context.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-inner">
            <span>
              &copy; {new Date().getFullYear()} cfdnadb &mdash; Lee Laboratory, Kunming Medical University.
            </span>
            <span>
              <Link to="/downloads">Data access</Link>
              &nbsp;&middot;&nbsp;
              <Link to="/help">Help</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
