interface PageLoaderProps {
  message?: string;
  overlay?: boolean;
}

export function PageLoader({ message = "Loading...", overlay = false }: PageLoaderProps) {
  return (
    <div className={`page-loader${overlay ? " page-loader-overlay" : ""}`}>
      <div className="page-loader-card">
        <div className="page-loader-spinner" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>{message}</p>
      </div>
    </div>
  );
}
