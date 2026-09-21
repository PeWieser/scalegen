import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { scales } from "@/db/schema";
import { coerceParams } from "@/core/scale-engine/validate";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: Context) {
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  try {
    const [row] = await db.select().from(scales).where(eq(scales.id, id));
    if (!row) return NextResponse.json({ error: "Skala nicht gefunden." }, { status: 404 });
    return NextResponse.json({ scale: row });
  } catch (error) {
    console.error("GET /api/scales/:id", error);
    return NextResponse.json({ error: "Skala konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: Context) {
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  try {
    const body = (await request.json()) as { name?: unknown; params?: unknown };
    const params = coerceParams(body.params);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!params || !name) return NextResponse.json({ error: "Name und Parameter sind erforderlich." }, { status: 400 });
    const [row] = await db
      .update(scales)
      .set({ name, type: params.type, params, updatedAt: new Date() })
      .where(eq(scales.id, id))
      .returning();
    if (!row) return NextResponse.json({ error: "Skala nicht gefunden." }, { status: 404 });
    return NextResponse.json({ scale: row });
  } catch (error) {
    console.error("PUT /api/scales/:id", error);
    return NextResponse.json({ error: "Skala konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  try {
    const rows = await db.delete(scales).where(eq(scales.id, id)).returning({ id: scales.id });
    if (rows.length === 0) return NextResponse.json({ error: "Skala nicht gefunden." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/scales/:id", error);
    return NextResponse.json({ error: "Skala konnte nicht gelöscht werden." }, { status: 500 });
  }
}
