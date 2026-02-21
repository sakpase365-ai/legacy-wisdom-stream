import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Trophy, TrendingUp, ChevronRight } from "lucide-react";
import { useCreatorProgress, ACHIEVEMENT_DEFINITIONS } from "@/hooks/useCreatorProgress";

interface ProgressSummaryWidgetProps {
  profileId: string | undefined;
}

export function ProgressSummaryWidget({ profileId }: ProgressSummaryWidgetProps) {
  const { totalBreadcrumbs, streak, achievements, isLoading } = useCreatorProgress(profileId);

  if (isLoading || !profileId) {
    return null;
  }

  const currentStreak = streak?.current_streak || 0;
  const recentAchievements = achievements.slice(0, 3);
  const totalAchievements = Object.keys(ACHIEVEMENT_DEFINITIONS).length;

  // Don't show if no activity yet
  if (totalBreadcrumbs === 0 && currentStreak === 0 && achievements.length === 0) {
    return null;
  }

  return (
    <Link to="/creator/progress">
      <Card className="group bg-white/5 border-white/20 hover:border-white/40 transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Streak */}
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${currentStreak > 0 ? "bg-white/20" : "bg-muted"}`}>
                  <Flame className={`h-4 w-4 ${currentStreak > 0 ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">{currentStreak}</p>
                  <p className="text-xs text-muted-foreground">day streak</p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-8 w-px bg-border" />

              {/* Total Breadcrumbs */}
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/10">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">{totalBreadcrumbs}</p>
                  <p className="text-xs text-muted-foreground">breadcrumbs</p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-8 w-px bg-border" />

              {/* Achievements */}
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/10">
                  <Trophy className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">
                    {achievements.length}/{totalAchievements}
                  </p>
                  <p className="text-xs text-muted-foreground">achievements</p>
                </div>

                {/* Recent achievement badges */}
                {recentAchievements.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1 ml-2">
                    {recentAchievements.map((a) => {
                      const def = ACHIEVEMENT_DEFINITIONS[a.achievement_type as keyof typeof ACHIEVEMENT_DEFINITIONS];
                      return (
                        <span 
                          key={a.id} 
                          className="text-lg" 
                          title={a.achievement_name}
                        >
                          {def?.icon || "🏆"}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
