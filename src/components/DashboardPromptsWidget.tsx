import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Mic, BookOpen, Heart, MessageCircle, Clock, ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { QuickCaptureModal } from "@/components/QuickCaptureModal";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import TypewriterText from "@/components/TypewriterText";

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
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [promptKey, setPromptKey] = useState(0);

  useEffect(() => {
    if (profileId && !hasLoaded) {
      generatePrompts();
    }
  }, [profileId]);

  const generatePrompts = async () => {
    setIsRefreshing(true);
    setShowPrompt(false);
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
      
      // Delay before showing new prompt with typing animation
      setTimeout(() => {
        setPromptKey((prev) => prev + 1);
        setShowPrompt(true);
      }, 2000);
    } catch (error) {
      console.error("Error generating prompts:", error);
      setShowPrompt(true);
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
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/30 text-white hover:bg-white/10"
          onClick={generatePrompts}
          disabled={isRefreshing}
        >
          <Sparkles className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          AI Breadcrumbs
        </Button>
        <div className="flex items-center gap-2">
          <Link to="/creator/create">
            <Button variant="ghost" size="sm" className="gap-1.5 text-white/60 hover:text-white hover:bg-white/10">
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manual</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Prompt Card */}
      {prompt && showPrompt ? (
        <>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${promptKey}-${currentPromptIndex}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card
              className="group bg-white/5 border-white/10 hover:border-white/30 transition-all"
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
                    className="gap-2 bg-white text-black hover:bg-white/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRecording(prompt);
                    }}
                  >
                    Leave
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TypewriterText
                  text={prompt.prompt}
                  className="text-foreground leading-relaxed mb-3"
                  speed={0.02}
                  delay={0.1}
                  showCursor={false}
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {prompt.suggested_tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
        </>
      ) : prompt && !showPrompt ? (
        <Card className="bg-white/5 border-white/10 py-8">
          <CardContent className="flex items-center justify-center gap-2">
            <span className="text-white/60 text-sm">Generating new prompt</span>
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </CardContent>
        </Card>
      ) : isRefreshing ? (
        <Card className="bg-white/5 border-white/10 py-8">
          <CardContent className="flex items-center justify-center gap-2">
            <span className="text-white/60 text-sm">Generating new prompt</span>
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
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
