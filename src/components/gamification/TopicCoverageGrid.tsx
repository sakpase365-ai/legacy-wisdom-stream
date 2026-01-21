import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import type { TopicCoverage } from "@/hooks/useCreatorProgress";

interface TopicCoverageGridProps {
  coverage: TopicCoverage[];
}

export function TopicCoverageGrid({ coverage }: TopicCoverageGridProps) {
  // Group by category
  const byCategory = coverage.reduce((acc, topic) => {
    if (!acc[topic.category_name]) {
      acc[topic.category_name] = [];
    }
    acc[topic.category_name].push(topic);
    return acc;
  }, {} as Record<string, TopicCoverage[]>);

  const totalTopics = coverage.length;
  const coveredTopics = coverage.filter((t) => t.count > 0).length;
  const overallProgress = totalTopics > 0 ? (coveredTopics / totalTopics) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Topic Coverage</CardTitle>
          <span className="text-sm text-muted-foreground">
            {coveredTopics}/{totalTopics} topics
          </span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(byCategory).map(([category, topics]) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{category}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {topics.map((topic) => (
                <div
                  key={topic.topic_id}
                  className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                    topic.count > 0
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {topic.count > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className="truncate">{topic.topic_name}</span>
                  {topic.count > 1 && (
                    <span className="ml-auto text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                      {topic.count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
