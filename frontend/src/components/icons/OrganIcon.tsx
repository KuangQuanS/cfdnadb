import type { SVGProps } from "react";
import {
  NeurologyOutline,
  LungsOutline,
  BreastsOutline,
  ThyroidOutline,
  KidneysOutline,
  FemaleReproductiveSystemOutline,
  BladderOutline,
  ColonOutline,
  LiverOutline,
  StomachOutline,
  PancreasOutline,
  HeartOrganOutline
} from "healthicons-react";

export function OrganIcon({ organ, ...props }: { organ: string } & SVGProps<SVGSVGElement>) {
  switch (organ) {
    case "brain":
      return <NeurologyOutline {...props} />;
    case "lung":
      return <LungsOutline {...props} />;
    case "breast":
      return <BreastsOutline {...props} />;
    case "thyroid":
      return <ThyroidOutline {...props} />;
    case "kidney":
      return <KidneysOutline {...props} />;
    case "ovarian":
      return <FemaleReproductiveSystemOutline {...props} />;
    case "bladder":
      return <BladderOutline {...props} />;
    case "colorectal":
      return <ColonOutline {...props} />;
    case "liver":
      return <LiverOutline {...props} />;
    case "gastric":
      return <StomachOutline {...props} />;
    case "pancreatic":
      return <PancreasOutline {...props} />;
    default:
      return <HeartOrganOutline {...props} />;
  }
}

