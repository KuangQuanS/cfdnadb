import type { SVGProps } from "react";
import {
  NeurologyOutline,
  EarsNoseAndThroatOutline,
  LungsOutline,
  BreastsOutline,
  ThyroidOutline,
  KidneysOutline,
  FemaleReproductiveSystemOutline,
  CervicalCancerOutline,
  BladderOutline,
  ColonOutline,
  LiverOutline,
  StomachOutline,
  OesophagusCancerOutline,
  PancreasOutline,
  HeartOrganOutline
} from "healthicons-react";

export function OrganIcon({ organ, ...props }: { organ: string } & SVGProps<SVGSVGElement>) {
  switch (organ) {
    case "brain":
      return <NeurologyOutline {...props} />;
    case "headAndNeck":
      return <EarsNoseAndThroatOutline {...props} />;
    case "lung":
      return <LungsOutline {...props} />;
    case "breast":
      return <BreastsOutline {...props} />;
    case "thyroid":
      return <ThyroidOutline {...props} />;
    case "kidney":
      return <KidneysOutline {...props} />;
    case "ovarian":
    case "endometrial":
      return <FemaleReproductiveSystemOutline {...props} />;
    case "cervical":
      return <CervicalCancerOutline {...props} />;
    case "bladder":
      return <BladderOutline {...props} />;
    case "colorectal":
      return <ColonOutline {...props} />;
    case "liver":
      return <LiverOutline {...props} />;
    case "gastric":
      return <StomachOutline {...props} />;
    case "esophageal":
      return <OesophagusCancerOutline {...props} />;
    case "pancreatic":
      return <PancreasOutline {...props} />;
    default:
      return <HeartOrganOutline {...props} />;
  }
}
