import { SectionHeader } from "../components/SectionHeader";

export function AboutPage() {
  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="About"
        title="Citation and database context"
        description="A reserved page for manuscript-facing summary text, update notes and recommended citation."
      />
      <section className="detail-card prose-block">
        <h3>Recommended citation</h3>
        <p>cfDNA Atlas Consortium. cfDNA Atlas: an academic resource for curated circulating cell-free DNA studies and biomarker evidence. Manuscript in preparation.</p>
        <h3>Scope</h3>
        <p>The current scaffold is designed for public data browsing, downloadable releases and summary visualization. It deliberately avoids heavy product styling in favor of a restrained academic presentation.</p>
        <h3>Planned extensions</h3>
        <p>Future iterations can add full import pipelines, richer study collections, cohort-level plots, and manuscript-specific pages once the real dataset is finalized.</p>
      </section>
    </div>
  );
}
