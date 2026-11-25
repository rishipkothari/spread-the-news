import Drawer from "./_components/Drawer";
import { PlayerProvider } from "./_components/player";
import SiteHeader from "./_components/SiteHeader";
import "./site.css";

/** Public site frame: header, the page, and the player drawer (kept across pages so audio never stops). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <div className="site">
        <SiteHeader />
        {children}
      </div>
      <Drawer />
    </PlayerProvider>
  );
}
