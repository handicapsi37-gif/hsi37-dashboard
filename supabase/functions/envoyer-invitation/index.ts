import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Contact {
  email: string;
  nom:   string;
}

function construireHTML(corps: string, signataire: string, nomSignataire: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#FAFBFE;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <div style="background:#3B77B4;padding:24px 32px 0;">
      <img src="https://tafxmyylkzmxeyzztejw.supabase.co/storage/v1/object/public/assets/hsi37-redim-demi.png"
           height="56" alt="HSI37" style="display:block;"/>
      <div style="background:#F7CD46;height:3px;margin-top:20px;"></div>
    </div>

    <div style="padding:32px;color:#403E3E;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
      ${corps}
    </div>

    <div style="padding:0 32px 32px;font-family:Arial,sans-serif;font-size:14px;color:#403E3E;border-top:1px solid #e8edf4;margin:0 32px;">
      <p style="margin:24px 0 8px;">Cordialement,</p>
      <div style="border-left:4px solid #F7CD46;padding-left:14px;">
        <strong>${nomSignataire}</strong><br/>
        ${signataire} — HSI37<br/>
        <span style="color:#3B77B4;">handicapsi37@gmail.com &nbsp;·&nbsp; hsi37.fr</span>
      </div>
    </div>

    <div style="background:#3B77B4;padding:14px 32px;text-align:center;
                font-family:Arial,sans-serif;font-size:11px;color:#ffffff;">
      <span style="color:#ffffff !important;">
        HSI37 &nbsp;·&nbsp; 17 rue Gabriel Péri, 37700 Saint-Pierre-des-Corps
      </span>
    </div>

  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { emails, objet_email, corps_email, signataire, nom_signataire } = await req.json();

    if (!Array.isArray(emails) || !objet_email || !corps_email) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants : emails (tableau), objet_email, corps_email requis" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) throw new Error("Clé Brevo manquante");

    const sig    = signataire     || "La trésorière";
    const nomSig = nom_signataire || "BELHAJ Oum Keltoum";

    // Dédoublonnage par email (insensible à la casse)
    const vus    = new Set<string>();
    const valides: Contact[] = [];
    let exclus   = 0;

    for (const row of emails) {
      const email = (row.email ?? "").trim().toLowerCase();

      if (!email) {
        exclus++;
        continue;
      }

      if (vus.has(email)) continue;

      vus.add(email);
      valides.push({
        email,
        nom: row.nom || email,
      });
    }

    if (valides.length === 0) {
      return new Response(
        JSON.stringify({ envoyes: 0, exclus, erreurs: 0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const destinataires = valides.map(c => ({ email: c.email, name: c.nom }));

    const brevo = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        sender:      { name: "HSI37", email: "handicapsi37@gmail.com" },
        to:          destinataires,
        subject:     objet_email,
        htmlContent: construireHTML(corps_email, sig, nomSig),
      }),
    });

    if (!brevo.ok) {
      const err = await brevo.json().catch(() => ({}));
      throw new Error(err.message || `Erreur Brevo ${brevo.status}`);
    }

    return new Response(
      JSON.stringify({ envoyes: valides.length, exclus, erreurs: 0 }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
