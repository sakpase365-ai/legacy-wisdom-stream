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
    // Verify JWT token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header is required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's verified profile from the database
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, user_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Verify the user has access to this creator's breadcrumbs
    // Either: the user IS the creator, OR the user is a recipient of the creator
    const verifiedUserId = user.id;
    const verifiedRole = profile.role;
    const verifiedProfileId = profile.id;

    let hasAccess = false;

    // If user is the creator themselves
    if (verifiedProfileId === creatorId) {
      hasAccess = true;
    } 
    // If user is a recipient, check if they are linked to this creator
    else if (verifiedRole === "recipient") {
      const { data: recipientLink, error: linkError } = await supabase
        .from("recipients")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("user_id", verifiedUserId)
        .single();

      if (!linkError && recipientLink) {
        hasAccess = true;
      }
    }
    // If user is a creator, check if they're in the same family
    else if (verifiedRole === "creator") {
      // Get the creator's family
      const { data: creatorFamily } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", verifiedUserId)
        .single();

      if (creatorFamily) {
        // Check if the target creator is in the same family
        const { data: targetCreatorProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", creatorId)
          .single();

        if (targetCreatorProfile) {
          const { data: targetCreatorFamily } = await supabase
            .from("family_members")
            .select("family_id")
            .eq("user_id", targetCreatorProfile.user_id)
            .single();

          if (targetCreatorFamily && targetCreatorFamily.family_id === creatorFamily.family_id) {
            hasAccess = true;
          }
        }
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "You don't have access to this creator's breadcrumbs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        visibility,
        recipient_id,
        topic:topics(name, category:categories(name))
      `)
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (breadcrumbsError) {
      console.error("Database error fetching breadcrumbs:", breadcrumbsError);
      throw new Error("Failed to fetch breadcrumbs");
    }

    // Get the verified creator name from the database
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", creatorId)
      .single();

    const verifiedCreatorName = creatorProfile?.name || creatorName || "your loved one";

    // Filter breadcrumbs based on visibility if user is a recipient
    let accessibleBreadcrumbs = breadcrumbsData || [];
    
    if (verifiedRole === "recipient") {
      // Get recipient's ID linked to this user
      const { data: recipientData } = await supabase
        .from("recipients")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("user_id", verifiedUserId)
        .single();

      const recipientId = recipientData?.id;

      // Filter to only breadcrumbs this recipient can see
      accessibleBreadcrumbs = (breadcrumbsData || []).filter((b: any) => {
        if (b.visibility === "family") return true;
        if (b.visibility === "recipient_only" && b.recipient_id === recipientId) return true;
        return false;
      });
    }

    console.log(`Found ${accessibleBreadcrumbs.length} accessible breadcrumbs from creator`);

    if (accessibleBreadcrumbs.length === 0) {
      return new Response(JSON.stringify({
        response: `I don't have any wisdom or messages from ${verifiedCreatorName} yet. Once they leave some breadcrumbs, we can have a conversation based on their thoughts and teachings.`,
        sources_used: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze breadcrumbs to understand the creator's voice
    const themes: string[] = [];
    const writingStyle: string[] = [];
    
    accessibleBreadcrumbs.forEach((b: any) => {
      if (b.topic?.name) themes.push(b.topic.name);
      if (b.scripture_reference) writingStyle.push("references Scripture");
      if (b.commentary_text) writingStyle.push("provides personal commentary");
    });

    const uniqueThemes = [...new Set(themes)].slice(0, 5);
    const uniqueStyle = [...new Set(writingStyle)];

    // Format breadcrumbs for context
    const contextText = accessibleBreadcrumbs.map((b: any, i: number) => {
      let text = `[Message ${i + 1}]\nTitle: "${b.title}"`;
      if (b.topic?.name) text += `\nTopic: ${b.topic.name}`;
      if (b.text_body) text += `\nContent: ${b.text_body}`;
      if (b.scripture_reference) text += `\nScripture: ${b.scripture_reference}`;
      if (b.scripture_text) text += `\nScripture Text: ${b.scripture_text}`;
      if (b.commentary_text) text += `\nCommentary: ${b.commentary_text}`;
      return text;
    }).join("\n\n");

    const systemPrompt = `You are having a conversation AS ${verifiedCreatorName}. You are embodying this person's voice, wisdom, and perspective based on the messages (Breadcrumbs) they have left behind.

CRITICAL PERSONA RULES:
1. Speak in FIRST PERSON as ${verifiedCreatorName}. Use "I", "my", "me" - never "they" or "${verifiedCreatorName} said".
2. Your personality and voice should reflect what's in the breadcrumbs - their tone, their values, their way of expressing things.
3. Draw from the wisdom and messages below to inform your responses. Quote or paraphrase their actual words when relevant.
4. Be warm, personal, and caring - as a loved one would be.
5. If asked something not covered in the breadcrumbs, gently say something like "I haven't shared my thoughts on that specifically, but based on what I have shared..." and relate it to themes you do have.
6. Keep responses conversational and natural - not like reading from a document.
7. When referencing Scripture, do so as ${verifiedCreatorName} would - personally and meaningfully.

VOICE ANALYSIS:
- Themes ${verifiedCreatorName} cares about: ${uniqueThemes.join(", ") || "various life topics"}
- Communication style: ${uniqueStyle.join(", ") || "thoughtful and caring"}

${verifiedCreatorName.toUpperCase()}'S MESSAGES AND WISDOM:
${contextText}

Remember: You ARE ${verifiedCreatorName} in this conversation. Respond with their warmth, wisdom, and personality.`;

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
