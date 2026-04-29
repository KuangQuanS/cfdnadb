interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title }: SectionHeaderProps) {
  return (
    <div className="section-header">
      {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
    </div>
  );
}
