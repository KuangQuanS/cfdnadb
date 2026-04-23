import { Link } from "react-router-dom";
import { SectionHeader } from "../components/SectionHeader";
import tutorialFlowchart from "../assets/tutorial.png";

const GUIDE_LINKS = [
  { href: "#orientation", label: "Orientation" },
  { href: "#browse", label: "Browse" },
  { href: "#gene-search", label: "Gene Search" },
  { href: "#statistics", label: "Statistics" },
  { href: "#survival", label: "Survival" },
  { href: "#downloads", label: "Download" },
  { href: "#sources", label: "Data sources" },
  { href: "#troubleshooting", label: "Troubleshooting" },
];

export function HelpPage() {
  return (
    <div className="page-stack help-page">
      <SectionHeader
        eyebrow="Help"
        title="Using cfDNAdb"
        description="A practical guide to browsing cohorts, querying genes, reading statistics, running survival views, and downloading mounted files from cfDNAdb."
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
            <h3>What cfDNAdb is built for</h3>
            <figure className="help-flowchart">
              <img src={tutorialFlowchart} alt="cfDNAdb tutorial workflow flowchart" />
            </figure>
            <p>
              cfDNAdb is a plasma somatic mutation database organized around cohorts, genes, samples, and downloadable analysis files.
              The database brings together Internal Data cohorts, GEO-derived public cfDNA cohorts, TCGA reference mutation data, and healthy
              VCF files so that users can move from a broad cohort overview to a concrete file download without leaving the application.
            </p>
            <p>
              The fastest way to choose a workflow is to start from the question you are asking. Use <Link to="/browse">Browse</Link> when
              you want to inspect one cancer cohort visually. Use <Link to="/gene-search">Gene Search</Link> when the question starts with
              a gene symbol. Use <Link to="/statistics">Statistics</Link> when you want database-wide counts and distributions.
              Use <Link to="/survival">Survival Analysis</Link> when you want TCGA survival context or multi-omics expression comparisons.
              Use <Link to="/downloads">Download</Link> when you need the underlying files.
            </p>
          </section>

          <section id="browse">
            <h3>Browse: inspect one cohort at a time</h3>
            <p>
              Browse is the cohort-centered view. Select a cancer type first, then select a data source. The page loads an interactive
              oncoplot and the available maftools PDF summaries for that cohort and source. The oncoplot ranks genes by how many samples
              carry a mutation, displays samples as columns, and colors each cell by the most severe variant class observed for that
              gene-sample pair.
            </p>
            <p>
              The source selector currently exposes Internal Data, GEO, and TCGA. Internal Data represents the internal cohort files.
              GEO uses GEO mutation rows for the interactive oncoplot and GEO-specific PDF plots when those files exist. TCGA uses the
              TCGA mutation table and TCGA plot assets. If a source has no PDF for a given cohort, the oncoplot can still appear if the
              mutation rows are present in the DuckDB query database.
            </p>
            <ol>
              <li>Open Browse and choose the cancer cohort, for example Breast or Colorectal.</li>
              <li>Choose Internal Data, GEO, or TCGA from Data Source.</li>
              <li>Read the oncoplot first to identify recurrently mutated genes and mutation-class patterns.</li>
              <li>Scroll to Summary Plots for cohort-level PDF summaries such as mutation spectrum, Ti/Tv, and maftools summary views.</li>
            </ol>
          </section>

          <section id="gene-search">
            <h3>Gene Search: start from a gene symbol</h3>
            <p>
              Gene Search is gene-centered. Enter a gene symbol such as TP53, KRAS, EGFR, PIK3CA, or APC to retrieve matching mutation
              records across the selected source. The result table is intended for row-level inspection: each row carries the gene,
              cancer type, chromosome, coordinate, alleles, variant class, variant type, sample barcode, and annotation fields when
              available.
            </p>
            <p>
              Use the filters to narrow the result to cancer types, chromosomes, variant classifications, and variant types. The summary
              metrics above the table update with the current query and help distinguish a broad recurrent signal from a sparse
              one-sample result. Selecting a gene detail page gives a more focused view for that gene across Internal Data and TCGA contexts.
            </p>
          </section>

          <section id="statistics">
            <h3>Statistics: read the database as a whole</h3>
            <p>
              Statistics is the database-wide dashboard. It is designed for comparing cohort size, data-file coverage, annotated variants,
              mutation burden, top genes, functional distributions, exonic distributions, chromosome distributions, and VAF patterns.
              The page is useful before detailed analysis because it shows which cohorts dominate the database and where the data are
              most complete.
            </p>
            <p>
              Healthy samples are included in sample and data-file summaries, because the healthy collection contributes VCF files and
              sample counts. Healthy samples are not included in mutation, annotation, oncoplot, VAF, functional, exonic, or chromosome
              mutation summaries because the healthy VCF collection is treated as a normal-reference file set rather than a tumor mutation
              cohort.
            </p>
          </section>

          <section id="survival">
            <h3>Survival Analysis: TCGA context and multi-omics boxplots</h3>
            <p>
              Survival Analysis connects mutation status with clinical survival context for supported TCGA cohorts. Choose a TCGA cohort,
              enter a gene, and select the survival endpoint. The page separates patients into mutation-positive and mutation-negative
              groups, then renders Kaplan-Meier curves and a compact statistical summary.
            </p>
            <p>
              The same page also includes multi-omics boxplots from mounted database files, including methylation resources and CTC-related
              expression data. These boxplots are not survival curves; they are cross-cancer expression or signal distributions that help
              place a queried gene in a broader molecular context.
            </p>
          </section>

          <section id="downloads">
            <h3>Download: move from visual evidence to files</h3>
            <p>
              Download has two different jobs. The All Downloads view lists cohort-level resources, including mutation tables and summary
              resources. Healthy VCF download controls are temporarily hidden while that workflow is being revised.
            </p>
            <p>
              Filtered Download is sample-centered. Use the cohort and source chips to define a sample set, type in the sample search box
              when you know part of a barcode, click a sample row to open its drawer, and download mounted files from the drawer. Select
              multiple rows when you want to export several mounted files together. Filter chips update the table directly, so the sample
              table should reflect the selected cohort and source immediately.
            </p>
          </section>

          <section id="sources">
            <h3>How to interpret data sources</h3>
            <dl className="help-definition-list">
              <div>
                <dt>Internal Data</dt>
                <dd>The internal cohort collection. In Browse, Internal Data uses the internal statistics plots and internal mutation rows.</dd>
              </div>
              <div>
                <dt>GEO</dt>
                <dd>Public GEO-derived cfDNA cohorts. GEO oncoplots are generated from GEO mutation rows in the query database.</dd>
              </div>
              <div>
                <dt>TCGA</dt>
                <dd>Reference tumor mutation and survival context from TCGA. TCGA is independent from Internal Data and GEO source switching.</dd>
              </div>
              <div>
                <dt>Healthy</dt>
                <dd>Healthy VCF files mounted from the healthy sample directory. Healthy contributes sample and file counts, not tumor mutation counts.</dd>
              </div>
            </dl>
          </section>

          <section id="troubleshooting">
            <h3>Troubleshooting and expected behavior</h3>
            <p>
              If a PDF does not appear in Browse, first check whether that source actually has PDF assets for the selected cohort. A source
              can have mutation rows for the oncoplot but no PDF summary files. If GEO and Internal Data oncoplots look identical after deployment,
              the server may still be using an older WAR or an older DuckDB file that does not contain the current geo_maf table.
            </p>
            <p>
              If a static asset returns 404 after deployment, the browser is usually requesting a hashed frontend bundle from a previous
              build. A hard refresh or a redeployed WAR with the matching dist assets resolves that case. If healthy downloads appear
              slow, remember that individual VCF files can be large and the full healthy VCF collection is intentionally not zipped as a
              single archive.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
