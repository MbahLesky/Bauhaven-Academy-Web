import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();
    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "Missing tokens" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      console.error("Failed to establish server session from tokens:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: data.user ? { id: data.user.id, email: data.user.email } : null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

