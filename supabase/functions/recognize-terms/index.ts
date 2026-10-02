// Supabase Edge Function: reads a photo of a textbook page with Claude and returns its terms.
// The Anthropic API key lives only here, as the secret ANTHROPIC_API_KEY; the app never sees it.
// Signed-in students only, with a daily limit per account (AI_DAILY_LIMIT, default 30).
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@0.131.0/helpers/zod";
import { z } from "npm:zod@4.6.5";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const LANGS: Record<string, string> = { nl: "Nederlands", en: "Engels", fr: "Frans", de: "Duits", es: "Spaans", it: "Italiaans", la: "Latijn", xx: "de taal van het boek" };
/** About 3.5 MB of JPEG; the app sends a page scaled to 1568 px, which is far less. */
const MAX_IMAGE_CHARS = 4_700_000;

const Result = z.object({
  readable: z.boolean().describe("false when the photo is too blurry, too dark or not a page of text"),
  title: z.string().describe("the chapter or section heading on the page, or an empty string"),
  terms: z.array(
    z.object({
      term: z.string().describe("the term exactly as printed, without a trailing colon"),
      explanation: z.string().describe("a short explanation (one or two sentences) based on the page, without the term itself"),
    }),
  ),
});

const SYSTEM = `Je maakt leerkaartjes van een foto van een bladzijde uit een schoolboek, voor een leerling op de middelbare school.

Begrippen zijn woorden of woordgroepen die in de lopende tekst vet of schuin gedrukt zijn, kopjes in hoofdletters aan het begin van een alinea, en begrippen in een begrippenkader of in de kantlijn. Een begrip van meerdere woorden is één begrip.

Per begrip:
- Schrijf een korte uitleg van één of twee zinnen (hooguit 35 woorden) in de taal van het boek, op basis van wat er op de bladzijde staat. Lees daarvoor de zinnen eromheen, ook als de uitleg in de zin ervoor of erna staat, of in een andere kolom verdergaat.
- Noem het begrip zelf niet in de uitleg, zodat de kaart ook andersom gevraagd kan worden.
- Verzin niets dat niet uit de bladzijde blijkt.

Sla over: paginanummers, de naam van het boek, onderschriften bij afbeeldingen, bronvermeldingen, opdrachten en gewone kopjes die geen begrip zijn. Geef elk begrip maar één keer. Lukt het lezen niet, geef dan readable false en een lege lijst.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method" });

  // Who is asking: the student's own session token.
  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who.user) return json(401, { error: "not-signed-in" });

  let body: { image?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad-request" });
  }
  const image = typeof body.image === "string" ? body.image : "";
  const lang = typeof body.lang === "string" && body.lang in LANGS ? body.lang : "nl";
  if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return json(400, { error: "bad-image" });

  // Count this page against the daily limit (in the database, so it holds across devices).
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const limit = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "30");
  const { data: allowed, error: limitError } = await admin.rpc("use_ai", { uid: who.user.id, max_per_day: limit });
  if (limitError) return json(500, { error: "limit-check" });
  if (allowed !== true) return json(429, { error: "limit", limit });

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: `De tekst is in het ${LANGS[lang]}. Maak de leerkaartjes.` },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(Result) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return json(422, { error: "unreadable" });
    return json(200, response.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: "busy" });
    if (e instanceof Anthropic.AuthenticationError) return json(500, { error: "server-key" });
    if (e instanceof Anthropic.APIError) return json(502, { error: "ai", status: e.status });
    return json(500, { error: "unknown" });
  }
});
