import { useLayoutEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type PdfPagePreviewProps = {
  file: string;
  className?: string;
  pageClassName?: string;
  width?: number;
  autoWidth?: boolean;
  minWidth?: number;
  padding?: number;
  loadingLabel?: string | null;
  errorLabel?: string | null;
};

export function PdfPagePreview({
  file,
  className = "",
  pageClassName = "",
  width,
  autoWidth = false,
  minWidth = 320,
  padding = 0,
  loadingLabel = "Loading PDF preview...",
  errorLabel = "Unable to load this PDF preview.",
}: PdfPagePreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(width ?? minWidth);

  useLayoutEffect(() => {
    if (!autoWidth) return;

    const element = wrapperRef.current;
    if (!element) return;

    const updateWidth = () => {
      setMeasuredWidth(Math.max(minWidth, Math.floor(element.clientWidth - padding)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [autoWidth, minWidth, padding]);

  const pageWidth = autoWidth ? measuredWidth : (width ?? measuredWidth);

  return (
    <div className={className} ref={wrapperRef}>
      <Document
        file={file}
        loading={loadingLabel ? <p className="panel-note">{loadingLabel}</p> : null}
        error={errorLabel ? <p className="panel-note">{errorLabel}</p> : null}
      >
        <Page
          pageNumber={1}
          width={pageWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className={pageClassName}
        />
      </Document>
    </div>
  );
}
