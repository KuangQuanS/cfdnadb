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
          <p>{item.label}</p>
          <strong>{item.value}</strong>
          {item.meta ? <span>{item.meta}</span> : null}
        </article>
      ))}
    </div>
  );
}
