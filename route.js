import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  const cleanUrl = String(supabaseUrl || "").trim().replace(/^['"]|['"]$/g, "").replace(/\\/$/, "");
  const cleanKey = String(supabaseKey || "").trim().replace(/^['"]|['"]$/g, "");

  return NextResponse.json(
    { supabaseUrl: cleanUrl, supabaseKey: cleanKey },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
