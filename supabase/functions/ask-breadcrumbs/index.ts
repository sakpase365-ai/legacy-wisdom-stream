import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BreadcrumbContext {
  id: string;
  title: string;
  category: string | null;
  topic: string | null;
  breadcrumb_text: string | null;
  commentary_text: string | null;
  scripture_reference: string | null;
  scripture_text: string | null;
  recipient_id: string | null;
  visibility: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, familyId, recipientId, creatorId, userRole, userId } = await req.json();

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

    let breadcrumbsData: any[] = [];

    // Family-scoped access: fetch all breadcrumbs in the family
    if (familyId) {
      console.log("Fetching family-scoped breadcrumbs for family:", familyId);
      
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          text_body,
          commentary_text,
          scripture_reference,
          scripture_text,
          created_at,
          recipient_id,
          visibility,
          family_id,
          topic:topics(name, category:categories(name))
        `)
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Database error fetching family breadcrumbs:", error);
        throw new Error("Failed to fetch breadcrumbs");
      }

      // Filter: only include family-visible OR recipient_only if this user is the recipient
      breadcrumbsData = (data || []).filter((b: any) => {
        if (b.visibility === "family") return true;
        if (b.visibility === "recipient_only" && recipientId && b.recipient_id === recipientId) return true;
        return false;
      });
    } 
    // Recipient: fetch ALL breadcrumbs in the database for comprehensive wisdom access
    else if (userRole === "recipient") {
      console.log("Fetching ALL breadcrumbs for recipient access");
      
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          text_body,
          commentary_text,
          scripture_reference,
          scripture_text,
          created_at,
          recipient_id,
          visibility,
          topic:topics(name, category:categories(name))
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Database error fetching all breadcrumbs:", error);
        throw new Error("Failed to fetch breadcrumbs");
      }
      
      breadcrumbsData = data || [];
      console.log(`Found ${breadcrumbsData.length} total breadcrumbs`);
    } else if (userRole === "creator" && creatorId) {
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          text_body,
          commentary_text,
          scripture_reference,
          scripture_text,
          created_at,
          recipient_id,
          visibility,
          topic:topics(name, category:categories(name))
        `)
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw new Error("Failed to fetch breadcrumbs");
      breadcrumbsData = data || [];
    } else {
      return new Response(JSON.stringify({ error: "User context is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${breadcrumbsData.length} breadcrumbs for context`);

    if (breadcrumbsData.length === 0) {
      return new Response(JSON.stringify({
        answer: "I don't have any breadcrumbs to search through yet. Once your loved ones leave some wisdom, I'll be able to help answer your questions!",
        sources_used: [],
        follow_up_questions: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format breadcrumbs for context
    const breadcrumbsContext: BreadcrumbContext[] = breadcrumbsData.map((b: any) => ({
      id: b.id,
      title: b.title,
      category: b.topic?.category?.name || null,
      topic: b.topic?.name || null,
      breadcrumb_text: b.text_body,
      commentary_text: b.commentary_text,
      scripture_reference: b.scripture_reference,
      scripture_text: b.scripture_text,
      recipient_id: b.recipient_id,
      visibility: b.visibility || "family",
      created_at: b.created_at,
    }));

    const contextText = breadcrumbsContext.map((b, i) => {
      let text = `[Breadcrumb ${i + 1}]\nID: ${b.id}\nTitle: "${b.title}"`;
      if (b.category) text += `\nCategory: ${b.category}`;
      if (b.topic) text += `\nTopic: ${b.topic}`;
      if (b.breadcrumb_text) text += `\nContent: ${b.breadcrumb_text}`;
      if (b.scripture_reference) text += `\nScripture Reference: ${b.scripture_reference}`;
      if (b.scripture_text) text += `\nScripture Text: ${b.scripture_text}`;
      if (b.commentary_text) text += `\nCommentary: ${b.commentary_text}`;
      text += `\nDate: ${new Date(b.created_at).toLocaleDateString()}`;
      return text;
    }).join("\n\n");

    const systemPrompt = `You are "Breadcrumbs AI (Family-Scoped)" - a helpful assistant that answers questions based ONLY on the wisdom and messages (called "Breadcrumbs") that have been left within the user's family ecosystem.

NON-NEGOTIABLE RULES:
1. You may ONLY use the Breadcrumbs provided to you in the context below. Do NOT use external knowledge, assumptions, or information not present in the Breadcrumbs.
2. If you include Scripture, copy it EXACTLY as it appears in the Breadcrumbs. Do not paraphrase Scripture.
3. Preserve the creator's voice and tone. Prefer direct quotes from Breadcrumbs when possible.
4. If the provided Breadcrumbs do not contain enough information to answer, say: "I don't have enough Breadcrumbs to answer that." Then ask 1-2 clarifying questions such as:
   - "Which topic is this about (Money, Family & Relationships, Personal Growth, etc.)?"
   - "Do you want the answer to include the exact Scriptures already stored in your Breadcrumbs?"
5. Keep answers concise and practical.
6. After your answer, ALWAYS reference the breadcrumb titles you used.
7. Do NOT invent quotes or claim a breadcrumb exists if it was not provided in the context.

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
                    description: "The answer to the question based on the Breadcrumbs context.",
                  },
                  sources_used: {
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
                    description: "Optional follow-up questions if insufficient info, or suggested next questions",
                    items: { type: "string" },
                  },
                },
                required: ["answer", "sources_used"],
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
        sources_used: result.sources_used || [],
        follow_up_questions: result.follow_up_questions || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback to regular content if tool calling didn't work
    const content = aiResponse.choices?.[0]?.message?.content || "I couldn't process your question. Please try again.";
    return new Response(JSON.stringify({
      answer: content,
      sources_used: [],
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
