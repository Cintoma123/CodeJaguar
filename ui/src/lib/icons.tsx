
import type { SVGProps } from "react";

/**
 * Inline Tabler-style icons (CLAUDE.md uses Tabler outline). Kept as a local
 * set so the site ships with zero icon dependencies — stroke `currentColor`,
 * so colour comes from the parent's `text-*` class.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Hexagon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19.875 6.27c.7.398 1.13 1.143 1.125 1.948v7.564c0 .802-.43 1.544-1.125 1.948l-6.75 3.943a2.28 2.28 0 0 1-2.25 0l-6.75-3.943A2.25 2.25 0 0 1 3 15.782V8.218c0-.802.43-1.544 1.125-1.948l6.75-3.943a2.28 2.28 0 0 1 2.25 0z" />
    </Base>
  );
}

export function Code(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m7 8-4 4 4 4" />
      <path d="m17 8 4 4-4 4" />
      <path d="M14 4 10 20" />
    </Base>
  );
}

export function Shield(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3 4 6v6c0 4.5 3.2 7.5 8 9 4.8-1.5 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </Base>
  );
}

export function Layers(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </Base>
  );
}

export function PullRequest(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 8.5v7" />
      <path d="M18 15.5V11a3 3 0 0 0-3-3h-3m0 0 2.5-2.5M12 8l2.5 2.5" />
    </Base>
  );
}

export function Lock(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </Base>
  );
}

export function Consensus(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.5 12 3 3 6-6" />
    </Base>
  );
}

export function Desktop(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Base>
  );
}

export function Key(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9" />
      <path d="m16 16 2-2M18.5 18.5 21 16" />
    </Base>
  );
}

export function EyeOff(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10.6 6.1A9 9 0 0 1 12 6c4.5 0 8 4 9 6a13 13 0 0 1-2 2.7M6.6 6.6C4.2 8 2.7 10.3 2 12c1 2 4.5 6 10 6a9 9 0 0 0 3.6-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </Base>
  );
}

export function CloudOff(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 16a4 4 0 0 1-.9-7.9M8.5 5.5A5 5 0 0 1 17 9a3.5 3.5 0 0 1 2.4 6" />
      <path d="M9 16h7" />
      <path d="m3 3 18 18" />
    </Base>
  );
}

export function DatabaseOff(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 5.5C5 4.1 8.1 3 12 3c2.5 0 4.7.5 6 1.2" />
      <path d="M19 5v6m0 4v3.5c0 1.4-3.1 2.5-7 2.5s-7-1.1-7-2.5V5" />
      <path d="M5 10c0 1.2 2.4 2.2 5.5 2.4" />
      <path d="m3 3 18 18" />
    </Base>
  );
}

export function UserOff(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.2 6.2A3.5 3.5 0 0 1 15 9c0 .6-.2 1.2-.5 1.7" />
      <path d="M5 20a7 7 0 0 1 11-4.5" />
      <path d="m3 3 18 18" />
    </Base>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Base>
  );
}

export function Github(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6 0C6.2 2.6 5.1 2.9 5.1 2.9a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.7 9.3c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </Base>
  );
}

export function Star(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />
    </Base>
  );
}

export function Refresh(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 9A7.5 7.5 0 0 1 18 6.5L20 8.5" />
      <path d="M19.5 15A7.5 7.5 0 0 1 6 17.5L4 15.5" />
      <path d="M20 4v4.5h-4.5M4 20v-4.5h4.5" />
    </Base>
  );
}

export function Copy(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Base>
  );
}

export function Check(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12 5 5L20 7" />
    </Base>
  );
}
