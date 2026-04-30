import type { SVGProps } from "react";

export function OrganIcon({ organ, ...props }: { organ: string } & SVGProps<SVGSVGElement>) {
  switch (organ) {
    case "brain":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M9.5 2h5M12 2v20M6 10a6 6 0 0 1 12 0c0 4-3 5-3 5s-2-1-3-1-3 1-3 1-3-1-3-5a6 6 0 0 1 0-10" />
        </svg>
      );
    case "lung":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M12 2v6M9 8c-3 0-5 3-4 7s4 6 4 6v-7c0-2 1-3 1-3M15 8c3 0 5 3 4 7s-4 6-4 6v-7c0-2-1-3-1-3" />
        </svg>
      );
    case "breast":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0M12 12v.01" />
        </svg>
      );
    case "thyroid":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M12 10c-2 0-4-1-6-3-1 3 0 6 3 8l3 2 3-2c3-2 4-5 3-8-2 2-4 3-6 3z" />
        </svg>
      );
    case "kidney":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M6 10c0-4.4 2.6-8 6-8s6 3.6 6 8-1 6-2 7-3 3-4 3-3-2-4-3-2-2.6-2-7" />
        </svg>
      );
    case "ovarian":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 18v6M9 21h6" />
        </svg>
      );
    case "bladder":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M12 4c-4 0-7 4-7 9a6 6 0 0 0 12 0c0-5-3-9-7-9zM12 19v3" />
        </svg>
      );
    case "colorectal":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M7 6h10v10a5 5 0 0 1-10 0V6zM12 16v6" />
        </svg>
      );
    case "liver":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M5 14c-1.5 0-3-1-3-3s2-3 4-3h8c3 0 6 2 6 5s-2 5-5 5c-3 0-6 1-8 2-1 0-2-2-2-6z" />
        </svg>
      );
    case "gastric":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M12 4c-3 0-5 3-5 7 0 2 1 4 3 5l2 1 3-1c3-2 4-6 2-9-1-2-3-3-5-3z" />
        </svg>
      );
    case "pancreatic":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M4 12c0-3 3-5 6-5 4 0 7 2 9 4 2 3-1 6-5 6-4 0-7-2-10-5z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
