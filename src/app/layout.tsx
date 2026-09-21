import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scale Generator — technische Skalen für Messgeräte, Frontplatten und CNC",
  description:
    "Parametrische Skalen erzeugen und als SVG, DXF, STL und OBJ exportieren. Kreis, Halbkreis, Kreisbogen und gerade Linie — die Exporte sind exakt die Vorschau.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[var(--surface-0)] text-[var(--text)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
