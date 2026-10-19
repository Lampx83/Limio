import type { ReactNode } from "react";
import type { OutlineKind, OutlineLayout } from "@/lib/limioLiveOutline";

// Hình phác nhỏ của từng bố cục và từng loại slide: để nhìn là biết slide sẽ trông thế nào.
// Màu theo currentColor, nên đổi theo trạng thái chọn và chế độ sáng/tối.
const F = { fill: "currentColor" };
const O = { fill: "currentColor", opacity: 0.32 };

const SHAPES: Record<OutlineLayout | OutlineKind, ReactNode> = {
  cover: (<><rect x="8" y="10" width="26" height="5" rx="1.5" {...F} /><rect x="8" y="19" width="16" height="3" rx="1.5" {...O} /></>),
  section: (<><rect x="8" y="13" width="22" height="5" rx="1.5" {...F} /><rect x="8" y="22" width="30" height="2.5" rx="1" {...O} /><rect x="8" y="7" width="8" height="2.5" rx="1" {...O} /></>),
  image: (<><rect x="6" y="6" width="18" height="4" rx="1.5" {...F} /><rect x="6" y="14" width="20" height="2.5" rx="1" {...O} /><rect x="6" y="19" width="20" height="2.5" rx="1" {...O} /><rect x="6" y="24" width="14" height="2.5" rx="1" {...O} /><rect x="30" y="8" width="12" height="16" rx="2" {...O} /></>),
  list: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><circle cx="8" cy="14" r="1.5" {...F} /><rect x="12" y="13" width="28" height="2.5" rx="1" {...O} /><circle cx="14" cy="19" r="1.2" {...F} /><rect x="17" y="18" width="23" height="2.5" rx="1" {...O} /><circle cx="8" cy="24" r="1.5" {...F} /><rect x="12" y="23" width="26" height="2.5" rx="1" {...O} /><rect x="12" y="27" width="20" height="2" rx="1" {...O} /></>),
  groups: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><rect x="6" y="13" width="14" height="3" rx="1" {...F} /><rect x="8" y="18" width="12" height="2.5" rx="1" {...O} /><rect x="8" y="22" width="10" height="2.5" rx="1" {...O} /><rect x="26" y="13" width="14" height="3" rx="1" {...F} /><rect x="28" y="18" width="12" height="2.5" rx="1" {...O} /><rect x="28" y="22" width="10" height="2.5" rx="1" {...O} /></>),
  cards: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><rect x="6" y="13" width="11" height="14" rx="2" {...O} /><rect x="18.5" y="13" width="11" height="14" rx="2" {...O} /><rect x="31" y="13" width="11" height="14" rx="2" {...O} /></>),
  compare: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><rect x="6" y="13" width="17" height="14" rx="2" {...O} /><rect x="25" y="13" width="17" height="14" rx="2" {...O} /></>),
  steps: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><circle cx="10" cy="17" r="3" {...F} /><circle cx="24" cy="17" r="3" {...F} /><circle cx="38" cy="17" r="3" {...F} /><rect x="6" y="23" width="9" height="2.5" rx="1" {...O} /><rect x="20" y="23" width="9" height="2.5" rx="1" {...O} /><rect x="33" y="23" width="9" height="2.5" rx="1" {...O} /></>),
  stats: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><rect x="6" y="14" width="10" height="8" rx="1.5" {...F} /><rect x="19" y="14" width="10" height="8" rx="1.5" {...F} /><rect x="32" y="14" width="10" height="8" rx="1.5" {...F} /><rect x="6" y="25" width="10" height="2" rx="1" {...O} /><rect x="19" y="25" width="10" height="2" rx="1" {...O} /><rect x="32" y="25" width="10" height="2" rx="1" {...O} /></>),
  quote: (<><rect x="8" y="8" width="3" height="16" rx="1.5" {...F} /><rect x="14" y="9" width="26" height="4" rx="1.5" {...F} /><rect x="14" y="16" width="20" height="4" rx="1.5" {...O} /></>),
  summary: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><rect x="6" y="14" width="3" height="3" rx="1" {...F} /><rect x="12" y="14" width="26" height="3" rx="1" {...O} /><rect x="6" y="20" width="3" height="3" rx="1" {...F} /><rect x="12" y="20" width="22" height="3" rx="1" {...O} /><rect x="6" y="26" width="3" height="3" rx="1" {...F} /><rect x="12" y="26" width="18" height="3" rx="1" {...O} /></>),
  table: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><rect x="6" y="12" width="36" height="4" rx="1" {...F} /><rect x="6" y="18" width="11" height="3" rx="1" {...O} /><rect x="18.5" y="18" width="11" height="3" rx="1" {...O} /><rect x="31" y="18" width="11" height="3" rx="1" {...O} /><rect x="6" y="23" width="11" height="3" rx="1" {...O} /><rect x="18.5" y="23" width="11" height="3" rx="1" {...O} /><rect x="31" y="23" width="11" height="3" rx="1" {...O} /></>),
  chart: (<><rect x="6" y="5" width="22" height="4" rx="1.5" {...F} /><rect x="9" y="19" width="6" height="8" rx="1" {...O} /><rect x="18" y="15" width="6" height="12" rx="1" {...F} opacity={0.7} /><rect x="27" y="12" width="6" height="15" rx="1" {...F} /><rect x="6" y="27" width="36" height="1.5" rx="0.7" {...O} /></>),
  content: (<><rect x="6" y="6" width="18" height="4" rx="1.5" {...F} /><rect x="6" y="14" width="20" height="2.5" rx="1" {...O} /><rect x="6" y="19" width="20" height="2.5" rx="1" {...O} /><rect x="6" y="24" width="14" height="2.5" rx="1" {...O} /><rect x="30" y="8" width="12" height="16" rx="2" {...O} /></>),
  quiz: (<><rect x="8" y="6" width="26" height="4" rx="1.5" {...F} /><rect x="8" y="13" width="14" height="6" rx="2" {...O} /><rect x="25" y="13" width="14" height="6" rx="2" {...O} /><rect x="8" y="22" width="14" height="6" rx="2" {...O} /><rect x="25" y="22" width="14" height="6" rx="2" {...O} /></>),
  poll: (<><rect x="8" y="6" width="26" height="4" rx="1.5" {...F} /><rect x="8" y="14" width="30" height="3.5" rx="1.5" {...F} /><rect x="8" y="20" width="20" height="3.5" rx="1.5" {...O} /><rect x="8" y="26" width="12" height="3.5" rx="1.5" {...O} /></>),
  word_cloud: (<><rect x="8" y="8" width="16" height="6" rx="2" {...F} /><rect x="26" y="9" width="12" height="4" rx="1.5" {...O} /><rect x="10" y="17" width="9" height="4" rx="1.5" {...O} /><rect x="21" y="16" width="14" height="6" rx="2" {...F} /><rect x="14" y="24" width="12" height="4" rx="1.5" {...O} /></>),
  collaborate_board: (<><rect x="6" y="6" width="12" height="10" rx="1.5" {...O} /><rect x="20" y="8" width="12" height="10" rx="1.5" {...F} /><rect x="33" y="5" width="10" height="10" rx="1.5" {...O} /><rect x="10" y="19" width="12" height="9" rx="1.5" {...F} /><rect x="25" y="20" width="14" height="8" rx="1.5" {...O} /></>),
  draw_it: (<><path d="M8 22 C13 8, 18 8, 22 16 S32 26, 40 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="40" cy="10" r="2" {...F} /></>),
  whiteboard: (<><path d="M7 24 L16 9 L26 21 L33 11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><rect x="31" y="19" width="11" height="3" rx="1.5" {...O} /><path d="M33 24l5 4-1-5z" {...F} /></>),
};

export default function OutlineGlyph({ k, className }: { k: OutlineLayout | OutlineKind; className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="46" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      {SHAPES[k]}
    </svg>
  );
}
