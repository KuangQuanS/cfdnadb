type GeneSymbolProps = {
  symbol: string;
  className?: string;
};

export function GeneSymbol({ symbol, className = "" }: GeneSymbolProps) {
  return <span className={`gene-symbol${className ? ` ${className}` : ""}`}>{symbol}</span>;
}

