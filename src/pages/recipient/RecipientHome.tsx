import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, BookOpen, Filter, Loader2, MessageCircle, Sparkles, Send, Users } from "lucide-react";
import { BreadcrumbCard } from "@/components/BreadcrumbCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Breadcrumb {
  id: string;
  title: string;
  content_type: string;
  text_body: string | null;
  is_scripture: boolean;
  scripture_reference: string | null;
  created_at: string;
  creator: {
    id: string;
    name: string;
  };
  topic: {
    id: string;
    name: string;
  } | null;
}

interface Topic {
  id: string;
  name: string;
}

interface RecipientRecord {
  id: string;
  display_name: string;
  creator_id: string;
}

interface AISource {
  id: string;
  title: string;
}

interface AIResponse {
  answer: string;
  sources_used: AISource[];
  follow_up_questions: string[];
}

interface FamilyMember {
  family_id: string;
}

export default function RecipientHome() {
  const { profile, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [recipientRecord, setRecipientRecord] = useState<RecipientRecord | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [scripturesOnly, setScripturesOnly] = useState(false);

  const [question, setQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }

    if (profile && profile.role !== "recipient") {
      navigate("/creator");
      return;
    }

    if (user) {
      fetchData();
    }
  }, [profile, user, authLoading, navigate]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch family membership
      const { data: familyMemberData } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (familyMemberData) {
        setFamilyId(familyMemberData.family_id);
      }

      const { data: recipientData, error: recipientError } = await supabase
        .from("recipients")
        .select("id, display_name, creator_id")
        .eq("user_id", user.id)
        .single();

      if (recipientError || !recipientData) {
        setRecipientRecord(null);
        setIsLoading(false);
        return;
      }

      setRecipientRecord(recipientData);

      const { data: breadcrumbsData, error: breadcrumbsError } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          content_type,
          text_body,
          is_scripture,
          scripture_reference,
          created_at,
          topic:topics(id, name),
          creator:profiles!breadcrumbs_creator_id_fkey(id, name)
        `)
        .eq("recipient_id", recipientData.id)
        .order("created_at", { ascending: false });

      if (breadcrumbsError) throw breadcrumbsError;

      const uniqueTopics = new Map<string, Topic>();
      breadcrumbsData?.forEach((b: any) => {
        if (b.topic) {
          uniqueTopics.set(b.topic.id, b.topic);
        }
      });

      setBreadcrumbs(breadcrumbsData as any || []);
      setTopics(Array.from(uniqueTopics.values()));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    setIsAsking(true);
    setAiResponse(null);

    try {
      const response = await supabase.functions.invoke("ask-breadcrumbs", {
        body: {
          question: question.trim(),
          familyId: familyId,
          recipientId: recipientRecord?.id,
          userId: user?.id,
          userRole: "recipient",
        },
      });

      if (response.error) throw response.error;

      const data = response.data as AIResponse;
      setAiResponse({
        answer: data?.answer || "I couldn't find an answer in the breadcrumbs left for you.",
        sources_used: data?.sources_used || [],
        follow_up_questions: data?.follow_up_questions || [],
      });

      if (recipientRecord) {
        await supabase.from("questions").insert({
          recipient_id: recipientRecord.id,
          question_text: question.trim(),
          ai_answer_text: data?.answer || null,
        });
      }
    } catch (error: any) {
      console.error("Error asking question:", error);
      const errorMessage = error?.message || "Failed to get an answer. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAsking(false);
    }
  };

  const handleFollowUpClick = (followUp: string) => {
    setQuestion(followUp);
  };

  const filteredBreadcrumbs = breadcrumbs.filter((b) => {
    const matchesSearch = 
      !searchQuery ||
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.text_body?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTopic = 
      selectedTopic === "all" || 
      b.topic?.id === selectedTopic;
    
    const matchesScripture = 
      !scripturesOnly || 
      b.is_scripture;

    return matchesSearch && matchesTopic && matchesScripture;
  });

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>
    );
  }

  if (!recipientRecord) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-white/60" />
          </div>
          <h3 className="font-serif text-xl font-medium text-white mb-2">
            No breadcrumbs yet
          </h3>
          <p className="text-white/60 max-w-sm mx-auto">
            It looks like no one has added you as a recipient yet. Ask your loved ones to add you using your email: <strong className="text-white">{profile?.email}</strong>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-semibold text-white">
          Hi, {profile?.name?.split(" ")[0]}
        </h1>
        <p className="text-white/60 mt-1">
          Here are breadcrumbs that were left for you.
        </p>
      </div>

      {/* Ask a Question - Family Scoped */}
      <div className="p-6 mb-8 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100/20 text-amber-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-serif text-lg font-medium text-white">
                Ask a Question
              </h3>
              {familyId && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100/10 text-amber-100 border border-amber-100/20">
                  <Users className="w-3 h-3" />
                  Family
                </span>
              )}
            </div>
            <p className="text-sm text-white/60 mb-4">
              {familyId 
                ? "Get answers from all wisdom shared within your family."
                : "Get answers based only on the wisdom that was left for you."
              }
            </p>
            <div className="space-y-4">
              <Textarea
                placeholder="What question do you have? (e.g., What did they say about handling money?)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <div className="flex justify-end">
                <Button 
                  className="bg-amber-100 text-amber-950 hover:bg-amber-200"
                  onClick={handleAskQuestion}
                  disabled={!question.trim() || isAsking}
                >
                  {isAsking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Get Answer
                    </>
                  )}
                </Button>
              </div>

              {aiResponse && (
                <div className="space-y-4">
                  {/* Answer */}
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-sm font-medium text-white mb-2">Answer:</p>
                    <p className="text-sm text-white/80 whitespace-pre-wrap">
                      {aiResponse.answer}
                    </p>
                  </div>

                  {/* Sources */}
                  {aiResponse.sources_used.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-100/10 border border-amber-100/20">
                      <p className="text-xs font-medium text-amber-100 mb-2">Sources used:</p>
                      <div className="flex flex-wrap gap-2">
                        {aiResponse.sources_used.map((source) => (
                          <Link
                            key={source.id}
                            to={`/breadcrumb/${source.id}`}
                            className="text-xs px-2 py-1 rounded bg-amber-100/20 text-amber-100 hover:bg-amber-100/30 transition-colors"
                          >
                            {source.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up Questions */}
                  {aiResponse.follow_up_questions.length > 0 && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs font-medium text-white/60 mb-2">You might also ask:</p>
                      <div className="flex flex-wrap gap-2">
                        {aiResponse.follow_up_questions.map((followUp, index) => (
                          <button
                            key={index}
                            onClick={() => handleFollowUpClick(followUp)}
                            className="text-xs px-2 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 transition-colors text-left"
                          >
                            {followUp}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search breadcrumbs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedTopic} onValueChange={setSelectedTopic}>
              <SelectTrigger className="w-[120px] bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="All Topics" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="all" className="text-white">All Topics</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-white">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 pl-2">
              <Switch
                id="scriptures-only"
                checked={scripturesOnly}
                onCheckedChange={setScripturesOnly}
              />
              <Label htmlFor="scriptures-only" className="text-sm cursor-pointer flex items-center gap-1.5 text-white/80">
                <BookOpen className="w-4 h-4" />
                Scriptures
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumbs List */}
      {filteredBreadcrumbs.length === 0 ? (
        <div className="text-center py-16">
          {breadcrumbs.length === 0 ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-white/60" />
              </div>
              <h3 className="font-serif text-xl font-medium text-white mb-2">
                No breadcrumbs yet
              </h3>
              <p className="text-white/60 max-w-sm mx-auto">
                Your loved ones haven't left any breadcrumbs for you yet. Check back soon!
              </p>
            </>
          ) : (
            <>
              <Filter className="w-12 h-12 mx-auto mb-4 text-white/60" />
              <h3 className="font-serif text-xl font-medium text-white mb-2">
                No matching breadcrumbs
              </h3>
              <p className="text-white/60">
                Try adjusting your filters or search query.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBreadcrumbs.map((breadcrumb) => (
            <BreadcrumbCard
              key={breadcrumb.id}
              breadcrumb={breadcrumb}
              showCreator
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
