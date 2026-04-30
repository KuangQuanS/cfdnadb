import { Link } from "react-router-dom";
import { SectionHeader } from "../components/SectionHeader";
import tutorialFlowchart from "../assets/tutorial.png";
import browserTutorial from "../assets/tutorial/browser.png";
import geneSearchTutorial from "../assets/tutorial/gene_search.png";
import survivalTutorial from "../assets/tutorial/survival.png";
import vafTutorial from "../assets/tutorial/VAF.png";

const GUIDE_LINKS = [
  { href: "#orientation", label: "Overview" },
  { href: "#browse", label: "Browse" },
  { href: "#gene-search", label: "Gene Search" },
  { href: "#statistics", label: "Statistics" },
  { href: "#survival", label: "Survival Analysis" },
  { href: "#vaf", label: "VAF Analysis" },
  { href: "#downloads", label: "Download" },
];

export function HelpPage() {
  return (
    <div className="page-stack help-page">
      <SectionHeader
        eyebrow="Help"
        title="Using ctDNAdb"
        description="Guidance for cohort browsing, gene queries, database summaries, survival analysis, VAF analysis, and file downloads."
      />

      <div className="help-layout">
        <aside className="help-toc" aria-label="Help contents">
          <p className="section-eyebrow">Contents</p>
          <nav>
            {GUIDE_LINKS.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
        </aside>

        <article className="detail-card prose-block help-article">
          <section id="orientation">
            <p className="section-eyebrow">Orientation</p>
            <h3>Workflow Overview</h3>
            <figure className="help-flowchart">
              <img src={tutorialFlowchart} alt="ctDNAdb workflow overview" />
            </figure>
            <p>
              ctDNAdb organizes cfDNA mutation data by cohort, gene, sample, and downloadable file. Select a workflow from the analysis
              goal: <Link to="/browse">Browse</Link> for cohort inspection, <Link to="/gene-search">Gene Search</Link> for gene-level
              records, <Link to="/statistics">Statistics</Link> for database summaries, <Link to="/survival">Survival Analysis</Link>
              for TCGA-associated plots, and <Link to="/downloads">Download</Link> for mounted files.
            </p>
          </section>

          <section id="browse">
            <h3>Browse</h3>
            <figure className="help-tutorial-figure">
              <img src={browserTutorial} alt="Browse tutorial showing cohort, source, gene input, oncoplot, and summary plots" />
            </figure>
            <p>
              Browse is the cohort view. Choose a cancer cohort, select the data source, and optionally enter genes to focus the oncoplot.
              The oncoplot displays samples by column, genes by row, and mutation classes by color. The summary plots below provide
              cohort-level mutation distributions and exportable figures.
            </p>
            <ol>
              <li>Select the cohort and data source.</li>
              <li>Enter genes when a focused view is required.</li>
              <li>Use the oncoplot for recurrent mutation patterns.</li>
              <li>Use summary plots for cohort-level mutation profiles.</li>
            </ol>
          </section>

          <section id="gene-search">
            <h3>Gene Search</h3>
            <figure className="help-tutorial-figure">
              <img src={geneSearchTutorial} alt="Gene Search tutorial showing source filters, gene results, and gene detail records" />
            </figure>
            <p>
              Gene Search retrieves mutation records for a submitted gene symbol. Source, cancer type, chromosome, variant classification,
              and variant type filters refine the table. Open a gene result to review the gene detail page, including genome-browser
              context, sample-level mutation records, and available downloads.
            </p>
          </section>

          <section id="statistics">
            <h3>Statistics</h3>
            <p>
              Statistics summarizes the database across cohorts and sources. Use it to review sample counts, file coverage, annotated
              variants, mutation burden, top genes, functional categories, exonic categories, chromosome distributions, and VAF patterns
              before starting a focused analysis.
            </p>
          </section>

          <section id="survival">
            <h3>Survival Analysis</h3>
            <figure className="help-tutorial-figure">
              <img src={survivalTutorial} alt="Survival tutorial showing gene detail entry, plot selection, TCGA cohort selection, and Kaplan-Meier results" />
            </figure>
            <p>
              Survival Analysis can be opened from a gene detail page or accessed directly. Enter the gene symbol, select the time unit,
              choose the plot types, and select one TCGA cohort. The output includes Kaplan-Meier curves by mutation status and mutation
              type, with at-risk tables and downloadable PNG or PDF figures.
            </p>
          </section>

          <section id="vaf">
            <h3>VAF Analysis</h3>
            <figure className="help-tutorial-figure">
              <img src={vafTutorial} alt="VAF tutorial showing VAF by stage, VAF by mutation type, methylation, and CTC expression plots" />
            </figure>
            <p>
              VAF Analysis compares variant allele frequency by pathologic stage and mutation type for the selected gene and TCGA cohort.
              The same result area can also show methylation and CTC expression boxplots across cancer types when those plot types are
              selected. Hover tooltips report the grouped values used in each boxplot.
            </p>
          </section>

          <section id="downloads">
            <h3>Download</h3>
            <p>
              Download provides cohort-level resources and sample-level mounted files. Use the filters to define the sample set, open a
              sample drawer for its files, or select multiple rows for grouped export when file links are available.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
