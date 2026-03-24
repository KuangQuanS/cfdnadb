interface StatItem {
  label: string;
  value: string;
  meta?: string;
}

interface StatGridProps {
  items: StatItem[];
}

export function StatGrid({ items }: StatGridProps) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <article key={item.label} className="stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.meta ? <p className="file-size">{item.meta}</p> : null}
        </article>
      ))}
    </div>
  );
}
