import { Flame, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Streak } from "@/hooks/useCreatorProgress";

interface StreakCardProps {
  streak: Streak | null;
  weeklyCount: number;
}

export function StreakCard({ streak, weeklyCount }: StreakCardProps) {
  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;

  return (
    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Flame className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className="text-2xl font-bold text-foreground">
                {currentStreak} <span className="text-sm font-normal text-muted-foreground">days</span>
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-right">
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs">Best</span>
              </div>
              <p className="text-lg font-semibold text-foreground">{longestStreak}d</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">This Week</span>
              </div>
              <p className="text-lg font-semibold text-foreground">{weeklyCount}</p>
            </div>
          </div>
        </div>

        {/* Streak flame visualization */}
        {currentStreak > 0 && (
          <div className="mt-3 flex gap-1">
            {Array.from({ length: Math.min(currentStreak, 7) }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                style={{ opacity: 0.5 + (i / 7) * 0.5 }}
              />
            ))}
            {currentStreak < 7 && Array.from({ length: 7 - currentStreak }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-1.5 flex-1 rounded-full bg-muted"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
