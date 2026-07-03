import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NotificationPreference = "push" | "sms" | "both";

type ClaimedRecipient = {
  alert_id: string;
  session_contact_id: string;
  user_id: string;
  session_id: string | null;
  contact_name: string;
  contact_phone: string;
  notification_preference: NotificationPreference;
  retry_count: number;
  trigger_type: string;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  created_at: string;
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

function buildMvpDeferralReason(recipient: ClaimedRecipient): string {
  const channels = recipient.notification_preference === "both"
    ? "push/sms"
    : recipient.notification_preference;

  return `Notification delivery deferred: ${channels} provider integration is outside the current MVP runtime. Recipient was claimed and audited for later delivery implementation.`;
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
  const limit = Math.min(Math.max(Number(body.limit ?? 25), 1), 100);
  const maxRetries = Math.min(Math.max(Number(body.max_retries ?? 3), 1), 10);
  const correlationId = crypto.randomUUID();

  const { data: claimed, error: claimError } = await supabase.rpc("claim_alert_recipients", {
    p_limit: limit,
    p_max_retries: maxRetries,
  });

  if (claimError) {
    return jsonResponse({ error: claimError.message, correlation_id: correlationId }, 500);
  }

  const recipients = (claimed ?? []) as ClaimedRecipient[];
  const result = {
    claimed: recipients.length,
    deferred: 0,
    failed: [] as Array<{ alert_id: string; session_contact_id: string; error: string }>,
    correlation_id: correlationId,
  };

  for (const recipient of recipients) {
    const reason = buildMvpDeferralReason(recipient);
    const { error } = await supabase.rpc("mark_recipient_failed", {
      p_user_id: null,
      p_alert_id: recipient.alert_id,
      p_session_contact_id: recipient.session_contact_id,
      p_error: reason,
      p_correlation_id: correlationId,
    });

    if (error) {
      result.failed.push({
        alert_id: recipient.alert_id,
        session_contact_id: recipient.session_contact_id,
        error: error.message,
      });
    } else {
      result.deferred += 1;
    }
  }

  return jsonResponse(result, result.failed.length > 0 ? 207 : 200);
});