import { useEffect, useRef, useState, type CSSProperties, type PropsWithChildren } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { PageLoader } from "./PageLoader";
import headerBgPng from "../assets/background.jpg";
import siteLogoPng from "../assets/ctDNAdb-logo.png";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browser" },
  { to: "/statistics", label: "Statistics" },
  { to: "/downloads", label: "Download" },
  { to: "/tutorial", label: "Tutorial" }
];

const breadcrumbLabels: Array<[string, string]> = [
  ["/browse", "Data Browser"],
  ["/statistics", "Statistic"],
  ["/gene-search", "Gene Search"],
  ["/survival", "Survival Analysis"],
  ["/vaf-analysis", "ctDNA VAF"],
  ["/downloads", "Download"],
  ["/tutorial", "Tutorial"],
  ["/help", "Tutorial"],
  ["/studies", "Study Detail"],
];

function VisitorMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.id = "mapmyvisitors";
    script.src = "https://mapmyvisitors.com/map.js?d=oKaSLVePNdgXFoqOaGCJyhsVnZm0JLTieq3Lbb7Aaco&cl=ffffff&w=a";
    script.async = true;
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="footer-visitor-map" ref={containerRef} aria-label="Visit tracker">
      <a href="https://mapmyvisitors.com/web/1c4h3" title="Visit tracker" target="_blank" rel="noopener noreferrer">
        <img src="https://mapmyvisitors.com/map.png?d=oKaSLVePNdgXFoqOaGCJyhsVnZm0JLTieq3Lbb7Aaco&cl=ffffff" alt="Visit tracker" />
      </a>
    </div>
  );
}

function getBreadcrumbLabel(pathname: string) {
  if (pathname === "/") return null;
  return breadcrumbLabels.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Page";
}

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
        <NavLink
          to="/vaf-analysis"
          onClick={dismiss}
          className={({ isActive }) => `site-nav-dropdown-link${isActive ? " active" : ""}`}
        >
          ctDNA VAF
        </NavLink>
      </div>
    </div>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const breadcrumbLabel = getBreadcrumbLabel(location.pathname);
  const geneMenuActive =
    location.pathname.startsWith("/gene-search") ||
    location.pathname.startsWith("/survival") ||
    location.pathname.startsWith("/vaf-analysis");
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

      {breadcrumbLabel ? (
        <div className="site-breadcrumb-bar" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>{breadcrumbLabel}</span>
        </div>
      ) : null}

      <main
        key={location.pathname}
        className={`page-content page-content-route${showLoader ? " page-content-loading" : ""}`}
      >
        {children}
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <section className="footer-col footer-col--explore" aria-label="Explore ctDNAdb">
            <h4>Explore</h4>
            <div className="footer-link-grid">
              <Link to="/">Home</Link>
              <Link to="/browse">Browser</Link>
              <Link to="/gene-search">Gene Search</Link>
              <Link to="/statistics">Statistics</Link>
              <Link to="/downloads">Download</Link>
              <Link to="/tutorial">Tutorial</Link>
              <Link to="/survival">Survival Analysis</Link>
              <Link to="/vaf-analysis">ctDNA VAF</Link>
            </div>
          </section>

          <section className="footer-col footer-col--contact" aria-label="Contact information">
            <h4>Contact Info</h4>
            <address>
              Lee Laboratory, Kunming Medical University
              <br />
              Kunming, Yunnan, China
              <br />
              <a href="mailto:lijie@kmmu.edu.cn">lijie@kmmu.edu.cn</a>
            </address>
            <p className="footer-copyright">
              &copy; 2026 ctDNAdb &mdash; Lee Laboratory, Kunming Medical University.
            </p>
          </section>

          <section className="footer-map-card" aria-label="Visitor map">
            <VisitorMap />
          </section>
        </div>
      </footer>
    </div>
  );
}
