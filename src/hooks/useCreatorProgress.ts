import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Achievement {
  id: string;
  achievement_type: string;
  achievement_name: string;
  description: string | null;
  earned_at: string;
  metadata: Record<string, unknown>;
}

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  week_start_count: number;
}

export interface TopicCoverage {
  topic_id: string;
  topic_name: string;
  count: number;
  category_name: string;
}

export interface RecipientProgress {
  recipient_id: string;
  recipient_name: string;
  breadcrumb_count: number;
  topics_covered: number;
  total_topics: number;
}

export interface WeeklyChallenge {
  id: string;
  challenge_type: string;
  challenge_description: string;
  target_recipient_id: string | null;
  target_topic_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

interface CreatorProgress {
  totalBreadcrumbs: number;
  streak: Streak | null;
  achievements: Achievement[];
  topicCoverage: TopicCoverage[];
  recipientProgress: RecipientProgress[];
  weeklyChallenge: WeeklyChallenge | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// Achievement definitions
export const ACHIEVEMENT_DEFINITIONS = {
  first_breadcrumb: {
    name: "First Step",
    description: "Left your first breadcrumb",
    icon: "🌱",
    check: (stats: { total: number }) => stats.total >= 1,
  },
  ten_breadcrumbs: {
    name: "Getting Started",
    description: "Left 10 breadcrumbs",
    icon: "🌿",
    check: (stats: { total: number }) => stats.total >= 10,
  },
  twenty_five_breadcrumbs: {
    name: "Building Legacy",
    description: "Left 25 breadcrumbs",
    icon: "🌳",
    check: (stats: { total: number }) => stats.total >= 25,
  },
  fifty_breadcrumbs: {
    name: "Wisdom Keeper",
    description: "Left 50 breadcrumbs",
    icon: "🏆",
    check: (stats: { total: number }) => stats.total >= 50,
  },
  hundred_breadcrumbs: {
    name: "Legacy Builder",
    description: "Left 100 breadcrumbs",
    icon: "👑",
    check: (stats: { total: number }) => stats.total >= 100,
  },
  first_scripture: {
    name: "Faith Shared",
    description: "Shared your first scripture",
    icon: "📖",
    check: (stats: { scriptures: number }) => stats.scriptures >= 1,
  },
  week_streak: {
    name: "Consistent Creator",
    description: "7-day recording streak",
    icon: "🔥",
    check: (stats: { streak: number }) => stats.streak >= 7,
  },
  month_streak: {
    name: "Dedicated",
    description: "30-day recording streak",
    icon: "💪",
    check: (stats: { streak: number }) => stats.streak >= 30,
  },
  all_topics: {
    name: "Well Rounded",
    description: "Covered all major life topics",
    icon: "🎯",
    check: (stats: { topicsCovered: number; totalTopics: number }) => 
      stats.topicsCovered >= Math.min(stats.totalTopics, 10),
  },
  multi_recipient: {
    name: "Family First",
    description: "Left breadcrumbs for 3+ recipients",
    icon: "👨‍👩‍👧‍👦",
    check: (stats: { recipientsWithBreadcrumbs: number }) => 
      stats.recipientsWithBreadcrumbs >= 3,
  },
};

export function useCreatorProgress(profileId: string | undefined): CreatorProgress {
  const [totalBreadcrumbs, setTotalBreadcrumbs] = useState(0);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [topicCoverage, setTopicCoverage] = useState<TopicCoverage[]>([]);
  const [recipientProgress, setRecipientProgress] = useState<RecipientProgress[]>([]);
  const [weeklyChallenge, setWeeklyChallenge] = useState<WeeklyChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);

