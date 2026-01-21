import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, MessageSquare, Target } from "lucide-react";
import type { RecipientProgress } from "@/hooks/useCreatorProgress";

interface RecipientProgressCardProps {
  recipients: RecipientProgress[];
}

export function RecipientProgressCard({ recipients }: RecipientProgressCardProps) {
  if (recipients.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-6 text-center">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Add recipients to track your progress with each one</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Progress by Recipient</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recipients.map((recipient) => {
          const topicProgress = recipient.total_topics > 0
            ? (recipient.topics_covered / recipient.total_topics) * 100
            : 0;

          return (
            <div key={recipient.recipient_id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {recipient.recipient_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-foreground">{recipient.recipient_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{recipient.breadcrumb_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    <span>{recipient.topics_covered}/{recipient.total_topics}</span>
                  </div>
                </div>
              </div>
              <Progress value={topicProgress} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
