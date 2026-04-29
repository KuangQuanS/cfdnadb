import { useEffect, useRef, useState, type CSSProperties, type PropsWithChildren } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { PageLoader } from "./PageLoader";
import headerBgPng from "../assets/background_original.png";
import siteLogoPng from "../assets/ctDNAdb-logo.png";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browser" },
  { to: "/statistics", label: "Statistics" },
  { to: "/downloads", label: "Download" },
  { to: "/help", label: "Tutorial" }
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
        Tools
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
        style={
          {
            "--header-bg-image": `url(${headerBgPng})`
          } as CSSProperties
        }
      >
        <div className="header-container">
          <Link to="/" className="header-brand" aria-label="ctDNAdb home">
            <img src={siteLogoPng} alt="ctDNAdb" className="header-brand-logo" />
          </Link>
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
        <div className="footer-bottom">
          <div className="footer-bottom-inner">
            <span>
              &copy; 2026 ctDNAdb &mdash; Lee Laboratory, Kunming Medical University.
            </span>
            <span>
              <a href="mailto:lijie@kmmu.edu.cn" style={{ color: "rgba(255,255,255,0.8)" }}>Contact Us</a>
              &nbsp;&middot;&nbsp;
              <a href="https://leelab.kmmu.edu.cn/leelabindex/" style={{ color: "rgba(255,255,255,0.8)" }} target="_blank" rel="noopener noreferrer">LabIndex</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
