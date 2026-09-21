import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scale Generator",
  description:
    "Präzise technische Skalen parametrisch erzeugen und als SVG, DXF, STL oder OBJ exportieren.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground">
        <TooltipProvider delayDuration={250} skipDelayDuration={100}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
