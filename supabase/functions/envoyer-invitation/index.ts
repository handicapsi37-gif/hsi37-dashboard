import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Contact {
  email: string;
  nom:   string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { evenement_id, objet_email, corps_email } = await req.json();

    if (!evenement_id || !objet_email || !corps_email) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants : evenement_id, objet_email, corps_email requis" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, supabaseKey);

    // Récupération des 3 listes en parallèle
    const [resAdh, resDon, resPart] = await Promise.all([
      supabase.from("adherents").select("email, nom, prenom"),
      supabase.from("donateurs").select("email, nom, prenom"),
      supabase.from("participants_evenements")
               .select("email, nom, prenom")
               .eq("evenement_id", evenement_id),
    ]);

    if (resAdh.error)  throw new Error("Adhérents : "    + resAdh.error.message);
    if (resDon.error)  throw new Error("Donateurs : "    + resDon.error.message);
    if (resPart.error) throw new Error("Participants : " + resPart.error.message);

    // Fusion + dédoublonnage par email (insensible à la casse)
    const vus    = new Set<string>();
    const valides: Contact[] = [];
    let exclus   = 0;

    const toutes = [
      ...(resAdh.data  ?? []),
      ...(resDon.data  ?? []),
      ...(resPart.data ?? []),
    ];

    for (const row of toutes) {
      const email = (row.email ?? "").trim().toLowerCase();

      if (!email) {
        exclus++;
        continue;
      }

      if (vus.has(email)) continue; // doublon inter-tables, non comptabilisé en exclus

      vus.add(email);
      valides.push({
        email,
        nom: [row.prenom, row.nom].filter(Boolean).join(" ") || email,
      });
    }

    return new Response(
      JSON.stringify({ envoyes: valides.length, exclus }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
