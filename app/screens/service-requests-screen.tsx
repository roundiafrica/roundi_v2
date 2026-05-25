"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Eye, Plus, Download, AlertCircle, RefreshCw, Search,
  Users, Calendar, Building2, CheckCircle2, X, ChevronRight,
  Package, ArrowRight, MapPin, Check, Zap, CalendarDays, Repeat2,
  ChevronLeft, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import AddressSearch from "@/components/address-search";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestStatus =
  | "pending" | "accepted" | "partially_allocated"
  | "fully_allocated" | "rejected" | "cancelled" | "completed";

type ServiceRequest = {
  id: number;
  reference_number: string;
  business_id: number;
  service_provider_id: number;
  provider_name: string | null;
  drivers_requested: number;
  allocated_count: number;
  start_date: string;
  end_date: string | null;
  status: RequestStatus;
  business_notes: string | null;
  provider_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Provider = {
  id: number;
  provider_name: string;
  service_mode: string;
  status: string;
};

type UnassignedDelivery = {
  id: number;
  customer_name: string;
  location: string;
  phone: string;
  item: string;
};

type DeliveryMode = "express" | "scheduled" | "recurring";
type PackageType = "standard" | "fragile" | "oversized" | "perishable";
type Priority = "standard" | "high" | "urgent";

type WizardData = {
  pickupOrigin: string;
  lastDropOff: string;
  deliveryMode: DeliveryMode;
  selectedProvider: Provider | null;
  packageType: PackageType;
  priority: Priority;
  specialInstructions: string;
  selectedDeliveries: UnassignedDelivery[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all",      label: "All Requests" },
  { key: "pending",  label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "active",   label: "In Progress" },
  { key: "completed", label: "Completed" },
] as const;

const ACTIVE_STATUSES: RequestStatus[] = ["accepted", "partially_allocated", "fully_allocated"];

const STATUS_BADGE: Record<RequestStatus, string> = {
  pending:             "bg-amber-100 text-amber-800 border-amber-200",
  accepted:            "bg-blue-100 text-blue-800 border-blue-200",
  partially_allocated: "bg-indigo-100 text-indigo-800 border-indigo-200",
  fully_allocated:     "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected:            "bg-red-100 text-red-700 border-red-200",
  cancelled:           "bg-slate-100 text-slate-400 border-slate-200",
  completed:           "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_DOT: Record<RequestStatus, string> = {
  pending: "bg-amber-400", accepted: "bg-blue-500",
  partially_allocated: "bg-indigo-500", fully_allocated: "bg-emerald-500",
  rejected: "bg-red-400", cancelled: "bg-slate-300", completed: "bg-slate-400",
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending", accepted: "Accepted",
  partially_allocated: "In Progress", fully_allocated: "Fully Allocated",
  rejected: "Rejected", cancelled: "Cancelled", completed: "Completed",
};

const DELIVERY_MODE_CONFIG: Record<DeliveryMode, {
  label: string; subtitle: string; emoji: string;
  Icon: React.FC<{ className?: string }>;
}> = {
  express:   { label: "On-Demand",  subtitle: "instant",   emoji: "⚡", Icon: Zap },
  scheduled: { label: "Scheduled",  subtitle: "scheduled", emoji: "🗓️", Icon: CalendarDays },
  recurring: { label: "Recurring",  subtitle: "recurring", emoji: "🔄", Icon: Repeat2 },
};

const STEP_LABELS = ["Select Route", "Select Provider", "Configure", "Review"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : "";
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const auth = await getAuthHeader();
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: auth, ...options.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
  return data;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ServiceRequestsScreen() {
  const [requests, setRequests]     = useState<ServiceRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState("all");
  const [search, setSearch]         = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [viewRequest, setViewRequest] = useState<ServiceRequest | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch("/api/service-requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load service requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? requests
      : activeTab === "active" ? requests.filter((r) => ACTIVE_STATUSES.includes(r.status))
      : requests.filter((r) => r.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.reference_number.toLowerCase().includes(q) ||
        (r.provider_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, activeTab, search]);

  const stats = useMemo(() => ({
    total:     requests.length,
    pending:   requests.filter((r) => r.status === "pending").length,
    active:    requests.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    completed: requests.filter((r) => r.status === "completed").length,
  }), [requests]);

  const exportCSV = () => {
    const rows = [
      ["Reference","Provider","Drivers","Allocated","Start Date","End Date","Status"].join(","),
      ...requests.map((r) => [
        r.reference_number, r.provider_name ?? "Not assigned", r.drivers_requested,
        r.allocated_count, formatDate(r.start_date),
        r.end_date ? formatDate(r.end_date) : "", STATUS_LABEL[r.status],
      ].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "service-requests.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#EFF0EB] p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              <div className="h-8 w-8 sm:h-10 sm:w-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-[#274690]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">Service Requests</h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">Request and manage driver allocations from service providers</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}
                className="text-gray-600 hover:bg-slate-50 text-xs sm:text-sm">
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={requests.length === 0}
                className="text-gray-600 hover:bg-slate-50 text-xs sm:text-sm">
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button onClick={() => setShowWizard(true)}
                className="bg-[#C8E298] hover:bg-[#274690] text-black text-xs sm:text-sm">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Create New Request</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input placeholder="Search by reference or provider..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white border-slate-200 focus:border-blue-500 text-sm" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-colors ${
                    activeTab === tab.key
                      ? "border-slate-900 text-slate-900 bg-white"
                      : "border-slate-200 text-slate-500 bg-white hover:border-slate-400 hover:text-slate-700"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 sm:mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Total Requests", value: stats.total, icon: <ClipboardList className="h-6 w-6 text-[#274690]" /> },
            { label: "Pending", value: stats.pending, icon: <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center"><div className="h-2.5 w-2.5 rounded-full bg-amber-400" /></div> },
            { label: "Active", value: stats.active, icon: <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center"><div className="h-2.5 w-2.5 rounded-full bg-blue-500" /></div> },
            { label: "Completed", value: stats.completed, icon: <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div> },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">{s.label}</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-black">{s.value}</p>
                  </div>
                  {s.icon}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500">Loading service requests...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load requests</h3>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <Button onClick={fetchRequests} className="bg-[#C8E298] hover:bg-[#274690] text-black">Try Again</Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-[#274690] mb-2">
                {search ? "No requests match your search"
                  : activeTab !== "all" ? `No ${FILTER_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} requests`
                  : "No service requests yet"}
              </h3>
              <p className="text-slate-500 mb-4 text-sm max-w-xs mx-auto">
                {search ? "Try a different search term."
                  : activeTab !== "all" ? "Switch to All Requests or create a new one."
                  : "Send a driver allocation request to a service provider. Once accepted, they will assign drivers to your operations."}
              </p>
              {!search && activeTab === "all" && (
                <Button onClick={() => setShowWizard(true)} className="bg-[#C8E298] hover:bg-[#274690] text-black">
                  <Plus className="h-4 w-4 mr-2" /> Create New Request
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {filtered.map((req) => (
              <RequestCard key={req.id} req={req} onView={() => setViewRequest(req)} />
            ))}
          </div>
        )}
      </div>

      <CreateRequestWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={(req) => { setRequests((p) => [req, ...p]); setShowWizard(false); }}
      />
      <ViewRequestModal req={viewRequest} onClose={() => setViewRequest(null)} />
    </div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({ req, onView }: { req: ServiceRequest; onView: () => void }) {
  let extra: Record<string, any> = {};
  try { if (req.business_notes) extra = JSON.parse(req.business_notes); } catch {}

  const deliveryMode = extra.delivery_mode as DeliveryMode | undefined;
  const modeConfig = deliveryMode ? DELIVERY_MODE_CONFIG[deliveryMode] : null;
  const pickup  = (extra.pickup_origin  as string | undefined) ?? "";
  const dropoff = (extra.last_drop_off  as string | undefined) ?? "";
  const ModeIcon = modeConfig?.Icon;

  return (
    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-0">

        {/* Top: ref + status + service type */}
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 font-mono">{req.reference_number}</p>
            <StatusBadge status={req.status} />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              {ModeIcon
                ? <ModeIcon className="h-4 w-4 text-emerald-700" />
                : <Package className="h-4 w-4 text-emerald-700" />}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight">
                {modeConfig?.label ?? "Service Request"}
              </p>
              <p className="text-xs text-slate-400">{modeConfig?.subtitle ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Pickup / Dropoff */}
        <div className="border-t border-slate-100 px-5 py-3 space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-3" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pickup</p>
              <p
                className="text-sm font-medium text-slate-900 truncate cursor-default"
                title={pickup || undefined}
              >
                {pickup || <span className="text-slate-400 italic">Not set</span>}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-3.5 w-3.5 shrink-0 mt-3 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full border-2 border-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Dropoff</p>
              <p
                className="text-sm font-medium text-slate-900 truncate cursor-default"
                title={dropoff || undefined}
              >
                {dropoff || <span className="text-slate-400 italic">Not set</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Provider + View */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Provider</p>
            <p className="text-sm font-semibold text-slate-900">
              {req.provider_name ?? "Not assigned"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onView}
            className="gap-1.5 text-xs text-slate-600 border-slate-200 hover:bg-slate-50 shrink-0">
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap border ${STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[status] ?? "bg-slate-400"}`} />
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center w-full">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors shrink-0 ${
                done    ? "bg-[#C8E298] border-[#C8E298] text-[#162318]"
                : active ? "bg-white border-[#274690] text-[#274690]"
                : "bg-white border-slate-200 text-slate-400"
              }`}>
                {done ? <Check className="h-3 w-3" /> : step}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${
                active ? "text-slate-900 font-semibold" : done ? "text-slate-500" : "text-slate-400"
              }`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-px mx-3 transition-colors ${done ? "bg-[#C8E298]" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Create Request Wizard ────────────────────────────────────────────────────

const EMPTY_WIZARD: WizardData = {
  pickupOrigin: "", lastDropOff: "", deliveryMode: "express",
  selectedProvider: null, packageType: "standard", priority: "standard",
  specialInstructions: "", selectedDeliveries: [],
};

function CreateRequestWizard({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (req: ServiceRequest) => void;
}) {
  const [step, setStep]   = useState(1);
  const [data, setData]   = useState<WizardData>(EMPTY_WIZARD);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = () => { setStep(1); setData(EMPTY_WIZARD); setSubmitError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!data.selectedProvider) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await apiFetch("/api/service-requests", {
        method: "POST",
        body: JSON.stringify({
          service_provider_id: data.selectedProvider.id,
          drivers_requested: 1,
          start_date: new Date().toISOString().split("T")[0],
          end_date: null,
          business_notes: JSON.stringify({
            delivery_mode: data.deliveryMode,
            pickup_origin: data.pickupOrigin,
            last_drop_off: data.lastDropOff,
            package_type: data.packageType,
            priority: data.priority,
            special_instructions: data.specialInstructions,
            linked_delivery_ids: data.selectedDeliveries.map((d) => d.id),
          }),
        }),
      });
      reset();
      onCreated(created);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = ["Select Route", "Select Provider", "Configure", "Review"];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        style={{ width: "70vw", maxWidth: "none" }}
        className="p-0 flex flex-col [&>button]:hidden"
      >
        {/* Wizard Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => step > 1 ? setStep((s) => (s - 1) as 1|2|3|4) : handleClose()}
              className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="font-semibold text-slate-900">On-Demand &amp; Scheduled</p>
              <p className="text-xs text-slate-400">Step {step} of 4 — {stepTitles[step - 1]}</p>
            </div>
          </div>
          <button onClick={handleClose} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b shrink-0">
          <StepProgress current={step} />
        </div>

        {/* Step content */}
        <div className="overflow-y-auto flex-1">
          {step === 1 && <Step1Route data={data} onChange={setData} />}
          {step === 2 && <Step2Provider data={data} onChange={setData} />}
          {step === 3 && <Step3Configure data={data} onChange={setData} />}
          {step === 4 && <Step4Review data={data} error={submitError} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => step > 1 ? setStep((s) => (s - 1) as 1|2|3|4) : handleClose()}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          {step < 4 ? (
            <div className="flex items-center gap-3">
              {step === 1 && (!data.pickupOrigin.trim() || !data.lastDropOff.trim()) && (
                <span className="text-xs text-slate-400">Fill both fields to see providers</span>
              )}
              <Button
                onClick={() => setStep((s) => (s + 1) as 1|2|3|4)}
                disabled={
                  (step === 1 && (!data.pickupOrigin.trim() || !data.lastDropOff.trim())) ||
                  (step === 2 && !data.selectedProvider)
                }
                className="bg-[#C8E298] hover:bg-[#274690] hover:text-white text-black gap-1"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#C8E298] hover:bg-[#274690] hover:text-white text-black gap-1"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                  Submitting…
                </span>
              ) : (
                <><Check className="h-4 w-4" /> Submit Request</>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Step 1: Route ────────────────────────────────────────────────────────────

function Step1Route({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  return (
    <div className="px-6 py-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Where is this movement going?</h2>
        <p className="text-sm text-slate-500 mt-1">Enter your pickup and destination. We&apos;ll show you only the logistics partners who can serve your route.</p>
      </div>

      <div className="space-y-0">
        {/* Pickup */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
            Pickup / Origin <span className="text-red-400">*</span>
          </label>
          <AddressSearch
            value={data.pickupOrigin}
            placeholder="e.g. Industrial Area, Nairobi"
            onSelect={(result) => onChange({ ...data, pickupOrigin: result.display_name })}
            countryCode="ke"
          />
        </div>

        {/* Connector */}
        <div className="flex items-center ml-3 py-1">
          <div className="w-px h-8 bg-emerald-300 ml-1" />
          <span className="ml-4 text-xs text-slate-400">to</span>
        </div>

        {/* Dropoff */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
            Last Drop Off Point <span className="text-red-400">*</span>
          </label>
          <AddressSearch
            value={data.lastDropOff}
            placeholder="e.g. Westlands, Nairobi"
            onSelect={(result) => onChange({ ...data, lastDropOff: result.display_name })}
            countryCode="ke"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Select Provider ──────────────────────────────────────────────────

function Step2Provider({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    apiFetch("/api/service-requests/providers")
      .then((d) => {
        console.log("[providers]", d);
        setProviders(Array.isArray(d) ? d : []);
      })
      .catch((err) => {
        console.error("[providers error]", err);
        setProviders([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 py-6 space-y-5">
      {/* Mode tabs */}
      <div className="flex gap-2">
        {(Object.entries(DELIVERY_MODE_CONFIG) as [DeliveryMode, typeof DELIVERY_MODE_CONFIG[DeliveryMode]][]).map(([key, { emoji, subtitle }]) => (
          <button
            key={key}
            onClick={() => onChange({ ...data, deliveryMode: key })}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              data.deliveryMode === key
                ? "bg-black text-white border-black"
                : "border-slate-200 text-slate-600 bg-white hover:border-slate-400"
            }`}
          >
            <span>{emoji}</span>
            <span className="capitalize">{subtitle}</span>
          </button>
        ))}
      </div>

      {/* Route summary */}
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-emerald-800 font-medium">
          <MapPin className="h-4 w-4" />
          {data.pickupOrigin} <ArrowRight className="h-3.5 w-3.5" /> {data.lastDropOff}
        </div>
        <button onClick={() => {}} className="text-xs text-emerald-600 font-semibold hover:underline">Change</button>
      </div>

      {/* Info */}
      {providers.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Showing all active partners. Select one to proceed with your request.</span>
        </div>
      )}

      {/* Eligible providers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Eligible Partners</h3>
          {providers.length > 0 && <span className="text-sm text-slate-500">{providers.length} available</span>}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Building2 className="h-10 w-10 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No active service providers found</p>
            <p className="text-xs mt-1">Providers must be registered and active to appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((p) => {
              const isSelected = data.selectedProvider?.id === p.id;
              return (
                <div key={p.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                  onClick={() => onChange({ ...data, selectedProvider: isSelected ? null : p })}
                >
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-sm font-bold text-emerald-700">
                    {getInitials(p.provider_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{p.provider_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.service_mode.split(",").concat(["allocation"]).slice(0, 3).map((m) => (
                        <span key={m} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                          {m.trim().replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={isSelected ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-slate-300"}
                    onClick={(e) => { e.stopPropagation(); onChange({ ...data, selectedProvider: isSelected ? null : p }); }}
                  >
                    {isSelected ? <><Check className="h-3.5 w-3.5 mr-1" /> Selected</> : <>Select <ChevronRight className="h-3.5 w-3.5 ml-1" /></>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Configure ────────────────────────────────────────────────────────

function Step3Configure({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  const [deliveries, setDeliveries] = useState<UnassignedDelivery[]>([]);
  const [loadingDel, setLoadingDel] = useState(true);

  useEffect(() => {
    apiFetch("/api/deliveries/unassigned")
      .then((d) => setDeliveries(Array.isArray(d?.deliveries) ? d.deliveries : []))
      .catch(() => setDeliveries([]))
      .finally(() => setLoadingDel(false));
  }, []);

  const isSelected = (id: number) => data.selectedDeliveries.some((d) => d.id === id);

  const toggleDelivery = (del: UnassignedDelivery) => {
    onChange({
      ...data,
      selectedDeliveries: isSelected(del.id)
        ? data.selectedDeliveries.filter((d) => d.id !== del.id)
        : [...data.selectedDeliveries, del],
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* Left: main form */}
      <div className="lg:col-span-2 px-6 py-6 space-y-6 overflow-y-auto">
        {/* Selected provider */}
        {data.selectedProvider && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-800">
                {getInitials(data.selectedProvider.provider_name)}
              </div>
              <span className="font-medium text-emerald-900 text-sm">{data.selectedProvider.provider_name}</span>
            </div>
            <button className="text-xs text-emerald-600 font-semibold hover:underline">Change</button>
          </div>
        )}

        {/* Delivery mode */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivery Mode</p>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(DELIVERY_MODE_CONFIG) as [DeliveryMode, typeof DELIVERY_MODE_CONFIG[DeliveryMode]][]).map(([key, { emoji, subtitle }]) => (
              <button
                key={key}
                onClick={() => onChange({ ...data, deliveryMode: key })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  data.deliveryMode === key
                    ? "bg-black text-white border-black"
                    : "border-slate-200 text-slate-600 bg-white hover:border-slate-400"
                }`}
              >
                <span>{emoji}</span> <span className="capitalize">{subtitle}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Locations (read-only from step 1) */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Locations</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Pickup Address *</Label>
              <AddressSearch
                value={data.pickupOrigin}
                placeholder="e.g. Industrial Area, Nairobi"
                onSelect={(result) => onChange({ ...data, pickupOrigin: result.display_name })}
                countryCode="ke"
                className="mt-1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Last Drop Off Point *</Label>
              <AddressSearch
                value={data.lastDropOff}
                placeholder="e.g. Westlands, Nairobi"
                onSelect={(result) => onChange({ ...data, lastDropOff: result.display_name })}
                countryCode="ke"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Package & Priority */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Package &amp; Priority</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Package Type</Label>
              <Select value={data.packageType} onValueChange={(v) => onChange({ ...data, packageType: v as PackageType })}>
                <SelectTrigger className="border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="fragile">Fragile</SelectItem>
                  <SelectItem value="oversized">Oversized</SelectItem>
                  <SelectItem value="perishable">Perishable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Priority</Label>
              <Select value={data.priority} onValueChange={(v) => onChange({ ...data, priority: v as Priority })}>
                <SelectTrigger className="border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Special instructions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Additional Information</p>
          <Textarea
            className="border-slate-200 resize-none text-sm"
            rows={3}
            placeholder="Access codes, contact preferences, handling notes..."
            value={data.specialInstructions}
            onChange={(e) => onChange({ ...data, specialInstructions: e.target.value })}
          />
        </div>

        {/* Add deliveries */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add Deliveries</p>
          <p className="text-xs text-slate-400">Optionally include existing unassigned deliveries in this request</p>

          {data.selectedDeliveries.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">{data.selectedDeliveries.length} Selected</p>
              {data.selectedDeliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{d.customer_name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <p className="text-xs text-slate-500">{d.location}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleDelivery(d)}
                    className="text-xs text-red-500 font-medium border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {loadingDel ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : deliveries.filter((d) => !isSelected(d.id)).length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">No unassigned pending deliveries available.</p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {deliveries.filter((d) => !isSelected(d.id)).length} Available
                </span>
                <span className="text-xs text-slate-400">Pending deliveries not yet allocated</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {deliveries.filter((d) => !isSelected(d.id)).map((d) => (
                  <div key={d.id}
                    className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2.5 hover:border-slate-400 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{d.customer_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <p className="text-xs text-slate-500 truncate">{d.location}</p>
                      </div>
                      {d.phone && <p className="text-xs text-slate-400 mt-0.5">{d.phone}</p>}
                    </div>
                    <button onClick={() => toggleDelivery(d)}
                      className="h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-400 transition-colors shrink-0 ml-3">
                      <Plus className="h-3.5 w-3.5 text-slate-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: summary sidebar */}
      <div className="lg:col-span-1 px-5 py-6 space-y-4 bg-slate-50">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Request Summary</p>
        </div>

        {data.selectedProvider && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                {getInitials(data.selectedProvider.provider_name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{data.selectedProvider.provider_name}</p>
                <p className="text-xs text-slate-400 capitalize">On-Demand &amp; Scheduled · {data.deliveryMode}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
              <div className="flex justify-between"><span className="text-slate-400">Pickup</span><span className="font-medium truncate max-w-[120px]">{data.pickupOrigin || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Dropoff</span><span className="font-medium truncate max-w-[120px]">{data.lastDropOff || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Package</span><span className="font-medium capitalize">{data.packageType}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Mode</span><span className="font-medium capitalize">{data.deliveryMode}</span></div>
              {data.selectedDeliveries.length > 0 && (
                <div className="flex justify-between"><span className="text-slate-400">Deliveries</span><span className="font-medium">{data.selectedDeliveries.length} added</span></div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-3 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Provider will confirm availability within 5–10 minutes of submission.
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function Step4Review({ data, error }: { data: WizardData; error: string | null }) {
  const { label: modeLabel, subtitle: modeSub, Icon: ModeIcon } = DELIVERY_MODE_CONFIG[data.deliveryMode];
  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Review Your Request</h2>
        <p className="text-sm text-slate-500 mt-1">Check the details below before submitting. Once submitted, the provider will review and respond.</p>
      </div>

      <div className="space-y-4">
        {/* Route */}
        <ReviewSection title="Route">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div className="w-px h-6 bg-emerald-300" />
              <span className="h-2.5 w-2.5 rounded-full border-2 border-slate-300" />
            </div>
            <div className="space-y-1.5">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pickup / Origin</p>
                <p className="text-sm font-medium text-slate-900">{data.pickupOrigin}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last Drop Off</p>
                <p className="text-sm font-medium text-slate-900">{data.lastDropOff}</p>
              </div>
            </div>
          </div>
        </ReviewSection>

        {/* Provider */}
        <ReviewSection title="Service Provider">
          {data.selectedProvider ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
                {getInitials(data.selectedProvider.provider_name)}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{data.selectedProvider.provider_name}</p>
                <p className="text-xs text-slate-400 capitalize">{data.selectedProvider.service_mode.replace("_", " ")}</p>
              </div>
            </div>
          ) : <p className="text-sm text-red-500">No provider selected</p>}
        </ReviewSection>

        {/* Configuration */}
        <ReviewSection title="Configuration">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <ReviewRow label="Delivery Mode" value={<span className="flex items-center gap-1"><ModeIcon className="h-3.5 w-3.5" />{modeLabel} <span className="text-slate-400">({modeSub})</span></span>} />
            <ReviewRow label="Package Type" value={<span className="capitalize">{data.packageType}</span>} />
            <ReviewRow label="Priority" value={<span className="capitalize">{data.priority}</span>} />
            {data.specialInstructions && (
              <div className="col-span-2">
                <ReviewRow label="Special Instructions" value={data.specialInstructions} />
              </div>
            )}
          </div>
        </ReviewSection>

        {/* Deliveries */}
        {data.selectedDeliveries.length > 0 && (
          <ReviewSection title={`Included Deliveries (${data.selectedDeliveries.length})`}>
            <div className="space-y-2">
              {data.selectedDeliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm">
                  <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-900">{d.customer_name}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 truncate">{d.location}</span>
                </div>
              ))}
            </div>
          </ReviewSection>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-amber-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        After submission, the provider will review your request and respond within 5–10 minutes. You can track the status in the Service Requests dashboard.
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

// ─── View Request Modal ───────────────────────────────────────────────────────

function ViewRequestModal({ req, onClose }: { req: ServiceRequest | null; onClose: () => void }) {
  if (!req) return null;
  const progress = req.drivers_requested > 0
    ? Math.min((req.allocated_count / req.drivers_requested) * 100, 100) : 0;

  // Parse extra data stored in business_notes
  let extra: Record<string, any> = {};
  try { if (req.business_notes) extra = JSON.parse(req.business_notes); } catch {}

  return (
    <Dialog open={!!req} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <p className="text-xs text-slate-400 font-mono">{req.reference_number}</p>
            <h3 className="font-semibold text-lg text-slate-900 mt-0.5">Request Details</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 py-2">
          <StatusBadge status={req.status} />

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{req.provider_name ?? "Provider not set"}</p>
              <p className="text-xs text-slate-400">Service provider</p>
            </div>
          </div>

          {(extra.pickup_origin || extra.last_drop_off) && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              {extra.pickup_origin && (
                <div className="flex gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pickup</p>
                  <p className="text-sm text-slate-700">{extra.pickup_origin}</p></div>
                </div>
              )}
              {extra.last_drop_off && (
                <div className="flex gap-3">
                  <div className="h-4 w-4 shrink-0 mt-0.5 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full border-2 border-slate-300" />
                  </div>
                  <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Dropoff</p>
                  <p className="text-sm text-slate-700">{extra.last_drop_off}</p></div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>{req.drivers_requested} driver{req.drivers_requested !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>{formatDate(req.start_date)}</span>
            </div>
            {extra.delivery_mode && (
              <div className="flex items-center gap-2 text-slate-600 capitalize">
                <Zap className="h-3.5 w-3.5 text-slate-400" />
                <span>{extra.delivery_mode}</span>
              </div>
            )}
            {extra.package_type && (
              <div className="flex items-center gap-2 text-slate-600 capitalize">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                <span>{extra.package_type}</span>
              </div>
            )}
          </div>

          {ACTIVE_STATUSES.includes(req.status) && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{req.allocated_count} drivers assigned</span>
                <span>{req.drivers_requested} needed</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {extra.special_instructions && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Special Instructions</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{extra.special_instructions}</p>
            </div>
          )}
          {req.provider_notes && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Provider Response</p>
              <p className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">{req.provider_notes}</p>
            </div>
          )}

          <p className="text-xs text-slate-400">Submitted {formatDate(req.created_at)}</p>
        </div>

        <div className="pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
