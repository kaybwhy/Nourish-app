import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nourish-webhook-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
async function sendEmail(to: string, subject: string, text: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  if (!resendKey || !adminEmail || !fromEmail) throw new Error("Email secrets are not configured");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: fromEmail, to: [adminEmail], subject, text }) });
  if (!response.ok) throw new Error("Email provider rejected the request");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  const body = await req.json().catch(() => ({}));
  // Database Webhook path: only trusted if the private webhook secret matches.
  const expectedSecret = Deno.env.get("NOURISH_WEBHOOK_SECRET");
  if (expectedSecret && req.headers.get("x-nourish-webhook-secret") === expectedSecret && body.type === "INSERT" && body.record?.email) {
    try {
      await sendEmail(body.record.email, "New Nourish sign-up", `A new Nourish account was created.\nEmail: ${body.record.email}\nUser ID: ${body.record.id}\nCreated: ${body.record.created_at || new Date().toISOString()}`);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } }); }
  }
  return new Response("Invalid webhook secret", { status: 401, headers: cors });
});
