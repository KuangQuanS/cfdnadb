import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { PageLoader } from "./PageLoader";
import headerBgPng from "../assets/background.jpg";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browse" },
  { to: "/gene-search", label: "Gene Search" },
  { to: "/statistics", label: "Statistics" },
  { to: "/survival", label: "Survival" },
  { to: "/downloads", label: "Downloads" },
  { to: "/help", label: "Help" },
  { to: "/about", label: "About" }
];

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
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
          backgroundImage: `linear-gradient(90deg, rgba(75, 53, 154, 0.94), rgba(75, 53, 154, 0.9)), url(${headerBgPng})`
        }}
      >
        <div className="header-container">
          <div className="title-area">
            <div className="title-stack">
              <p className="site-kicker">Plasma somatic mutation database</p>
              <Link to="/" className="site-title">cfDNAdb</Link>
            </div>
          </div>
          <nav className="site-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
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
              Plasma cfDNA somatic mutation database spanning cohort browse, gene search, and downloadable analysis outputs.
            </p>
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

        <div className="footer-bottom">
          <div className="footer-bottom-inner">
            <span>
              &copy; {new Date().getFullYear()} cfdnadb &mdash; Lee Laboratory, Kunming Medical University.
              Data is provided for academic research use only.
            </span>
            <span>
              <Link to="/about">Citation</Link>
              &nbsp;&middot;&nbsp;
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
