import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type WorkerResult = {
  checked: number;
  missed: number;
  failed: Array<{ checkin_id: string; error: string }>;
  correlation_id: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireWorkerAuthorization(req: Request): Response | null {
  const workerSecret = Deno.env.get("WORKER_SECRET");
  if (!workerSecret) return null;

  const expected = `Bearer ${workerSecret}`;
  const actual = req.headers.get("Authorization") ?? "";
  if (actual !== expected) {
    return jsonResponse({ error: "Unauthorized worker request." }, 401);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authError = requireWorkerAuthorization(req);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase worker environment." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 500);
  const correlationId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const { data: dueCheckins, error: selectError } = await supabase
    .from("checkins")
    .select("id")
    .in("status", ["scheduled", "pending"])
    .lte("deadline_time", nowIso)
    .order("deadline_time", { ascending: true })
    .limit(limit);

  if (selectError) {
    return jsonResponse({ error: selectError.message, correlation_id: correlationId }, 500);
  }

  const result: WorkerResult = {
    checked: dueCheckins?.length ?? 0,
    missed: 0,
    failed: [],
    correlation_id: correlationId,
  };

  for (const checkin of dueCheckins ?? []) {
    const { error } = await supabase.rpc("mark_checkin_missed", {
      p_user_id: null,
      p_checkin_id: checkin.id,
      p_correlation_id: correlationId,
    });

    if (error) {
      result.failed.push({ checkin_id: checkin.id, error: error.message });
    } else {
      result.missed += 1;
    }
  }

  return jsonResponse(result, result.failed.length > 0 ? 207 : 200);
});