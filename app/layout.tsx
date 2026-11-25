import { Jost, Playfair_Display } from "next/font/google";
import "./globals.css";

const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Jost({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: "PRISM News",
  description: "One story. Every lens. The news, fully framed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
