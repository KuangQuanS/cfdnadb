import { NavLink } from "react-router-dom";
import type { PropsWithChildren } from "react";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browse" },
  { to: "/downloads", label: "Downloads" },
  { to: "/visualizations", label: "Visualizations" },
  { to: "/about", label: "About" }
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="site-kicker">cfDNA academic resource</p>
          <NavLink to="/" className="site-title">
            cfDNA Atlas
          </NavLink>
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
      </header>
      <main className="page-content">{children}</main>
      <footer className="site-footer">
        <span>Designed for cfDNA data browsing, download and summary visualization.</span>
        <span>Prototype structure for NAR-style database submission.</span>
      </footer>
    </div>
  );
}
