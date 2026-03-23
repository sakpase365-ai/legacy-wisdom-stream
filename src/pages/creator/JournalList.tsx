import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, Lock, Users, BookOpen } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const MOOD_LABELS: Record<string, string> = {
  grateful: "Grateful",
  joyful: "Joyful",
  reflective: "Reflective",
  hopeful: "Hopeful",
  sad: "Sad",
  anxious: "Anxious",
  peaceful: "Peaceful",
  proud: "Proud",
};

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  mood: string | null;
  tags: string[];
  entry_date: string;
  is_shared: boolean;
  created_at: string;
}

export default function JournalList() {
  const { profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }
    if (profile && profile.role !== "creator") {
      navigate("/recipient");
      return;
    }
    if (profile) fetchEntries();
  }, [profile, authLoading, navigate]);

  const fetchEntries = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("creator_id", profile.id)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      setEntries((data as JournalEntry[]) || []);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      toast.error("Failed to load journal entries");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = entries.filter(
    (e) =>
      !searchQuery ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-medium text-white">Journal</h1>
          <p className="text-sm text-white/50 mt-0.5">Your personal story, preserved for those you love</p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-white text-black hover:bg-white/90"
          onClick={() => navigate("/creator/journal/new")}
        >
          <Plus className="w-3.5 h-3.5" />
          New Entry
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          placeholder="Search journal..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
        />
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 rounded-xl bg-black/40 border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-white/60" />
          </div>
          <h3 className="font-serif text-xl font-medium text-white mb-2">
            {entries.length === 0 ? "No journal entries yet" : "No matching entries"}
          </h3>
          <p className="text-white/50 mb-6 max-w-sm mx-auto text-sm">
            {entries.length === 0
              ? "Start writing your story. Your experiences and feelings will become a precious window into your life for those you love."
              : "Try a different search term."}
          </p>
          {entries.length === 0 && (
            <Button
              className="bg-white text-black hover:bg-white/90"
              onClick={() => navigate("/creator/journal/new")}
            >
              Write Your First Entry
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((entry) => (
            <button
              key={entry.id}
              onClick={() => navigate(`/creator/journal/${entry.id}`)}
              className="w-full text-left p-4 sm:p-5 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 hover:bg-black/60 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {entry.mood && (
                      <span className="text-base">{MOOD_LABELS[entry.mood] || ""}</span>
                    )}
                    <h3 className="font-serif text-base font-medium text-white truncate">
                      {entry.title}
                    </h3>
                  </div>
                  <p className="text-white/50 text-sm line-clamp-2 mb-3">{entry.content}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-white/30">
                      {format(parseISO(entry.entry_date), "MMMM d, yyyy")}
                    </span>
                    {(entry.tags || []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 mt-0.5">
                  {entry.is_shared ? (
                    <div className="flex items-center gap-1 text-xs text-white/40">
                      <Users className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Shared</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-white/25">
                      <Lock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Private</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
