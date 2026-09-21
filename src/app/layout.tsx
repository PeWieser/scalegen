import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Geist Sans und Geist Mono kommen aus dem Paket `geist` (lokale Schriftdateien).
 * Dadurch braucht der Build keinen Schrift-Download — wichtig für CI-Builds.
 * Die Variablen --font-geist-sans / --font-geist-mono stehen in globals.css.
 */

export const metadata: Metadata = {
  title: "Scale Generator — technische Skalen für Messgeräte, Frontplatten und CNC",
  description:
    "Parametrische Skalen erzeugen und als SVG, DXF, STL und OBJ exportieren. Kreis, Halbkreis, Kreisbogen und gerade Linie — die Exporte sind exakt die Vorschau. Läuft vollständig im Browser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} bg-[var(--surface-0)] text-[var(--text)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
