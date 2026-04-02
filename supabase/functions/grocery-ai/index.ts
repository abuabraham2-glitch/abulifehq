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

    const { type, item, image_base64 } = await req.json();

    if (type === "categorize") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a grocery list assistant. The user is adding a grocery item. Assign it to exactly one of these sections: Produce, Meat & Seafood, Dairy & Eggs, Bakery & Bread, Pantry & Dry Goods, Frozen, Beverages, Spices/Condiments/Sauces, Household, Personal Care, Other. Respond with ONLY a JSON object like: {"section": "Produce"}. Nothing else.`,
            },
            { role: "user", content: item },
          ],
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI error", status: response.status }), {
          status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      // Extract JSON from response
      const jsonMatch = content.match(/\{[^}]+\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { section: "Other" };

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "parse_image") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a grocery list assistant. Read every item from this image of a handwritten grocery list. For each item, assign it to exactly one of these sections: Produce, Meat & Seafood, Dairy & Eggs, Bakery & Bread, Pantry & Dry Goods, Frozen, Beverages, Spices/Condiments/Sauces, Household, Personal Care, Other. Respond with ONLY a JSON array like: [{"item": "milk", "section": "Dairy & Eggs"}, {"item": "apples", "section": "Produce"}]. Nothing else.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${image_base64}` },
                },
                { type: "text", text: "Read all grocery items from this image." },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI error", status: response.status }), {
          status: response.status === 429 ? 429 : response.status === 402 ? 402 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      return new Response(JSON.stringify({ items: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grocery-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
