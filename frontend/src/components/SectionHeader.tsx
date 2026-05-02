interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
    </div>
  );
}
