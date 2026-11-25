/** Inline stroke icons (24×24, currentColor). Decorative unless given a title. */
type P = { size?: number; className?: string };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const PlayIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></svg>;
export const PauseIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></svg>;
export const NextIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M5 5v14l10-7z" fill="currentColor" stroke="none" /><path d="M18 5v14" strokeWidth="2.25" /></svg>;
export const PrevIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M19 5v14L9 12z" fill="currentColor" stroke="none" /><path d="M6 5v14" strokeWidth="2.25" /></svg>;
export const AddIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h11M4 12h11M4 17h7M18 14v6M15 17h6" /></svg>;
export const CheckIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const CloseIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const ChevronDown = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M6 9l6 6 6-6" /></svg>;
export const ChevronUp = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M6 15l6-6 6 6" /></svg>;
export const ChevronLeft = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M15 6l-6 6 6 6" /></svg>;
export const ChevronRight = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M9 6l6 6-6 6" /></svg>;
export const DragIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><circle cx="9" cy="6" r="1.2" fill="currentColor" /><circle cx="15" cy="6" r="1.2" fill="currentColor" /><circle cx="9" cy="12" r="1.2" fill="currentColor" /><circle cx="15" cy="12" r="1.2" fill="currentColor" /><circle cx="9" cy="18" r="1.2" fill="currentColor" /><circle cx="15" cy="18" r="1.2" fill="currentColor" /></svg>;
export const CalendarIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="4" y="5.5" width="16" height="14" rx="1.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>;
export const SunIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>;
export const MoonIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" /></svg>;
export const ArrowRight = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const QueueIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M4 6h16M4 11h16M4 16h9" /><path d="M16 14.5v6l5-3z" fill="currentColor" stroke="none" /></svg>;
// Admin nav
export const GridIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></svg>;
export const RunsIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none" /></svg>;
export const FeedIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M5 5a14 14 0 0114 14M5 11a8 8 0 018 8" /><circle cx="6" cy="18" r="1.4" fill="currentColor" /></svg>;
export const WaveIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3" /></svg>;
export const EpisodesIcon = ({ size, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="11" r="3" /><path d="M7 16a7 7 0 1110 0M12 14v6" /></svg>;
