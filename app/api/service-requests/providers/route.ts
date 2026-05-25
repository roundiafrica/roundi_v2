import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get("authorization"));
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: providers, error } = await supabase
      .from("partner_providers")
      .select("id, provider_name, service_mode, status")
      .order("provider_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(providers ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
