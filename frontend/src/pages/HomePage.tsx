import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HeroCarousel } from "../components/HeroCarousel";
import "../styles/home.css";

const TOOL_TILES = [
  {
    id: "01",
    title: "Browser",
    desc: "Cohort overview and sample records.",
    link: "/browse",
    preview: "browse",
  },
  {
    id: "02",
    title: "Gene Search",
    desc: "Gene-level mutation query.",
    link: "/gene-search",
    preview: "search",
  },
  {
    id: "03",
    title: "Statistics",
    desc: "Cohort summary statistics.",
    link: "/statistics",
    preview: "statistics",
  },
  {
    id: "04",
    title: "Survival",
    desc: "TCGA survival and VAF analysis.",
    link: "/survival",
    preview: "survival",
  },
] as const;

const SPHERE_TAGS = [
  { gene: "TTN", hue: "#285ea8", size: 1.12 },
  { gene: "MUC12", hue: "#6c63d9", size: 1.04 },
  { gene: "OBSCN", hue: "#1f8f7a", size: 1.04 },
  { gene: "HRNR", hue: "#c05692", size: 1.02 },
  { gene: "EPPK1", hue: "#d07a1f", size: 1.02 },
  { gene: "HMCN2", hue: "#3f73c9", size: 1.02 },
  { gene: "FLG", hue: "#8a4fd4", size: 1 },
  { gene: "MUC5AC", hue: "#198f86", size: 1.12 },
  { gene: "MUC5B", hue: "#da5f7c", size: 1.08 },
  { gene: "MUC16", hue: "#a86a16", size: 1.08 },
  { gene: "RYR1", hue: "#4f7bd8", size: 1.02 },
  { gene: "KMT2D", hue: "#7a57c7", size: 1.02 },
  { gene: "LRP1", hue: "#1b8c70", size: 1.02 },
  { gene: "AHNAK", hue: "#d24f8d", size: 1.08 },
  { gene: "AHNAK2", hue: "#d6842b", size: 1.08 },
  { gene: "LAMA5", hue: "#3267b3", size: 1.02 },
  { gene: "MAP1A", hue: "#715fd0", size: 1.02 },
  { gene: "MUC17", hue: "#168c82", size: 1.08 },
  { gene: "NYNRIN", hue: "#c85683", size: 0.98 },
  { gene: "PKD1", hue: "#cc7b22", size: 1.04 },
  { gene: "STARD9", hue: "#4c76cb", size: 1.02 },
  { gene: "TACC2", hue: "#8153ce", size: 1.02 },
  { gene: "ADAMTSL3", hue: "#2e987f", size: 0.98 },
  { gene: "CACNA1S", hue: "#dc6289", size: 0.98 },
  { gene: "FAT2", hue: "#cd8b2b", size: 1 },
  { gene: "HSPG2", hue: "#2c67bc", size: 0.98 },
  { gene: "MEGF6", hue: "#8b61d8", size: 0.98 },
  { gene: "MST1L", hue: "#269676", size: 0.98 },
  { gene: "SEC16A", hue: "#bf5d95", size: 0.96 },
  { gene: "USP17L20", hue: "#d18b31", size: 0.92 },
  { gene: "BSN", hue: "#2e61ad", size: 0.96 },
  { gene: "CAD", hue: "#7f54c9", size: 0.96 },
  { gene: "CECR2", hue: "#19907c", size: 0.96 },
  { gene: "CREBBP", hue: "#d05789", size: 0.96 },
  { gene: "DLEC1", hue: "#c17b2b", size: 0.96 },
  { gene: "DNAH1", hue: "#4172c6", size: 0.96 },
  { gene: "DNAH17", hue: "#8663d5", size: 0.94 },
  { gene: "DYSF", hue: "#239171", size: 0.94 },
  { gene: "E4F1", hue: "#cb588f", size: 0.94 },
  { gene: "FAT3", hue: "#d88b25", size: 0.94 },
] as const;

type SphereProjection = {
  gene: string;
  color: string;
  left: number;
  top: number;
  scale: number;
  opacity: number;
  zIndex: number;
};

function RotatingTagSphere() {
  const frameRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const pointsRef = useRef(
    SPHERE_TAGS.map((tag, index) => {
      const phi = Math.acos(1 - (2 * (index + 0.5)) / SPHERE_TAGS.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5);
      return {
        ...tag,
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
      };
    }),
  );
  const [projected, setProjected] = useState<SphereProjection[]>([]);

  useEffect(() => {
    const tick = () => {
      const speed = hoveredRef.current ? 0.001 : 0.002;
      const cosY = Math.cos(speed);
      const sinY = Math.sin(speed);
      const cosX = Math.cos(speed * 0.5);
      const sinX = Math.sin(speed * 0.5);

      pointsRef.current = pointsRef.current.map((point) => {
        const rx = point.x * cosY - point.z * sinY;
        const rz = point.x * sinY + point.z * cosY;
        const ry = point.y * cosX - rz * sinX;
        const nz = point.y * sinX + rz * cosX;
        return { ...point, x: rx, y: ry, z: nz };
      });

      const next = pointsRef.current
        .map((point) => {
          const depth = (point.z + 1) / 2;
          const scale = 0.62 + depth * 0.72;
          return {
            gene: point.gene,
            color: point.hue,
            left: 50 + point.x * 34,
            top: 50 + point.y * 30,
            scale: scale * point.size,
            opacity: 0.28 + depth * 0.72,
            zIndex: Math.round(depth * 100),
          };
        })
        .sort((a, b) => a.zIndex - b.zIndex);

      setProjected(next);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div
      className="portal-tag-sphere"
      onMouseEnter={() => { hoveredRef.current = true; }}
      onMouseLeave={() => { hoveredRef.current = false; }}
    >
      {projected.map((tag) => (
        <Link
          key={tag.gene}
          className="portal-tag-sphere-label"
          to={`/gene-search?source=cfDNA&gene=${encodeURIComponent(tag.gene)}`}
          aria-label={`Open gene search for ${tag.gene}`}
          style={{
            left: `${tag.left}%`,
            top: `${tag.top}%`,
            color: tag.color,
            opacity: tag.opacity,
            zIndex: tag.zIndex,
            transform: `translate(-50%, -50%) scale(${tag.scale})`,
          }}
        >
          {tag.gene}
        </Link>
      ))}
    </div>
  );
}

export function HomePage() {
  return (
    <>
      <HeroCarousel />

      <main className="portal-home">
        <section className="portal-showcase-section animate-fade-up animate-fade-up-2">
          <div className="portal-section-inner">
            <div className="portal-showcase-band">
              <div className="portal-showcase-band-grid">
                {TOOL_TILES.map((tool) => (
                  <Link key={tool.title} to={tool.link} className="portal-tool-tile">
                    <div className={`portal-tool-preview portal-tool-preview--${tool.preview}`} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="portal-tool-caption">
                      <strong>{tool.title}</strong>
                      <p>{tool.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
