import type { SVGProps } from "react";
import type { ScaleType } from "@/core/scale-engine";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function CircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2v2M14 8h-2M8 14v-2M2 8h2" />
    </svg>
  );
}

export function SemicircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 11a6 6 0 0 1 12 0" />
      <path d="M2 11h12M8 5v2M4.2 7.2l1.4 1.4M11.8 7.2l-1.4 1.4" />
    </svg>
  );
}

export function ArcIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 12.5A6 6 0 1 1 12.5 12.5" />
      <path d="M8 2v2M2.4 10.5l1.9-.6M13.6 10.5l-1.9-.6" />
    </svg>
  );
}

export function LinearIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 6h12" />
      <path d="M3 6v4M5.5 6v2.5M8 6v4M10.5 6v2.5M13 6v4" />
    </svg>
  );
}

export function ScaleTypeIcon({ type, ...props }: IconProps & { type: ScaleType }) {
  switch (type) {
    case "circle":
      return <CircleIcon {...props} />;
    case "semicircle":
      return <SemicircleIcon {...props} />;
    case "arc":
      return <ArcIcon {...props} />;
    default:
      return <LinearIcon {...props} />;
  }
}
