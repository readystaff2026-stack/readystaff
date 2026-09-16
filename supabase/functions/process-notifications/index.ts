import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizePhone = (value: unknown) => {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^\d{12,15}$/.test(digits) ? digits : "";
};

const eventCopy: Record<string, { subject: string; title: string }> = {
  new_quote: { subject: "Novo pedido de orçamento na ReadyStaff", title: "Você recebeu um novo pedido" },
  quote_accepted: { subject: "Seu pedido foi aceito na ReadyStaff", title: "Seu pedido foi aceito" },
  quote_declined: { subject: "Atualização do seu pedido na ReadyStaff", title: "O profissional respondeu ao pedido" },
  quote_cancelled: { subject: "Pedido cancelado na ReadyStaff", title: "Um pedido foi cancelado" },
  new_message: { subject: "Nova mensagem na ReadyStaff", title: "Você recebeu uma nova mensagem" },
  new_proposal: { subject: "Nova proposta na ReadyStaff", title: "Você recebeu uma nova proposta" },
  proposal_accepted: { subject: "Sua proposta foi aceita na ReadyStaff", title: "Sua proposta foi aceita" },
  proposal_declined: { subject: "Resposta à sua proposta na ReadyStaff", title: "Sua proposta foi recusada" },
  service_completion: { subject: "Confirmação do serviço na ReadyStaff", title: "A outra pessoa confirmou a conclusão do serviço" },
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Sessão inválida." }, 401);

  let body: { quote_id?: string; operation?: string; notification_id?: string } = {};
  try { body = (await request.json()) || {}; } catch { /* empty body is valid */ }
  if (body.operation === "status") {
    if (user.app_metadata?.readystaff_admin !== true) return json({ error: "Acesso administrativo obrigatório." }, 403);
    return json({
      email_configured: Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("READYSTAFF_EMAIL_FROM")),
      whatsapp_credentials_configured: Boolean(Deno.env.get("WHATSAPP_ACCESS_TOKEN") && Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")),
      whatsapp_new_quote_template_configured: Boolean(Deno.env.get("WHATSAPP_TEMPLATE_NEW_QUOTE")),
      whatsapp_update_template_configured: Boolean(Deno.env.get("WHATSAPP_TEMPLATE_QUOTE_UPDATE")),
      whatsapp_conversation_template_configured: Boolean(Deno.env.get("WHATSAPP_TEMPLATE_CONVERSATION_UPDATE") || Deno.env.get("WHATSAPP_TEMPLATE_QUOTE_UPDATE")),
      scheduled_retries: false,
    });
  }

  let quoteIds: string[] = [];
  let retriedJobId = "";
  if (body.operation === "retry") {
    if (user.app_metadata?.readystaff_admin !== true) return json({ error: "Acesso administrativo obrigatório." }, 403);
    if (!body.notification_id || !/^[0-9a-f-]{36}$/i.test(body.notification_id)) return json({ error: "Aviso inválido." }, 400);
    const { data: job, error } = await admin.from("notification_outbox").select("id, quote_id")
      .eq("id", body.notification_id).in("status", ["failed", "configuration_pending"]).maybeSingle();
    if (error || !job) return json({ error: "Somente avisos com falha ou configuração pendente podem ser tentados novamente." }, 409);
    const { data: reset, error: resetError } = await admin.from("notification_outbox")
      .update({ status: "pending", attempt_count: 0, next_attempt_at: new Date().toISOString(), claimed_at: null })
      .eq("id", job.id).in("status", ["failed", "configuration_pending"]).select("id").maybeSingle();
    if (resetError || !reset) return json({ error: "O aviso mudou; atualize o painel." }, 409);
    quoteIds = [job.quote_id]; retriedJobId = job.id;
  } else if (body.quote_id) {
    const { data: visibleQuote } = await userClient
      .from("quote_requests")
      .select("id")
      .eq("id", body.quote_id)
      .maybeSingle();
    if (!visibleQuote) return json({ error: "Pedido não encontrado." }, 404);
    quoteIds = [visibleQuote.id];
  } else {
    const { data: recipientRows } = await admin
      .from("notification_outbox")
      .select("quote_id")
      .eq("recipient_id", user.id)
      .in("status", ["pending", "configuration_pending", "failed", "processing"])
      .lt("attempt_count", 5)
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(10);
    quoteIds = [...new Set((recipientRows ?? []).map((row) => row.quote_id))];
  }

  if (!quoteIds.length) return json({ processed: 0, pending: 0 });
  await admin.from("notification_outbox")
    .update({ status: "failed", last_error: "Envio interrompido; aguardando nova tentativa.", next_attempt_at: new Date().toISOString() })
    .in("quote_id", quoteIds).eq("status", "processing")
    .lt("claimed_at", new Date(Date.now() - 600000).toISOString());

  let jobsQuery = admin
    .from("notification_outbox")
    .select("id, quote_id, recipient_id, event_type, attempt_count")
    .in("quote_id", quoteIds)
    .in("status", ["pending", "configuration_pending", "failed"])
    .lt("attempt_count", 5)
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(10);
  if (retriedJobId) jobsQuery = jobsQuery.eq("id", retriedJobId);
  const { data: jobs, error: jobsError } = await jobsQuery;
  if (jobsError) return json({ error: "Não foi possível consultar os avisos." }, 500);

  async function processJobs() {
  let processed = 0;
  let pending = 0;
  for (const job of jobs ?? []) {
    const { data: claimed } = await admin
      .from("notification_outbox")
      .update({ status: "processing", claimed_at: new Date().toISOString(), attempt_count: job.attempt_count + 1, last_error: null })
      .eq("id", job.id)
      .eq("attempt_count", job.attempt_count)
      .in("status", ["pending", "configuration_pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    try {

    const [{ data: quote, error: quoteError }, { data: recipient, error: recipientError }, { data: preferences, error: preferencesError }, authResult] = await Promise.all([
      admin.from("quote_requests").select("id, client_name, event_date, city, state, status, professional_response, categories(name), professional_profiles(display_name)").eq("id", job.quote_id).single(),
      admin.from("profiles").select("full_name, phone").eq("id", job.recipient_id).single(),
      admin.from("notification_preferences").select("email_enabled, whatsapp_enabled, whatsapp_opted_in_at").eq("user_id", job.recipient_id).maybeSingle(),
      admin.auth.admin.getUserById(job.recipient_id),
    ]);

    if (preferencesError || authResult.error) throw new Error("Notification preference or identity lookup failed");
    if (quoteError || recipientError || !quote || !recipient) {
      await admin.from("notification_outbox").update({ status: "failed", next_attempt_at: new Date(Date.now() + 60000).toISOString(), last_error: "Dados do pedido ou destinatário indisponíveis." }).eq("id", job.id);
      pending += 1;
      continue;
    }

    const category = Array.isArray(quote.categories) ? quote.categories[0]?.name : quote.categories?.name;
    const professional = Array.isArray(quote.professional_profiles) ? quote.professional_profiles[0]?.display_name : quote.professional_profiles?.display_name;
    const copy = eventCopy[job.event_type];
    if (!copy) throw new Error("Unsupported notification event");
    const dashboardUrl = "https://readystaff.site/painel.html";
    const details = job.event_type === "new_quote"
      ? `${quote.client_name} solicitou orçamento para ${category || "um serviço"} em ${quote.city}/${quote.state}.`
      : `${copy.title}. Abra o pedido de ${category || "um serviço"} no painel para conferir os detalhes da conversa.`;

    const whatsappAllowed = Boolean(preferences?.whatsapp_enabled && preferences?.whatsapp_opted_in_at);
    const emailAllowed = preferences?.email_enabled !== false;
    if (!whatsappAllowed && !emailAllowed) {
      await admin.from("notification_outbox").update({ status: "skipped", last_error: "Avisos desativados pelo usuário.", processed_at: new Date().toISOString() }).eq("id", job.id);
      continue;
    }
    let sentChannel = "";
    let lastError = "";
    let attempted = false;

    if (whatsappAllowed) {
      const phone = normalizePhone(recipient.phone);
      const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const conversationEvent = ["new_message", "new_proposal", "proposal_accepted", "proposal_declined", "service_completion"].includes(job.event_type);
      const templateName = Deno.env.get(job.event_type === "new_quote" ? "WHATSAPP_TEMPLATE_NEW_QUOTE" : conversationEvent ? "WHATSAPP_TEMPLATE_CONVERSATION_UPDATE" : "WHATSAPP_TEMPLATE_QUOTE_UPDATE") || (conversationEvent ? Deno.env.get("WHATSAPP_TEMPLATE_QUOTE_UPDATE") : "");
      if (phone && token && phoneNumberId && templateName) {
        const variables = job.event_type === "new_quote"
          ? [recipient.full_name, category || "serviço para evento", dashboardUrl]
          : [recipient.full_name, category || "serviço para evento", copy.title, dashboardUrl];
        attempted = true;
        try {
        const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: templateName,
              language: { code: "pt_BR" },
              components: [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }],
            },
          }),
        });
        if (response.ok) sentChannel = "whatsapp";
        else lastError = `WhatsApp: ${response.status}`;
        } catch (_) { lastError = "WhatsApp: falha de conexão ou tempo esgotado."; }
      } else {
        lastError = "WhatsApp ainda não configurado.";
      }
    }

    if (!sentChannel && emailAllowed) {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("READYSTAFF_EMAIL_FROM");
      const recipientEmail = authResult.data.user?.email;
      if (apiKey && from && recipientEmail) {
        attempted = true;
        try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `readystaff-${job.id}`,
          },
          body: JSON.stringify({
            from,
            to: [recipientEmail],
            subject: copy.subject,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#073760"><h1>${escapeHtml(copy.title)}</h1><p>Olá, ${escapeHtml(recipient.full_name)}.</p><p>${escapeHtml(details)}</p><p><a href="${dashboardUrl}" style="display:inline-block;background:#078b7b;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Abrir meu painel</a></p><p style="color:#617682;font-size:12px">Aviso automático da ReadyStaff. Gerencie suas preferências de aviso no painel.</p></div>`,
          }),
        });
        if (response.ok) sentChannel = "email";
        else lastError = `${lastError} E-mail: ${response.status}`.trim();
        } catch (_) { lastError = `${lastError} E-mail: falha de conexão ou tempo esgotado.`.trim(); }
      } else {
        lastError = `${lastError} E-mail ainda não configurado.`.trim();
      }
    }

    if (sentChannel) {
      await admin.from("notification_outbox").update({ status: "sent", channel: sentChannel, processed_at: new Date().toISOString(), last_error: lastError || null }).eq("id", job.id);
      processed += 1;
    } else {
      const minutes = attempted ? [1, 5, 15, 60, 240][Math.min(job.attempt_count, 4)] : 60;
      await admin.from("notification_outbox").update({ status: attempted ? "failed" : "configuration_pending", next_attempt_at: new Date(Date.now() + minutes * 60000).toISOString(), last_error: lastError || "Nenhum canal habilitado." }).eq("id", job.id);
      pending += 1;
    }
    } catch (_) {
      await admin.from("notification_outbox").update({ status: "failed", next_attempt_at: new Date(Date.now() + 60000).toISOString(), last_error: "Não foi possível concluir o envio. Verifique a configuração." }).eq("id", job.id).eq("status", "processing");
      pending += 1;
    }
  }

  return json({ processed, pending });
  }
  EdgeRuntime.waitUntil(processJobs().catch(() => console.error("ReadyStaff: falha no processamento dos avisos.")));
  return json({ queued: true });
});
