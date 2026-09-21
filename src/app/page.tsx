import { Workbench } from "@/features/scale/Workbench";

/**
 * Alles clientseitig: keine Datenbank, kein API, kein Server-Zugriff.
 * Die Seite ist statisch exportierbar (Cloudflare Pages).
 */
export default function HomePage() {
  return <Workbench />;
}
