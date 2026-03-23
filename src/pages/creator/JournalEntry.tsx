import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Trash2, Lock, Users, X, Sparkles, Tag, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AISuggestion {
  topics: { id: string; name: string; category: string; relevance_note: string }[];
  reflection_prompts: string[];
  insight: string;
}

const MOODS = [
  { key: "grateful", label: "Grateful" },
  { key: "joyful", label: "Joyful" },
  { key: "reflective", label: "Reflective" },
  { key: "hopeful", label: "Hopeful" },
  { key: "peaceful", label: "Peaceful" },
  { key: "proud", label: "Proud" },
  { key: "sad", label: "Sad" },
  { key: "anxious", label: "Anxious" },
];

interface Recipient {
  id: string;
  display_name: string;
}

export default function JournalEntry() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const { profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isShared, setIsShared] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }
    if (profile && profile.role !== "creator") {
      navigate("/recipient");
      return;
    }
    if (profile) {
      loadRecipients();
      if (!isNew) loadEntry();
    }
  }, [profile, authLoading, navigate]);

  const loadRecipients = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("recipients")
      .select("id, display_name")
      .eq("creator_id", profile.id);
    setAllRecipients(data || []);
  };

  const loadEntry = async () => {
    if (!id || !profile) return;
    try {
      const { data: entry, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("id", id)
        .eq("creator_id", profile.id)
        .single();

      if (error || !entry) {
        toast.error("Entry not found");
        navigate("/creator/journal");
        return;
      }

      setTitle(entry.title);
      setContent(entry.content);
      setMood(entry.mood);
      setTags(entry.tags || []);
      setEntryDate(entry.entry_date);
      setIsShared(entry.is_shared);

      const { data: recipientLinks } = await supabase
        .from("journal_entry_recipients")
        .select("recipient_id")
        .eq("journal_entry_id", id);

      setSelectedRecipients((recipientLinks || []).map((r) => r.recipient_id));
    } catch (error) {
      console.error("Error loading entry:", error);
      toast.error("Failed to load entry");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,$/, "");
      if (newTag && !tags.includes(newTag)) {
        setTags((prev) => [...prev, newTag]);
      }
      setTagInput("");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please add a title");
      return;
    }
    if (!content.trim()) {
      toast.error("Please write something in your entry");
      return;
    }
    if (!profile) return;

    setIsSaving(true);
    try {
      let entryId = id;

      if (isNew) {
        const { data, error } = await supabase
          .from("journal_entries")
          .insert({
            creator_id: profile.id,
            title: title.trim(),
            content: content.trim(),
            mood,
            tags,
            entry_date: entryDate,
            is_shared: isShared,
          })
          .select("id")
          .single();

        if (error) throw error;
        entryId = data.id;
      } else {
        const { error } = await supabase
          .from("journal_entries")
          .update({
            title: title.trim(),
            content: content.trim(),
            mood,
            tags,
            entry_date: entryDate,
            is_shared: isShared,
          })
          .eq("id", id);

        if (error) throw error;

        // Remove old recipient links
        await supabase
          .from("journal_entry_recipients")
          .delete()
          .eq("journal_entry_id", id);
      }

      // Insert recipient links if shared
      if (isShared && selectedRecipients.length > 0 && entryId) {
        await supabase.from("journal_entry_recipients").insert(
          selectedRecipients.map((rid) => ({
            journal_entry_id: entryId,
            recipient_id: rid,
          }))
        );
      }

      toast.success(isNew ? "Journal entry saved" : "Entry updated");

      // Run AI analysis in background — don't block navigation
      if (entryId) {
        analyzeEntry(entryId, title.trim(), content.trim());
      }

      navigate("/creator/journal");
    } catch (error) {
      console.error("Error saving entry:", error);
      toast.error("Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const analyzeEntry = async (entryId: string, entryTitle: string, entryContent: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-journal", {
        body: { title: entryTitle, content: entryContent, journalEntryId: entryId },
      });
      if (error) throw error;
      setAiSuggestion(data as AISuggestion);
    } catch (error) {
      console.error("AI analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Entry deleted");
      navigate("/creator/journal");
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(recipientId)
        ? prev.filter((r) => r !== recipientId)
        : [...prev, recipientId]
    );
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/creator/journal")}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Journal
        </button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-white text-black hover:bg-white/90"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Date */}
        <div>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="bg-transparent text-white/50 text-sm border-none outline-none cursor-pointer hover:text-white/80 transition-colors"
          />
        </div>

        {/* Title */}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind today?"
          className="bg-transparent border-none border-b border-white/10 rounded-none px-0 text-xl font-serif font-medium text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:border-white/30"
        />

        {/* Mood */}
        <div>
          <p className="text-xs text-white/40 mb-2 uppercase tracking-widest">How are you feeling?</p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMood(mood === m.key ? null : m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border ${
                  mood === m.key
                    ? "bg-white/20 border-white/40 text-white"
                    : "bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
                }`}
              >
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write about what you're experiencing, feeling, or going through. Your words will one day mean the world to the people you love..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 min-h-[280px] text-sm leading-relaxed resize-none focus-visible:border-white/25"
        />

        {/* Tags */}
        <div>
          <p className="text-xs text-white/40 mb-2 uppercase tracking-widest">Tags</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white/70 text-xs"
              >
                {tag}
                <button
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Add a tag and press Enter..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm"
          />
        </div>

        {/* AI Analysis */}
        {!isNew && (
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white/60" />
                <p className="text-sm font-medium text-white">AI Insights</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => analyzeEntry(id!, title, content)}
                disabled={isAnalyzing || !title || !content}
                className="text-white/60 hover:text-white text-xs gap-1.5"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Analyze</>
                )}
              </Button>
            </div>

            {aiSuggestion && (
              <div className="space-y-4">
                {/* Insight */}
                {aiSuggestion.insight && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-sm text-white/70 italic">"{aiSuggestion.insight}"</p>
                  </div>
                )}

                {/* Suggested Topics */}
                {aiSuggestion.topics.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                      <Tag className="w-3 h-3" /> Related Topics
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestion.topics.map((t) => (
                        <div
                          key={t.id}
                          title={t.relevance_note}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white/70"
                        >
                          <span className="text-white/40 text-xs">{t.category}</span>
                          <span className="w-px h-3 bg-white/20" />
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reflection Prompts */}
                {aiSuggestion.reflection_prompts.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 mb-2 uppercase tracking-widest">Go Deeper</p>
                    <div className="space-y-2">
                      {aiSuggestion.reflection_prompts.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => setContent((prev) => prev + `\n\n${prompt}\n`)}
                          className="w-full text-left p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/25 transition-colors text-sm text-white/60 hover:text-white/80"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/30 mt-2">Tap a prompt to add it to your entry</p>
                  </div>
                )}
              </div>
            )}

            {!aiSuggestion && !isAnalyzing && (
              <p className="text-xs text-white/30">
                Tap Analyze to get AI-suggested topics and reflection prompts based on your entry.
              </p>
            )}

            {aiSuggestion && (
              <div className="pt-2 border-t border-white/10">
                <Button
                  className="w-full gap-2 bg-white text-black hover:bg-white/90"
                  onClick={() => {
                    const params = new URLSearchParams({
                      from_journal: id!,
                      title: title,
                      content: content,
                      topic_id: aiSuggestion.topics[0]?.id || "",
                    });
                    navigate(`/creator/create?${params.toString()}`);
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                  Convert to Breadcrumb
                </Button>
                <p className="text-xs text-white/30 text-center mt-2">
                  Share this story with your recipients as a breadcrumb
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sharing */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Share with recipients</p>
              <p className="text-xs text-white/40 mt-0.5">
                Let your loved ones read this entry
              </p>
            </div>
            <button
              onClick={() => setIsShared((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isShared ? "bg-white/80" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                  isShared ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {isShared && allRecipients.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 uppercase tracking-widest">Share with</p>
              <div className="flex flex-wrap gap-2">
                {allRecipients.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => toggleRecipient(r.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border ${
                      selectedRecipients.includes(r.id)
                        ? "bg-white/20 border-white/40 text-white"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    {selectedRecipients.includes(r.id) ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    {r.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isShared && allRecipients.length === 0 && (
            <p className="text-xs text-white/40">
              Add recipients first to share this entry with them.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
