import { NavLink, Link } from "react-router-dom";
import type { PropsWithChildren } from "react";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browse" },
  { to: "/vcf-demo", label: "VCF Demo" },
  { to: "/downloads", label: "Downloads" },
  { to: "/visualizations", label: "Visualizations" },
  { to: "/about", label: "About" }
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-container">
          <div className="title-area">
            <p className="site-kicker">Academic Resource Portal</p>
            <Link to="/" className="site-title">
              cfDNA Atlas
            </Link>
          </div>
          <nav className="site-nav">
            {navItems.map((item) => (
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
      
      <main className="page-content">{children}</main>
      
      <footer className="site-footer">
        <div className="footer-container">
          <span>cfDNA Atlas &copy; 2026. Designed for data browsing, visualization, and reproducible access.</span>
          <span>Prototype for high-impact journal database submission (e.g., NAR).</span>
        </div>
      </footer>
    </div>
  );
}
