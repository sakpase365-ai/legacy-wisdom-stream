import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock } from "lucide-react";
import type { Achievement } from "@/hooks/useCreatorProgress";
import { ACHIEVEMENT_DEFINITIONS } from "@/hooks/useCreatorProgress";

interface AchievementBadgesProps {
  achievements: Achievement[];
  totalBreadcrumbs: number;
}

export function AchievementBadges({ achievements, totalBreadcrumbs }: AchievementBadgesProps) {
  const earnedTypes = new Set(achievements.map((a) => a.achievement_type));
  
  // Get all achievement definitions with earned status
  const allAchievements = Object.entries(ACHIEVEMENT_DEFINITIONS).map(([type, def]) => ({
    type,
    ...def,
    earned: earnedTypes.has(type),
    earnedAt: achievements.find((a) => a.achievement_type === type)?.earned_at,
  }));

  // Sort: earned first, then by type
  const sortedAchievements = allAchievements.sort((a, b) => {
    if (a.earned && !b.earned) return -1;
    if (!a.earned && b.earned) return 1;
    return 0;
  });

  const earnedCount = allAchievements.filter((a) => a.earned).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Achievements</CardTitle>
          </div>
          <Badge variant="secondary">
            {earnedCount}/{allAchievements.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sortedAchievements.map((achievement) => (
            <div
              key={achievement.type}
              className={`relative p-3 rounded-xl border text-center transition-all ${
                achievement.earned
                  ? "bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30"
                  : "bg-muted/30 border-border/50 opacity-60"
              }`}
            >
              <div className="text-2xl mb-1">
                {achievement.earned ? achievement.icon : "🔒"}
              </div>
              <p className={`text-xs font-medium ${achievement.earned ? "text-foreground" : "text-muted-foreground"}`}>
                {achievement.name}
              </p>
              {achievement.earned && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(achievement.earnedAt!).toLocaleDateString()}
                </p>
              )}
              {!achievement.earned && (
                <Lock className="absolute top-2 right-2 h-3 w-3 text-muted-foreground/50" />
              )}
            </div>
          ))}
        </div>

        {/* Progress hint */}
        {totalBreadcrumbs < 10 && (
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm text-muted-foreground">
              <span className="text-primary font-medium">{10 - totalBreadcrumbs} more</span> breadcrumbs to unlock "Getting Started" 🌿
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
