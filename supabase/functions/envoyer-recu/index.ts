import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { emailDestinataire, nomDestinataire, sujet, contenuHTML, pdfBase64, nomFichierPDF }
      = await req.json();

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Clé Brevo manquante" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const brevo = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        sender:      { name: "HSI37", email: "handicapsi37@gmail.com" },
        to:          [{ email: emailDestinataire, name: nomDestinataire }],
        subject:     sujet,
        htmlContent: contenuHTML,
        ...(pdfBase64 ? { attachment: [{ name: nomFichierPDF, content: pdfBase64 }] } : {}),
      }),
    });

    if (!brevo.ok) {
      const err = await brevo.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.message || `Erreur Brevo ${brevo.status}` }), {
        status: brevo.status, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
