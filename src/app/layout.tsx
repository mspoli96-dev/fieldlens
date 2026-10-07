import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const headingFont = Manrope({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "FieldLens | Visual assistance by Webytex",
  description: "Show the problem. Hear the next step. Explore visual and voice assistance with an interactive fictional printer, your camera, or a photo.",
  icons: { icon: "/mark.svg" },
  openGraph: { title: "FieldLens by Webytex", description: "A visual support workbench. See the problem. Take the next step.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}><body>{children}</body></html>;
}
