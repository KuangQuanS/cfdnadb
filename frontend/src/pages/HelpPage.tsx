import { Link } from "react-router-dom";

const HELP_ITEMS = [
  {
    title: "Browse",
    description: "Browse is cohort-centric. Use it to open oncoplots and summary PDFs for a selected cohort and data source.",
    action: "/browse",
    actionLabel: "Open Browse"
  },
  {
    title: "Statistics",
    description: "Statistics is the database-wide overview. Use it to compare cohort size, file availability, and mutation distributions across the whole database.",
    action: "/statistics",
    actionLabel: "Open Statistics"
  },
  {
    title: "Gene Search",
    description: "Gene Search is gene-centric. Query a gene to see which cohorts and samples carry mutations in that gene.",
    action: "/gene-search",
    actionLabel: "Open Gene Search"
  },
  {
    title: "Downloads",
    description: "Downloads combines whole-cohort files and filtered sample-level multianno export. Use it when you need actual files rather than visual summaries.",
    action: "/downloads",
    actionLabel: "Open Downloads"
  }
];

export function HelpPage() {
  return (
    <div className="page-stack">
      <section>
        <p className="section-eyebrow">Help</p>
        <h2 style={{ fontSize: "2.2rem", color: "var(--accent)", margin: "8px 0 16px" }}>Using cfdnadb</h2>
        <p style={{ fontSize: "1.08rem", color: "var(--muted)", maxWidth: 860, lineHeight: 1.8 }}>
          cfdnadb is organized around three complementary views: gene-centric search, cohort-centric browse, and sample-centric download filtering.
          Use this page as a quick guide to which workflow fits your question.
        </p>
      </section>

      <section className="detail-grid">
        {HELP_ITEMS.map((item) => (
          <article key={item.title} className="detail-card prose-block">
            <p className="section-eyebrow">{item.title}</p>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <Link to={item.action} className="button-secondary inline-button">{item.actionLabel}</Link>
          </article>
        ))}
      </section>

      <section className="detail-card prose-block">
        <p className="section-eyebrow">Typical tasks</p>
        <h3>Where to go for common questions</h3>
        <ul className="help-list">
          <li>“This gene mutates in which samples?” → <Link to="/gene-search">Gene Search</Link></li>
          <li>“This cohort looks like what overall?” → <Link to="/browse">Browse</Link></li>
          <li>“Across the whole database, which cohorts dominate?” → <Link to="/statistics">Statistics</Link></li>
          <li>“I need the multianno files for a filtered sample subset.” → <Link to="/downloads">Downloads</Link></li>
        </ul>
      </section>
    </div>
  );
}
