import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateDailyPrompt(context: {
  parentName: string;
  childName: string;
  childAge: number;
  recentTopics: string[];
}): Promise<string> {
  const { parentName, childName, childAge, recentTopics } = context;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5-20251101",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are a thoughtful guide helping a parent named ${parentName} write a letter to their child ${childName}, who is currently ${childAge} years old.

Generate ONE short, specific, emotionally resonant writing prompt. The prompt should invite the parent to share a real memory, lesson, or piece of wisdom.

Rules:
- One prompt only — no lists, no options
- 1-2 sentences maximum
- Avoid these recently used topics: ${recentTopics.join(", ") || "none"}
- Do not use the word "journey", "legacy", or "wisdom"
- Speak directly to the parent, not about them

Return only the prompt text. No preamble.`,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parentId, parentName, childName, childAge } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recent topics to avoid repetition
    const { data: recentEntries } = await supabase
      .from("entries")
      .select("domain")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentTopics = recentEntries?.map((e: { domain: string }) => e.domain) ?? [];

    const prompt = await generateDailyPrompt({ parentName, childName, childAge, recentTopics });

    return new Response(JSON.stringify({ prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-prompt]", err);
    return new Response(JSON.stringify({ error: "Failed to generate prompt" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
