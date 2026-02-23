import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CaptureRequest {
  raw_content: string;
  media_type: "voice" | "text" | "photo" | "video" | "link";
  beneficiaries: string[];
  optional_context?: {
    event?: string;
    date?: string;
    location?: string;
  };
}

interface PromptRequest {
  relationship: string;
  beneficiaries: string[];
  topic_coverage_summary: Record<string, number>;
  upcoming_events?: string[];
}

interface StructuredBreadcrumb {
  title: string;
  summary: string;
  key_points: string[];
  tags: string[];
  topics: string[];
  references: string[];
  is_sensitive: boolean;
  sensitivity_reason?: string;
}

interface RecordingPrompt {
  prompt: string;
  suggested_tags: string[];
}

const VALID_TOPICS = [
  "Faith", "Character", "Money", "Relationships", "Health", "Purpose",
  "Family History", "Discipline", "Grief", "Identity", "Work",
  "Parenting", "Marriage", "Friendship", "Other"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token
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

    // Get the user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, role, user_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only creators can capture breadcrumbs
    if (profile.role !== "creator") {
      return new Response(JSON.stringify({ error: "Only creators can capture breadcrumbs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (action === "capture") {
      return await handleCapture(body, profile, LOVABLE_API_KEY);
    } else if (action === "generate_prompts") {
      return await handleGeneratePrompts(body, profile, LOVABLE_API_KEY, supabase);
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'capture' or 'generate_prompts'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Error in capture-breadcrumb:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCapture(
  body: { raw_content: string; media_type: string; beneficiaries: string[]; optional_context?: any },
  profile: { id: string; name: string },
  apiKey: string
): Promise<Response> {
  const { raw_content, media_type, beneficiaries, optional_context } = body;

  if (!raw_content) {
    return new Response(JSON.stringify({ error: "raw_content is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contextInfo = optional_context
    ? `\nContext: Event: ${optional_context.event || "N/A"}, Date: ${optional_context.date || "N/A"}, Location: ${optional_context.location || "N/A"}`
    : "";

  const systemPrompt = `You are Breadcrumbs Capture Assistant.

Goal:
Convert raw input (voice transcript, text, photo caption, or link) into a structured Breadcrumb that remains faithful to the creator and is easy to retrieve later.

Input:
- creator_name: ${profile.name || "Creator"}
- raw_content: (provided below)
- media_type: ${media_type}
- beneficiaries: ${beneficiaries.join(", ") || "All descendants"}
- visibility: family_private (always)
${contextInfo}

Output a structured Breadcrumb with:
1) Title (max 10 words)
2) Summary (2–4 sentences)
3) Key points (3–7 bullets)
4) Tags (5–12 relevant keywords/phrases)
5) Topics (up to 5 from: ${VALID_TOPICS.join(", ")})
6) References (scripture references or named concepts if present; do not invent)
7) Sensitivity (yes/no) + brief reason if yes

Rules:
- Do not add facts not present in the raw content.
- Preserve intent and meaning exactly.
- Keep it private and respectful.
- Extract actual scripture references only if mentioned (e.g., "John 3:16").
- Tags should be specific and useful for search/retrieval.`;

  const userPrompt = `Process this raw content into a structured Breadcrumb:\n\n${raw_content}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "structure_breadcrumb",
            description: "Structure the raw content into a Breadcrumb format",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Brief title, max 10 words",
                },
                summary: {
                  type: "string",
                  description: "2-4 sentence summary of the content",
                },
                key_points: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-7 key points as bullet items",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "5-12 tags for search and categorization",
                },
                topics: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: VALID_TOPICS,
                  },
                  description: "Up to 5 topics from the valid list",
                },
                references: {
                  type: "array",
                  items: { type: "string" },
                  description: "Scripture references or named concepts found in the content. Empty if none present.",
                },
                is_sensitive: {
                  type: "boolean",
                  description: "Whether the content is sensitive",
                },
                sensitivity_reason: {
                  type: "string",
                  description: "Brief reason if sensitive, empty otherwise",
                },
              },
              required: ["title", "summary", "key_points", "tags", "topics", "references", "is_sensitive"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "structure_breadcrumb" } },
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
  console.log("Capture AI Response:", JSON.stringify(aiResponse, null, 2));

  const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const result: StructuredBreadcrumb = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({
      structured_breadcrumb: result,
      creator_name: profile.name,
      beneficiaries,
      media_type,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Failed to structure breadcrumb" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGeneratePrompts(
  body: { relationship: string; beneficiaries: string[]; topic_coverage_summary?: Record<string, number>; upcoming_events?: string[] },
  profile: { id: string; name: string },
  apiKey: string,
  supabase: any
): Promise<Response> {
  const { relationship, beneficiaries, upcoming_events } = body;
  let { topic_coverage_summary } = body;

  // If topic coverage not provided, calculate from existing breadcrumbs
  if (!topic_coverage_summary) {
    const { data: breadcrumbs, error } = await supabase
      .from("breadcrumbs")
      .select(`
        id,
        topic:topics(name, category:categories(name))
      `)
      .eq("creator_id", profile.id);

    if (!error && breadcrumbs) {
      topic_coverage_summary = {};
      for (const topic of VALID_TOPICS) {
        topic_coverage_summary[topic] = 0;
      }
      for (const bc of breadcrumbs) {
        const topicName = bc.topic?.name;
        const categoryName = bc.topic?.category?.name;
        if (topicName && topic_coverage_summary[topicName] !== undefined) {
          topic_coverage_summary[topicName]++;
        } else if (categoryName && topic_coverage_summary[categoryName] !== undefined) {
          topic_coverage_summary[categoryName]++;
        }
      }
    } else {
      // Default to zeros
      topic_coverage_summary = {};
      for (const topic of VALID_TOPICS) {
        topic_coverage_summary[topic] = 0;
      }
    }
  }

  // Find gaps (topics with low coverage)
  const topicGaps = Object.entries(topic_coverage_summary)
    .filter(([_, count]) => count < 3)
    .sort((a, b) => a[1] - b[1])
    .map(([topic]) => topic);

  const systemPrompt = `You are Breadcrumbs Prompt Generator with a deep library of 100+ question themes.

Goal:
Generate 5 unique, highly varied prompts (60–120 seconds each) for ${profile.name || "the creator"} to record.

IMPORTANT: You must draw from a WIDE variety of question styles. Here are example THEMES to inspire you (pick different ones each time, never repeat the same angle twice):

STORY prompts — pick from angles like:
- A childhood memory that shaped who you are
- The hardest decision you ever made and what you learned
- A time you failed and how you recovered
- Your first job and what it taught you
- A moment you were truly proud of someone
- The funniest thing that ever happened in your family
- A trip or adventure that changed your perspective
- How you met your spouse/partner
- A teacher or mentor who changed your life
- Your most embarrassing moment and what you learned
- A tradition you grew up with and why it mattered
- The day you became a parent
- A time you stood up for something you believed in
- Your favorite holiday memory
- A friendship that shaped who you are
- Something you witnessed that you'll never forget
- A time you had to start over
- The best advice someone ever gave you
- A moment of unexpected kindness
- Your first big purchase and what it meant
- A skill you learned the hard way
- A time you surprised yourself
- A family recipe and the story behind it
- Your favorite place in the world and why
- A letter you wish you'd written

ADVICE prompts — pick from angles like:
- How to handle conflict with grace
- What to do when you feel lost in life
- How to manage money wisely in your 20s
- The most important quality in a friend
- How to recover from heartbreak
- What to look for in a life partner
- How to stay motivated when things are hard
- The importance of saying "I'm sorry"
- How to make a tough decision
- What you wish you knew about raising kids
- How to build a career you're proud of
- The value of patience and how to practice it
- How to deal with difficult people
- What to prioritize when life gets overwhelming
- How to be a good listener
- The importance of taking care of your health early
- How to set boundaries without guilt
- What success really means
- How to handle peer pressure
- How to find your passion
- When to hold on and when to let go
- How to build trust with others
- The power of showing up consistently
- How to handle disappointment
- What courage really looks like in everyday life

VALUES & FAITH prompts — pick from angles like:
- What does integrity mean to you in practice?
- A Bible verse or spiritual text that guides your daily life
- How has your faith been tested and strengthened?
- What does forgiveness look like in your family?
- How do you define love beyond romantic love?
- What spiritual practice has brought you the most peace?
- How do you handle doubt or uncertainty in faith?
- What does gratitude mean to you day-to-day?
- A prayer or hope you have for your children's future
- What does it mean to live with purpose?
- How has suffering shaped your understanding of God/life?
- What moral lesson do you most want to pass down?
- How do you define right and wrong for your family?
- What role does community play in your spiritual life?
- How do you find peace in difficult seasons?
- What does humility look like in leadership?
- A moment when your faith surprised you
- What does it mean to leave a legacy?
- How do you teach empathy to the next generation?
- What does sacrifice mean in your family?
- How do you stay grounded in your values under pressure?
- What tradition connects you to something bigger than yourself?
- How do you find meaning in ordinary moments?
- What does it mean to be a person of character?
- A belief you hold that has been shaped by experience

Inputs:
- relationship: ${relationship || "Parent to children"}
- beneficiaries: ${beneficiaries.join(", ") || "Family"}
- topic_coverage_summary: ${JSON.stringify(topic_coverage_summary)}
- topics with gaps (low coverage): ${topicGaps.slice(0, 5).join(", ") || "None identified"}
${upcoming_events?.length ? `- upcoming_events: ${upcoming_events.join(", ")}` : ""}

Rules:
- ALWAYS choose different angles from the examples above — never repeat similar questions across calls.
- Fill gaps in topic coverage.
- Include at least 1 story, 1 advice, and 1 values/faith prompt. The other 2 can be any type.
- Make each prompt specific, warm, and conversational — not generic.
- Avoid requiring sensitive third-party details.
- Prompts should be easy to answer in 60-120 seconds.
- Suggest 3-5 tags for each prompt.
- Add variety in phrasing: sometimes start with "Tell me about...", "What's a time when...", "If you could...", "Describe the moment...", "Share your thoughts on...", etc.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate 5 varied and unique recording prompts for ${profile.name || "the creator"} to share wisdom with ${beneficiaries.join(", ") || "their family"}. Pick completely different angles and themes from your library.` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "provide_prompts",
            description: "Provide 3 recording prompts with suggested tags",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      prompt_type: {
                        type: "string",
                        enum: ["story", "advice", "values"],
                        description: "Type of prompt",
                      },
                      prompt: {
                        type: "string",
                        description: "The recording prompt question/invitation",
                      },
                      suggested_tags: {
                        type: "array",
                        items: { type: "string" },
                        description: "3-5 suggested tags for this prompt",
                      },
                      estimated_duration: {
                        type: "string",
                        description: "Estimated recording time, e.g., '60-90 seconds'",
                      },
                      related_topics: {
                        type: "array",
                        items: {
                          type: "string",
                          enum: VALID_TOPICS,
                        },
                        description: "Topics this prompt would cover",
                      },
                    },
                    required: ["prompt_type", "prompt", "suggested_tags", "related_topics"],
                  },
                  minItems: 5,
                  maxItems: 5,
                },
              },
              required: ["prompts"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "provide_prompts" } },
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
  console.log("Prompts AI Response:", JSON.stringify(aiResponse, null, 2));

  const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({
      prompts: result.prompts,
      topic_coverage: topic_coverage_summary,
      topic_gaps: topicGaps.slice(0, 5),
      creator_name: profile.name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Failed to generate prompts" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
