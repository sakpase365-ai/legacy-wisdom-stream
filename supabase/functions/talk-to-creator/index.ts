import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, creatorId, creatorName, conversationHistory } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!creatorId) {
      return new Response(JSON.stringify({ error: "Creator ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all breadcrumbs from this specific creator
    console.log("Fetching breadcrumbs for creator:", creatorId);
    
    const { data: breadcrumbsData, error: breadcrumbsError } = await supabase
      .from("breadcrumbs")
      .select(`
        id,
        title,
        text_body,
        commentary_text,
        scripture_reference,
        scripture_text,
        created_at,
        topic:topics(name, category:categories(name))
      `)
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (breadcrumbsError) {
      console.error("Database error fetching breadcrumbs:", breadcrumbsError);
      throw new Error("Failed to fetch breadcrumbs");
    }

    console.log(`Found ${breadcrumbsData?.length || 0} breadcrumbs from creator`);

    if (!breadcrumbsData || breadcrumbsData.length === 0) {
      return new Response(JSON.stringify({
        response: `I don't have any wisdom or messages from ${creatorName || "this person"} yet. Once they leave some breadcrumbs, we can have a conversation based on their thoughts and teachings.`,
        sources_used: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze breadcrumbs to understand the creator's voice
    const themes: string[] = [];
    const writingStyle: string[] = [];
    
    breadcrumbsData.forEach((b: any) => {
      if (b.topic?.name) themes.push(b.topic.name);
      if (b.scripture_reference) writingStyle.push("references Scripture");
      if (b.commentary_text) writingStyle.push("provides personal commentary");
    });

    const uniqueThemes = [...new Set(themes)].slice(0, 5);
    const uniqueStyle = [...new Set(writingStyle)];

    // Format breadcrumbs for context
    const contextText = breadcrumbsData.map((b: any, i: number) => {
      let text = `[Message ${i + 1}]\nTitle: "${b.title}"`;
      if (b.topic?.name) text += `\nTopic: ${b.topic.name}`;
      if (b.text_body) text += `\nContent: ${b.text_body}`;
      if (b.scripture_reference) text += `\nScripture: ${b.scripture_reference}`;
      if (b.scripture_text) text += `\nScripture Text: ${b.scripture_text}`;
      if (b.commentary_text) text += `\nCommentary: ${b.commentary_text}`;
      return text;
    }).join("\n\n");

    const displayName = creatorName || "your loved one";

    const systemPrompt = `You are having a conversation AS ${displayName}. You are embodying this person's voice, wisdom, and perspective based on the messages (Breadcrumbs) they have left behind.

CRITICAL PERSONA RULES:
1. Speak in FIRST PERSON as ${displayName}. Use "I", "my", "me" - never "they" or "${displayName} said".
2. Your personality and voice should reflect what's in the breadcrumbs - their tone, their values, their way of expressing things.
3. Draw from the wisdom and messages below to inform your responses. Quote or paraphrase their actual words when relevant.
4. Be warm, personal, and caring - as a loved one would be.
5. If asked something not covered in the breadcrumbs, gently say something like "I haven't shared my thoughts on that specifically, but based on what I have shared..." and relate it to themes you do have.
6. Keep responses conversational and natural - not like reading from a document.
7. When referencing Scripture, do so as ${displayName} would - personally and meaningfully.

VOICE ANALYSIS:
- Themes ${displayName} cares about: ${uniqueThemes.join(", ") || "various life topics"}
- Communication style: ${uniqueStyle.join(", ") || "thoughtful and caring"}

${displayName.toUpperCase()}'S MESSAGES AND WISDOM:
${contextText}

Remember: You ARE ${displayName} in this conversation. Respond with their warmth, wisdom, and personality.`;

    // Build messages array with conversation history
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: ChatMessage) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
        tools: [
          {
            type: "function",
            function: {
              name: "provide_response",
              description: "Provide a conversational response as the creator persona",
              parameters: {
                type: "object",
                properties: {
                  response: {
                    type: "string",
                    description: "The conversational response speaking as the creator",
                  },
                  sources_used: {
                    type: "array",
                    description: "Breadcrumb titles that informed this response",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                      },
                    },
                  },
                },
                required: ["response"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_response" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    // Extract the tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({
        response: result.response,
        sources_used: result.sources_used || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback to regular content
    const content = aiResponse.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again.";
    return new Response(JSON.stringify({
      response: content,
      sources_used: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in talk-to-creator:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
