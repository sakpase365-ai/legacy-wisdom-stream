import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Sparkles, RefreshCw, Mic, BookOpen, Heart, MessageCircle, Clock } from "lucide-react";
import { QuickCaptureModal } from "@/components/QuickCaptureModal";

interface Prompt {
  prompt_type: "story" | "advice" | "values";
  prompt: string;
  suggested_tags: string[];
  estimated_duration?: string;
  related_topics: string[];
}

interface Recipient {
  id: string;
  display_name: string;
}

const promptTypeIcons = {
  story: BookOpen,
  advice: MessageCircle,
  values: Heart,
};

const promptTypeLabels = {
  story: "Story",
  advice: "Advice",
  values: "Values & Faith",
};

const promptTypeColors = {
  story: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  advice: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  values: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

export default function CreatorPrompts() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [topicGaps, setTopicGaps] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && profile?.role !== "creator") {
      navigate("/recipient");
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;

    try {
      // Fetch recipients
      const { data: recipientsData } = await supabase
        .from("recipients")
        .select("id, display_name")
        .eq("creator_id", profile.id);

      if (recipientsData) {
        setRecipients(recipientsData);
      }

      // Fetch family ID
      const { data: familyData } = await supabase
        .rpc("get_user_family_id", { _user_id: user?.id });

      if (familyData) {
        setFamilyId(familyData);
      }

      // Generate prompts
      await generatePrompts(recipientsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrompts = async (recipientsList: Recipient[]) => {
    setIsRefreshing(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const beneficiaryNames = recipientsList.map((r) => r.display_name);

      const response = await supabase.functions.invoke("capture-breadcrumb", {
        body: {
          action: "generate_prompts",
          relationship: "Parent to children",
          beneficiaries: beneficiaryNames.length > 0 ? beneficiaryNames : ["Family"],
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to generate prompts");
      }

      const data = response.data;
      setPrompts(data.prompts || []);
      setTopicGaps(data.topic_gaps || []);
    } catch (error) {
      console.error("Error generating prompts:", error);
      toast({
        title: "Error",
        description: "Failed to generate prompts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    generatePrompts(recipients);
  };

  const handleStartRecording = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleBreadcrumbSaved = () => {
    toast({
      title: "Breadcrumb saved!",
      description: "Your wisdom has been recorded for your family.",
    });
    // Refresh prompts after saving
    handleRefresh();
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Recording Prompts
            </h1>
            <p className="text-muted-foreground mt-1">
              Personalized prompts to help you share your wisdom
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            New Prompts
          </Button>
        </div>

        {/* Topic Gaps */}
        {topicGaps.length > 0 && (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground mb-2">
                Topics that could use more of your wisdom:
              </p>
              <div className="flex flex-wrap gap-2">
                {topicGaps.map((topic) => (
                  <Badge key={topic} variant="secondary">
                    {topic}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prompts */}
        <div className="grid gap-4">
          {prompts.map((prompt, index) => {
            const Icon = promptTypeIcons[prompt.prompt_type];
            const label = promptTypeLabels[prompt.prompt_type];
            const colorClass = promptTypeColors[prompt.prompt_type];

            return (
              <Card
                key={index}
                className="group hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => handleStartRecording(prompt)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <Badge variant="outline" className={colorClass}>
                          {label}
                        </Badge>
                        {prompt.estimated_duration && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {prompt.estimated_duration}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRecording(prompt);
                      }}
                    >
                      <Mic className="h-4 w-4" />
                      Record
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed mb-4">
                    {prompt.prompt}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prompt.suggested_tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {prompt.related_topics.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <span>Topics:</span>
                      {prompt.related_topics.map((topic, i) => (
                        <span key={topic}>
                          {topic}
                          {i < prompt.related_topics.length - 1 && ", "}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {prompts.length === 0 && !isRefreshing && (
            <Card className="py-12">
              <CardContent className="text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No prompts yet</h3>
                <p className="text-muted-foreground mb-4">
                  Click the button above to generate personalized recording prompts
                </p>
                <Button onClick={handleRefresh} disabled={isRefreshing}>
                  Generate Prompts
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Capture Modal */}
        {profile?.id && (
          <QuickCaptureModal
            open={isModalOpen}
            onOpenChange={(open) => !open && handleModalClose()}
            recipients={recipients}
            familyId={familyId || undefined}
            creatorId={profile.id}
            onSuccess={handleBreadcrumbSaved}
            initialPrompt={selectedPrompt?.prompt}
            initialTags={selectedPrompt?.suggested_tags}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
