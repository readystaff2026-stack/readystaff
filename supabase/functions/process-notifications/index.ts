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
  return digits.length >= 12 ? digits : "";
};

const eventCopy: Record<string, { subject: string; title: string }> = {
  new_quote: { subject: "Novo pedido de orçamento na ReadyStaff", title: "Você recebeu um novo pedido" },
  quote_accepted: { subject: "Seu pedido foi aceito na ReadyStaff", title: "Seu pedido foi aceito" },
  quote_declined: { subject: "Atualização do seu pedido na ReadyStaff", title: "O profissional respondeu ao pedido" },
  quote_cancelled: { subject: "Pedido cancelado na ReadyStaff", title: "Um pedido foi cancelado" },
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

  let body: { quote_id?: string } = {};
  try { body = await request.json(); } catch { /* empty body is valid */ }

  let quoteIds: string[] = [];
  if (body.quote_id) {
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
      .in("status", ["pending", "configuration_pending", "failed"])
      .order("created_at", { ascending: true })
      .limit(10);
    quoteIds = [...new Set((recipientRows ?? []).map((row) => row.quote_id))];
  }

  if (!quoteIds.length) return json({ processed: 0, pending: 0 });

  const { data: jobs, error: jobsError } = await admin
    .from("notification_outbox")
    .select("id, quote_id, recipient_id, event_type, attempt_count")
    .in("quote_id", quoteIds)
    .in("status", ["pending", "configuration_pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(10);
  if (jobsError) return json({ error: "Não foi possível consultar os avisos." }, 500);

  let processed = 0;
  let pending = 0;
  for (const job of jobs ?? []) {
    const { data: claimed } = await admin
      .from("notification_outbox")
      .update({ status: "processing", attempt_count: job.attempt_count + 1, last_error: null })
      .eq("id", job.id)
      .in("status", ["pending", "configuration_pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const [{ data: quote }, { data: recipient }, { data: preferences }, authResult] = await Promise.all([
      admin.from("quote_requests").select("id, client_name, event_date, city, state, status, professional_response, categories(name), professional_profiles(display_name)").eq("id", job.quote_id).single(),
      admin.from("profiles").select("full_name, phone").eq("id", job.recipient_id).single(),
      admin.from("notification_preferences").select("email_enabled, whatsapp_enabled, whatsapp_opted_in_at").eq("user_id", job.recipient_id).maybeSingle(),
      admin.auth.admin.getUserById(job.recipient_id),
    ]);

    if (!quote || !recipient) {
      await admin.from("notification_outbox").update({ status: "failed", last_error: "Dados do pedido ou destinatário indisponíveis." }).eq("id", job.id);
      pending += 1;
      continue;
    }

    const category = Array.isArray(quote.categories) ? quote.categories[0]?.name : quote.categories?.name;
    const professional = Array.isArray(quote.professional_profiles) ? quote.professional_profiles[0]?.display_name : quote.professional_profiles?.display_name;
    const copy = eventCopy[job.event_type] ?? eventCopy.new_quote;
    const dashboardUrl = "https://readystaff.site/painel.html";
    const details = job.event_type === "new_quote"
      ? `${quote.client_name} solicitou orçamento para ${category || "um serviço"} em ${quote.city}/${quote.state}.`
      : `O pedido para ${category || "um serviço"}, enviado a ${professional || "um profissional"}, foi atualizado.`;

    const whatsappAllowed = Boolean(preferences?.whatsapp_enabled && preferences?.whatsapp_opted_in_at);
    const emailAllowed = preferences?.email_enabled !== false;
    let sentChannel = "";
    let lastError = "";

    if (whatsappAllowed) {
      const phone = normalizePhone(recipient.phone);
      const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const templateName = Deno.env.get(job.event_type === "new_quote" ? "WHATSAPP_TEMPLATE_NEW_QUOTE" : "WHATSAPP_TEMPLATE_QUOTE_UPDATE");
      if (phone && token && phoneNumberId && templateName) {
        const variables = job.event_type === "new_quote"
          ? [recipient.full_name, category || "serviço para evento", dashboardUrl]
          : [recipient.full_name, category || "serviço para evento", copy.title, dashboardUrl];
        const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
          method: "POST",
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
      } else {
        lastError = "WhatsApp ainda não configurado.";
      }
    }

    if (!sentChannel && emailAllowed) {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("READYSTAFF_EMAIL_FROM");
      const recipientEmail = authResult.data.user?.email;
      if (apiKey && from && recipientEmail) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `readystaff-${job.id}`,
          },
          body: JSON.stringify({
            from,
            to: [recipientEmail],
            subject: copy.subject,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#073760"><h1>${escapeHtml(copy.title)}</h1><p>Olá, ${escapeHtml(recipient.full_name)}.</p><p>${escapeHtml(details)}</p>${quote.professional_response ? `<p><strong>Resposta:</strong> ${escapeHtml(quote.professional_response)}</p>` : ""}<p><a href="${dashboardUrl}" style="display:inline-block;background:#078b7b;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Abrir meu painel</a></p><p style="color:#617682;font-size:12px">Aviso automático da ReadyStaff.</p></div>`,
          }),
        });
        if (response.ok) sentChannel = "email";
        else lastError = `${lastError} E-mail: ${response.status}`.trim();
      } else {
        lastError = `${lastError} E-mail ainda não configurado.`.trim();
      }
    }

    if (sentChannel) {
      await admin.from("notification_outbox").update({ status: "sent", channel: sentChannel, processed_at: new Date().toISOString(), last_error: lastError || null }).eq("id", job.id);
      processed += 1;
    } else {
      await admin.from("notification_outbox").update({ status: "configuration_pending", last_error: lastError || "Nenhum canal habilitado." }).eq("id", job.id);
      pending += 1;
    }
  }

  return json({ processed, pending });
});

