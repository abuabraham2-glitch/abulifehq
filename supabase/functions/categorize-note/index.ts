import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { content } = await req.json();
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "content is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a note assistant. Read the note content and return ONLY a JSON object with two fields: note_type (one of: Movies & Shows, Books & Articles, Idea, Places & Activities, Memory, Reminder, People, Family, Wish List, Business, Finance, Home Info, Health & Medical, Quotes, Exercise Log, Logins & Codes, Reference, Recipes, General) and suggested_title (a short 2-6 word title that describes the note — for URLs extract the topic, for lists use the subject, for ideas summarize it). Example: {"note_type": "Recipes", "suggested_title": "Honey Garlic Roasted Carrots"}. Nothing else.`,
          },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    
    let noteType = "General";
    let suggestedTitle = "";
    try {
      const jsonMatch = raw.match(/\{[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.note_type) noteType = parsed.note_type;
        if (parsed.suggested_title) suggestedTitle = parsed.suggested_title;
      }
    } catch {
      noteType = "General";
    }

    return new Response(JSON.stringify({ note_type: noteType, suggested_title: suggestedTitle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("categorize-note error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
