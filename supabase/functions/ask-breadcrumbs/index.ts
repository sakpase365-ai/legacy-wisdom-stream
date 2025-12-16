import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BreadcrumbContext {
  id: string;
  title: string;
  topic_name: string | null;
  content: string | null;
  commentary_text: string | null;
  scripture_reference: string | null;
  scripture_text: string | null;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, recipientId, creatorId, userRole } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
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

    // Fetch breadcrumbs based on user role
    let breadcrumbsQuery = supabase
      .from("breadcrumbs")
      .select(`
        id,
        title,
        text_body,
        commentary_text,
        scripture_reference,
        scripture_text,
        created_at,
        topic:topics(name)
      `)
      .order("created_at", { ascending: false })
      .limit(20);

    if (userRole === "recipient" && recipientId) {
      breadcrumbsQuery = breadcrumbsQuery.eq("recipient_id", recipientId);
    } else if (userRole === "creator" && creatorId) {
      breadcrumbsQuery = breadcrumbsQuery.eq("creator_id", creatorId);
    } else if (recipientId) {
      // Default to recipient if recipientId is provided
      breadcrumbsQuery = breadcrumbsQuery.eq("recipient_id", recipientId);
    } else {
      return new Response(JSON.stringify({ error: "User context is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: breadcrumbs, error: dbError } = await breadcrumbsQuery;

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to fetch breadcrumbs");
    }

    if (!breadcrumbs || breadcrumbs.length === 0) {
      return new Response(JSON.stringify({
        answer: "I don't have any breadcrumbs to search through yet. Once your loved ones leave some wisdom for you, I'll be able to help answer your questions!",
        sources: [],
        follow_up_questions: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format breadcrumbs for context
    const breadcrumbsContext: BreadcrumbContext[] = breadcrumbs.map((b: any) => ({
      id: b.id,
      title: b.title,
      topic_name: b.topic?.name || null,
      content: b.text_body,
      commentary_text: b.commentary_text,
      scripture_reference: b.scripture_reference,
      scripture_text: b.scripture_text,
      created_at: b.created_at,
    }));

    const contextText = breadcrumbsContext.map((b, i) => {
      let text = `[Breadcrumb ${i + 1}]\nID: ${b.id}\nTitle: "${b.title}"`;
      if (b.topic_name) text += `\nTopic: ${b.topic_name}`;
      if (b.content) text += `\nContent: ${b.content}`;
      if (b.scripture_reference) text += `\nScripture Reference: ${b.scripture_reference}`;
      if (b.scripture_text) text += `\nScripture Text: ${b.scripture_text}`;
      if (b.commentary_text) text += `\nCommentary: ${b.commentary_text}`;
      text += `\nDate: ${new Date(b.created_at).toLocaleDateString()}`;
      return text;
    }).join("\n\n");

    const systemPrompt = `You are the "Breadcrumbs Answer Agent" - a helpful assistant that answers questions based ONLY on the wisdom and messages (called "Breadcrumbs") that have been left for the user.

CRITICAL RULES:
1. Use ONLY the provided Breadcrumbs context below. Do NOT use any external knowledge or make up information.
2. If the Breadcrumbs do not contain enough information to answer the question, say: "I don't have enough Breadcrumbs to answer that." Then ask 1-2 clarifying questions to help the user refine their question.
3. Keep answers concise and practical.
4. After your answer, ALWAYS include a "Sources used" section listing the breadcrumb titles you referenced.
5. Do NOT invent quotes or claim a breadcrumb exists if it was not provided in the context.
6. If you reference a breadcrumb, use its exact title.

AVAILABLE BREADCRUMBS CONTEXT:
${contextText}`;

    // Call Lovable AI with tool calling for structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_answer",
              description: "Provide a structured answer to the user's question based on the Breadcrumbs context.",
              parameters: {
                type: "object",
                properties: {
                  answer: {
                    type: "string",
                    description: "The answer to the question based on the Breadcrumbs context. Include the Sources used section at the end.",
                  },
                  sources: {
                    type: "array",
                    description: "List of breadcrumbs used to form the answer",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "The breadcrumb ID" },
                        title: { type: "string", description: "The breadcrumb title" },
                      },
                      required: ["id", "title"],
                    },
                  },
                  follow_up_questions: {
                    type: "array",
                    description: "Optional follow-up questions the user might want to ask",
                    items: { type: "string" },
                  },
                },
                required: ["answer", "sources"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_answer" } },
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
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Extract the tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({
        answer: result.answer,
        sources: result.sources || [],
        follow_up_questions: result.follow_up_questions || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback to regular content if tool calling didn't work
    const content = aiResponse.choices?.[0]?.message?.content || "I couldn't process your question. Please try again.";
    return new Response(JSON.stringify({
      answer: content,
      sources: [],
      follow_up_questions: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ask-breadcrumbs:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
