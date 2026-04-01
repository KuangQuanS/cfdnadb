import { NavLink, Link } from "react-router-dom";
import type { PropsWithChildren } from "react";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browse" },
  { to: "/mutation-analysis", label: "Mutation Analysis" },
  { to: "/downloads", label: "Downloads" },
  { to: "/about", label: "About" }
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-container">
          <div className="title-area">
            <p className="site-kicker">Academic Resource Portal</p>
            <Link to="/" className="site-title">cfDNA Atlas</Link>
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

      <main className="page-content">{children}</main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <p className="footer-logo">cfDNA Atlas</p>
            <p>
              A curated database of somatic mutations identified from circulating cell-free DNA across multiple cancer cohorts. Built to support liquid biopsy research, biomarker discovery, and cross-cohort comparative genomics.
            </p>
            <div className="badge-row">
              <span className="badge">hg38</span>
              <span className="badge">ANNOVAR</span>
              <span className="badge">MuTect2</span>
              <span className="badge warm">cfDNA</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Navigation</h4>
            <ul>
              {navItems.map((item) => (
                <li key={item.to}><Link to={item.to}>{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>Cohorts</h4>
            <ul>
              {["Breast", "Colorectal", "Liver", "Lung", "PDAC"].map((c) => (
                <li key={c}>
                  <Link to={`/mutation-analysis?cancer=${c === "Colorectal" ? "Colonrector" : c}`}>{c}</Link>
                </li>
              ))}
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

        <div className="footer-bottom">
          <div className="footer-bottom-inner">
            <span>
              &copy; {new Date().getFullYear()} cfDNA Atlas &mdash; Lee Laboratory, Kunming Medical University.
              Data is provided for academic research use only.
            </span>
            <span>
              <Link to="/about">Citation</Link>
              &nbsp;&middot;&nbsp;
              <Link to="/downloads">Data access</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
