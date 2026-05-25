import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";

async function getOrgId(supabase: ReturnType<typeof createAuthenticatedClient>, userId: string) {
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  return membership?.organization_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get("authorization"));
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const { data: requests, error } = await supabase
      .from("partner_allocation_requests")
      .select("*")
      .eq("business_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!requests?.length) return NextResponse.json([]);

    // Enrich with provider names
    const providerIds = [...new Set(requests.map((r) => r.service_provider_id).filter(Boolean))];
    const { data: providers } = await supabase
      .from("partner_providers")
      .select("id, provider_name")
      .in("id", providerIds);

    const providerMap = Object.fromEntries(
      (providers ?? []).map((p) => [p.id, p.provider_name])
    );

    // Enrich with allocation counts
    const requestIds = requests.map((r) => r.id);
    const { data: allocations } = await supabase
      .from("partner_driver_allocations")
      .select("id, request_id, status")
      .in("request_id", requestIds);

    const allocationCounts: Record<number, number> = {};
    (allocations ?? []).forEach((a) => {
      if (a.status !== "cancelled") {
        allocationCounts[a.request_id] = (allocationCounts[a.request_id] || 0) + 1;
      }
    });

    const enriched = requests.map((r) => ({
      ...r,
      reference_number: `SRQ-${String(r.id).padStart(5, "0")}`,
      provider_name: providerMap[r.service_provider_id] ?? null,
      allocated_count: allocationCounts[r.id] ?? 0,
    }));

    return NextResponse.json(enriched);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get("authorization"));
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const body = await request.json();
    const { service_provider_id, drivers_requested, start_date, end_date, business_notes } = body;

    if (!service_provider_id || !drivers_requested || !start_date) {
      return NextResponse.json(
        { error: "service_provider_id, drivers_requested, and start_date are required" },
        { status: 400 }
      );
    }

    if (typeof drivers_requested !== "number" || drivers_requested < 1) {
      return NextResponse.json({ error: "drivers_requested must be a positive number" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("partner_allocation_requests")
      .insert({
        business_id: orgId,
        service_provider_id,
        drivers_requested,
        start_date,
        end_date: end_date ?? null,
        business_notes: business_notes ?? null,
        status: "pending",
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch provider name for the response
    const { data: provider } = await supabase
      .from("partner_providers")
      .select("provider_name")
      .eq("id", service_provider_id)
      .maybeSingle();

    return NextResponse.json(
      {
        ...data,
        reference_number: `SRQ-${String(data!.id).padStart(5, "0")}`,
        provider_name: provider?.provider_name ?? null,
        allocated_count: 0,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}
