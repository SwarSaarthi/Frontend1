import type { SVGProps } from "react";
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: "arrow" | "play" | "sound" | "mic" | "check" | "plus" | "spark" | "headphones" }) {
  const paths = {
    arrow: <><path d="M5 12h14M12 5l7 7-7 7" /></>,
    play: <path d="m9 5 11 7-11 7V5Z" />,
    sound: <><path d="M3 10v4m4-7v10m5-14v22m5-18v14m4-10v6" /></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 11a7 7 0 0 0 14 0m-7 7v4m-4 0h8" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    spark: <path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z" />,
    headphones: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
export function BrandMark() {
  return <svg width="30" height="32" viewBox="0 0 30 32" fill="none" aria-hidden="true"><path d="M3 13v6M9 7v18M15 3v26M21 8v16M27 13v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}
