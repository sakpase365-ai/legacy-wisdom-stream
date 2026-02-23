import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Mic, BookOpen, Heart, MessageCircle, Clock, ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { QuickCaptureModal } from "@/components/QuickCaptureModal";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Prompt {
  prompt_type: "story" | "advice" | "values";
  prompt: string;
  suggested_tags: string[];
  estimated_duration?: string;
  related_topics: string[];
}

interface DashboardPromptsWidgetProps {
  profileId: string;
  recipients: { id: string; display_name: string }[];
  familyId?: string;
  onBreadcrumbSaved?: () => void;
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

export function DashboardPromptsWidget({ profileId, recipients, familyId, onBreadcrumbSaved }: DashboardPromptsWidgetProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (profileId && !hasLoaded) {
      generatePrompts();
    }
  }, [profileId]);

  const generatePrompts = async () => {
    setIsRefreshing(true);
    try {
      const beneficiaryNames = recipients.map((r) => r.display_name);
      const response = await supabase.functions.invoke("capture-breadcrumb", {
        body: {
          action: "generate_prompts",
          relationship: "Parent to children",
          beneficiaries: beneficiaryNames.length > 0 ? beneficiaryNames : ["Family"],
        },
      });

      if (response.error) throw new Error(response.error.message);

      setPrompts(response.data.prompts || []);
      setCurrentPromptIndex(0);
      setHasLoaded(true);
    } catch (error) {
      console.error("Error generating prompts:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartRecording = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      setIsModalOpen(true);
    }, 1500);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleSaved = () => {
    toast.success("Breadcrumb saved!");
    onBreadcrumbSaved?.();
    generatePrompts();
  };

  if (!hasLoaded && !isRefreshing) {
    return null;
  }

  const prompt = prompts[currentPromptIndex];

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-lg font-medium text-white">AI Generated Breadcrumb Prompts</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/creator/create">
            <Button variant="ghost" size="sm" className="gap-1.5 text-white/60 hover:text-white hover:bg-white/10">
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manual</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={generatePrompts}
            disabled={isRefreshing}
            className="gap-1.5 text-white/60 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Prompt Card */}
      {prompt ? (
        <>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentPromptIndex}-${prompts[0]?.prompt?.slice(0, 20)}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="cursor-pointer"
            onClick={generatePrompts}
          >
            <Card
              className="group bg-white/5 border-white/10 hover:border-white/30 transition-all pointer-events-none"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${promptTypeColors[prompt.prompt_type]}`}>
                      {(() => { const Icon = promptTypeIcons[prompt.prompt_type]; return <Icon className="h-5 w-5" />; })()}
                    </div>
                    <div>
                      <Badge variant="outline" className={promptTypeColors[prompt.prompt_type]}>
                        {promptTypeLabels[prompt.prompt_type]}
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
                    className="gap-2 bg-white text-black hover:bg-white/90 pointer-events-auto"
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
                <p className="text-foreground leading-relaxed mb-3">{prompt.prompt}</p>
                <div className="flex flex-wrap gap-2">
                  {prompt.suggested_tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

          {/* Thinking Animation */}
          {isThinking && (
            <div className="flex items-center justify-center gap-2 py-3">
              <span className="text-sm text-muted-foreground">Preparing your prompt</span>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Navigation */}
          {prompts.length > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPromptIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPromptIndex === 0}
                className="gap-1 text-white/60 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-white/40">
                {currentPromptIndex + 1} of {prompts.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPromptIndex((prev) => Math.min(prompts.length - 1, prev + 1))}
                disabled={currentPromptIndex === prompts.length - 1}
                className="gap-1 text-white/60 hover:text-white hover:bg-white/10"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : isRefreshing ? (
        <Card className="bg-white/5 border-white/10 py-8">
          <CardContent className="flex items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-white/40" />
            <span className="text-white/60">Generating prompts...</span>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/5 border-white/10 py-8">
          <CardContent className="text-center">
            <p className="text-white/60 mb-3">No prompts available</p>
            <Button onClick={generatePrompts} size="sm" className="bg-white text-black hover:bg-white/90">
              Generate Prompts
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Capture Modal */}
      <QuickCaptureModal
        open={isModalOpen}
        onOpenChange={(open) => !open && handleModalClose()}
        recipients={recipients}
        familyId={familyId}
        creatorId={profileId}
        onSuccess={handleSaved}
        initialPrompt={selectedPrompt?.prompt}
        initialTags={selectedPrompt?.suggested_tags}
      />
    </div>
  );
}
