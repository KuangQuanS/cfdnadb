import { Link } from "react-router-dom";
import tutorialFlowchart from "../assets/ctdnadb.png";
import browserTutorial from "../assets/tutorial/browser.png";
import cfdnaVafTutorial from "../assets/tutorial/cfdna_vaf.png";
import downloadTutorial from "../assets/tutorial/download.png";
import geneSearchTutorial from "../assets/tutorial/gene_search.png";
import survivalTutorial from "../assets/tutorial/survival.png";

const GUIDE_LINKS = [
  { href: "#orientation", label: "Overview" },
  { href: "#browser", label: "Browser" },
  { href: "#gene-search", label: "Gene Search" },
  { href: "#statistics", label: "Statistics" },
  { href: "#survival", label: "Survival Analysis" },
  { href: "#vaf", label: "ctDNA VAF" },
  { href: "#downloads", label: "Download" },
];

export function TutorialPage() {
  return (
    <div className="page-stack help-page">
      <div className="help-layout">
        <aside className="help-toc" aria-label="Tutorial contents">
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
              <img src={tutorialFlowchart} alt="ctDNAdb workflow overview" loading="lazy" decoding="async" />
            </figure>
            <p>
              ctDNAdb organizes ctDNA mutation data by cohort, gene, sample, and downloadable file. Select a workflow from the analysis
              goal: <Link to="/browse">Browser</Link> for cohort inspection, <Link to="/gene-search">Gene Search</Link> for gene-level
              records, <Link to="/statistics">Statistics</Link> for database summaries, <Link to="/survival">Survival Analysis</Link>
              for TCGA-associated plots, <Link to="/vaf-analysis">ctDNA VAF</Link> for gene-level VAF patterns, and <Link to="/downloads">Download</Link> for mounted files.
            </p>
          </section>

          <section id="browser">
            <h3>Browser</h3>
            <figure className="help-tutorial-figure">
              <img src={browserTutorial} alt="Browser tutorial showing cohort, source, gene input, oncoplot, and summary plots" loading="lazy" decoding="async" />
            </figure>
            <p>
              Browser is the cohort view. Choose a cancer cohort, select the data source, and optionally enter genes to focus the oncoplot.
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
              <img src={geneSearchTutorial} alt="Gene Search tutorial showing source filters, gene results, and gene detail records" loading="lazy" decoding="async" />
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
              <img src={survivalTutorial} alt="Survival tutorial showing gene detail entry, plot selection, TCGA cohort selection, and Kaplan-Meier results" loading="lazy" decoding="async" />
            </figure>
            <p>
              Survival Analysis can be opened from a gene detail page or accessed directly. Enter the gene symbol, select the time unit,
              choose the plot types, and select one TCGA cohort. The output includes Kaplan-Meier curves by mutation status and mutation
              type, with at-risk tables and downloadable PNG or PDF figures.
            </p>
          </section>

          <section id="vaf">
            <h3>ctDNA VAF</h3>
            <figure className="help-tutorial-figure">
              <img src={cfdnaVafTutorial} alt="ctDNA VAF tutorial showing gene input, VAF body map, result table, and boxplots" loading="lazy" decoding="async" />
            </figure>
            <p>
              ctDNA VAF compares gene-level variant allele frequency across mounted private ctDNA cohorts. The body map highlights
              cohort-level mean VAF, and the boxplots summarize distributions by cancer type and mutation type.
            </p>
            <ol>
              <li>Enter a gene symbol and submit it to generate the VAF profile.</li>
              <li>Use the organ map to compare mean VAF across available cancer cohorts.</li>
              <li>Review the cohort table for mean, median, maximum VAF, and sample counts.</li>
              <li>Use the boxplots to inspect VAF distributions by cancer type and mutation type.</li>
            </ol>
          </section>

          <section id="downloads">
            <h3>Download</h3>
            <figure className="help-tutorial-figure">
              <img src={downloadTutorial} alt="Download tutorial showing cohort-level files, filters, and sample-level export controls" loading="lazy" decoding="async" />
            </figure>
            <p>
              Download provides cohort-level resources and sample-level mounted files. Use the filters to define the sample set, open a
              sample drawer for its files, or select multiple rows for grouped export when file links are available.
            </p>
            <ol>
              <li>Switch between cohort-level resources and sample-level files.</li>
              <li>Filter cohort resources by cohort name or file type.</li>
              <li>Download cohort files directly from the table when a file link is available.</li>
              <li>Use sample-level filters to narrow samples, open file details, and export selected files.</li>
            </ol>
          </section>
        </article>
      </div>
    </div>
  );
}
