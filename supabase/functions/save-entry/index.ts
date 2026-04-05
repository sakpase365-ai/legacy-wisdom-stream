import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function anthropic(prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5-20251101",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

async function tagEntry(content: string, childAge: number) {
  const raw = await anthropic(
    `Analyze this parent's written entry and return a JSON object with these fields:
- domain: one of [relationships, finances, resilience, career, identity, faith, health]
- relevantAge: the age (integer) at which this wisdom would be most useful to the child
- deliveryType: one of [age-locked, milestone, evergreen]
- summary: one sentence summary of the core lesson (max 20 words)

Entry: """${content}"""
Child's current age: ${childAge}

Return only valid JSON. No markdown, no explanation.`,
    200
  );
  return JSON.parse(raw);
}

async function generateFollowUp(entry: string): Promise<string> {
  return anthropic(
    `A parent has written this entry: """${entry}"""

Ask ONE short follow-up question to draw out more specific detail or emotional depth.
One sentence only. No preamble. Make it feel like a trusted listener, not an interviewer.`,
    150
  );
}

function differenceInYears(date1: Date, date2: Date): number {
  let years = date1.getFullYear() - date2.getFullYear();
  const m = date1.getMonth() - date2.getMonth();
  if (m < 0 || (m === 0 && date1.getDate() < date2.getDate())) years--;
  return years;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parentId, childName, childDob, content } = await req.json();

    const childAge = differenceInYears(new Date(), new Date(childDob));

    // Run tagging and follow-up generation in parallel
    const [tags, followUp] = await Promise.all([
      tagEntry(content, childAge),
      generateFollowUp(content),
    ]);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("entries")
      .insert({
        parent_id:     parentId,
        child_name:    childName,
        content,
        follow_up:     followUp,
        domain:        tags.domain,
        relevant_age:  tags.relevantAge,
        delivery_type: tags.deliveryType,
        summary:       tags.summary,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ entry: data, followUp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[save-entry]", err);
    return new Response(JSON.stringify({ error: "Failed to save entry" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
