import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { scales } from "@/db/schema";
import { coerceParams } from "@/core/scale-engine/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({ id: scales.id, name: scales.name, type: scales.type, updatedAt: scales.updatedAt })
      .from(scales)
      .orderBy(desc(scales.updatedAt));
    return NextResponse.json({ scales: rows });
  } catch (error) {
    console.error("GET /api/scales", error);
    return NextResponse.json({ error: "Bibliothek konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown; params?: unknown };
    const params = coerceParams(body.params);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!params || !name) return NextResponse.json({ error: "Name und Parameter sind erforderlich." }, { status: 400 });
    const [row] = await db.insert(scales).values({ name, type: params.type, params }).returning();
    return NextResponse.json({ scale: row }, { status: 201 });
  } catch (error) {
    console.error("POST /api/scales", error);
    return NextResponse.json({ error: "Skala konnte nicht gespeichert werden." }, { status: 500 });
  }
}