    try {
      // Fetch total breadcrumbs count
      const { count: breadcrumbCount } = await supabase
        .from("breadcrumbs")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", profileId);

      setTotalBreadcrumbs(breadcrumbCount || 0);

      // Fetch streak data
      const { data: streakData } = await supabase
        .from("creator_streaks")
        .select("*")
        .eq("profile_id", profileId)
        .single();

      setStreak(streakData || {
        current_streak: 0,
        longest_streak: 0,
        last_activity_date: null,
        week_start_count: 0,
      });

      // Fetch achievements
      const { data: achievementsData } = await supabase
        .from("creator_achievements")
        .select("*")
        .eq("profile_id", profileId)
        .order("earned_at", { ascending: false });

      setAchievements((achievementsData || []) as Achievement[]);

      // Fetch topic coverage with categories
      const { data: topicsData } = await supabase
        .from("topics")
        .select(`
          id,
          name,
          category:categories(name)
        `)
        .eq("is_active", true);

      const { data: breadcrumbTopics } = await supabase
        .from("breadcrumbs")
        .select("topic_id")
        .eq("creator_id", profileId)
        .not("topic_id", "is", null);

      const topicCounts: Record<string, number> = {};
      (breadcrumbTopics || []).forEach((b: { topic_id: string | null }) => {
        if (b.topic_id) {
          topicCounts[b.topic_id] = (topicCounts[b.topic_id] || 0) + 1;
        }
      });

      const coverage = (topicsData || []).map((t: any) => ({
        topic_id: t.id,
        topic_name: t.name,
        category_name: t.category?.name || "Other",
        count: topicCounts[t.id] || 0,
      }));

      setTopicCoverage(coverage);

      // Fetch recipient progress
      const { data: recipientsData } = await supabase
        .from("recipients")
        .select("id, display_name")
        .eq("creator_id", profileId);

      const { data: breadcrumbRecipients } = await supabase
        .from("breadcrumb_recipients")
        .select(`
          recipient_id,
          breadcrumb:breadcrumbs(id, topic_id, creator_id)
        `)
        .eq("breadcrumb.creator_id", profileId);

      const recipientStats: Record<string, { count: number; topics: Set<string> }> = {};
      (breadcrumbRecipients || []).forEach((br: any) => {
        if (br.breadcrumb && br.recipient_id) {
          if (!recipientStats[br.recipient_id]) {
            recipientStats[br.recipient_id] = { count: 0, topics: new Set() };
          }
          recipientStats[br.recipient_id].count++;
          if (br.breadcrumb.topic_id) {
            recipientStats[br.recipient_id].topics.add(br.breadcrumb.topic_id);
          }
        }
      });

      const totalTopics = (topicsData || []).length;
      const progress = (recipientsData || []).map((r: any) => ({
        recipient_id: r.id,
        recipient_name: r.display_name,
        breadcrumb_count: recipientStats[r.id]?.count || 0,
        topics_covered: recipientStats[r.id]?.topics.size || 0,
        total_topics: totalTopics,
      }));

      setRecipientProgress(progress);

      // Fetch current weekly challenge
      const weekStart = getWeekStart();
      const { data: challengeData } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("profile_id", profileId)
        .eq("week_start", weekStart)
        .limit(1)
        .single();

      setWeeklyChallenge(challengeData as WeeklyChallenge | null);

    } catch (error) {
      console.error("Error fetching creator progress:", error);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    totalBreadcrumbs,
    streak,
    achievements,
    topicCoverage,
    recipientProgress,
    weeklyChallenge,
    isLoading,
    refetch: fetchProgress,
  };
}

// Helper to get the start of the current week (Monday)
function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// Function to update streak after creating a breadcrumb
export async function updateStreak(profileId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  try {
    // Get current streak
    const { data: existing } = await supabase
      .from("creator_streaks")
      .select("*")
      .eq("profile_id", profileId)
      .single();

    if (existing) {
      let newStreak = existing.current_streak;
      
      if (existing.last_activity_date === today) {
        // Already recorded today, just update week count
        await supabase
          .from("creator_streaks")
          .update({ 
            week_start_count: existing.week_start_count + 1,
            updated_at: new Date().toISOString() 
          })
          .eq("profile_id", profileId);
      } else if (existing.last_activity_date === yesterday) {
        // Continue streak
        newStreak = existing.current_streak + 1;
        await supabase
          .from("creator_streaks")
          .update({
            current_streak: newStreak,
            longest_streak: Math.max(existing.longest_streak, newStreak),
            last_activity_date: today,
            week_start_count: existing.week_start_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("profile_id", profileId);
      } else {
        // Streak broken, start new
        await supabase
          .from("creator_streaks")
          .update({
            current_streak: 1,
            last_activity_date: today,
            week_start_count: 1,
            updated_at: new Date().toISOString(),
          })
          .eq("profile_id", profileId);
      }
    } else {
      // First time, create streak record
      await supabase
        .from("creator_streaks")
        .insert({
          profile_id: profileId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: today,
          week_start_count: 1,
        });
    }
  } catch (error) {
    console.error("Error updating streak:", error);
  }
}

// Function to check and award achievements
export async function checkAchievements(
  profileId: string,
  stats: {
    total: number;
    scriptures: number;
    streak: number;
    topicsCovered: number;
    totalTopics: number;
    recipientsWithBreadcrumbs: number;
  }
): Promise<string[]> {
  const newAchievements: string[] = [];

  try {
    // Get existing achievements
    const { data: existing } = await supabase
      .from("creator_achievements")
      .select("achievement_type")
      .eq("profile_id", profileId);

    const earnedTypes = new Set((existing || []).map((a: { achievement_type: string }) => a.achievement_type));

    // Check each achievement
    for (const [type, def] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
      if (!earnedTypes.has(type) && def.check(stats)) {
        // Award new achievement
        await supabase.from("creator_achievements").insert({
          profile_id: profileId,
          achievement_type: type,
          achievement_name: def.name,
          description: def.description,
          metadata: { icon: def.icon },
        });
        newAchievements.push(def.name);
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }

  return newAchievements;
}
