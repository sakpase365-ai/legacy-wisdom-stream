import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCreatorProgress } from "@/hooks/useCreatorProgress";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { StreakCard } from "@/components/gamification/StreakCard";
import { TopicCoverageGrid } from "@/components/gamification/TopicCoverageGrid";
import { AchievementBadges } from "@/components/gamification/AchievementBadges";
import { RecipientProgressCard } from "@/components/gamification/RecipientProgressCard";
import { TrendingUp, MessageSquare } from "lucide-react";

export default function CreatorProgress() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const {
    totalBreadcrumbs,
    streak,
    achievements,
    topicCoverage,
    recipientProgress,
    isLoading,
  } = useCreatorProgress(profile?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && profile?.role !== "creator") {
      navigate("/recipient");
    }
  }, [user, profile, authLoading, navigate]);

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  const coveredTopics = topicCoverage.filter((t) => t.count > 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Your Legacy Progress
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your journey of leaving wisdom for your loved ones
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalBreadcrumbs}</p>
                  <p className="text-sm text-muted-foreground">Breadcrumbs Left</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{coveredTopics}</p>
                  <p className="text-sm text-muted-foreground">Topics Covered</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <span className="text-lg">🏆</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{achievements.length}</p>
                  <p className="text-sm text-muted-foreground">Achievements</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Streak */}
        <StreakCard streak={streak} weeklyCount={streak?.week_start_count || 0} />

        {/* Achievements */}
        <AchievementBadges achievements={achievements} totalBreadcrumbs={totalBreadcrumbs} />

        {/* Topic Coverage */}
        <TopicCoverageGrid coverage={topicCoverage} />

        {/* Recipient Progress */}
        <RecipientProgressCard recipients={recipientProgress} />
      </div>
    </DashboardLayout>
  );
}
