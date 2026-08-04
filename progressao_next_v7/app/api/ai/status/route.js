import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = Boolean(String(process.env.OPENAI_API_KEY || "").trim());
  return NextResponse.json({
    enabled,
    model: enabled ? String(process.env.OPENAI_MODEL || "gpt-5-mini") : null,
    dailyLimit: enabled ? Math.max(1, Math.min(Number(process.env.AI_DAILY_LIMIT || 60) || 60, 500)) : null,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
