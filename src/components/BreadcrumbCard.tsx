import { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FileText, Mic, Link as LinkIcon, Image, Video, Calendar, User, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BreadcrumbCardProps {
  breadcrumb: {
    id: string;
    title: string;
    content_type: string;
    text_body: string | null;
    is_scripture: boolean;
    scripture_reference: string | null;
    created_at: string;
    recipient?: {
      id: string;
      display_name: string;
    };
    topic?: {
      id: string;
      name: string;
    } | null;
    creator?: {
      id: string;
      name: string;
    };
    recipient_count?: number;
  };
  showRecipient?: boolean;
  showCreator?: boolean;
  style?: CSSProperties;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  text: <FileText className="w-4 h-4" />,
  scripture: <BookOpen className="w-4 h-4" />,
  voice_note: <Mic className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  link: <LinkIcon className="w-4 h-4" />,
  photo: <Image className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
};

export function BreadcrumbCard({ breadcrumb, showRecipient, showCreator, style }: BreadcrumbCardProps) {
  const icon = breadcrumb.is_scripture 
    ? contentTypeIcons.scripture 
    : contentTypeIcons[breadcrumb.content_type] || contentTypeIcons.text;

  const preview = breadcrumb.text_body
    ? breadcrumb.text_body.substring(0, 120) + (breadcrumb.text_body.length > 120 ? "..." : "")
    : breadcrumb.scripture_reference || null;

  const isSharedWithMultiple = (breadcrumb.recipient_count ?? 1) > 1;

  return (
    <Link 
      to={`/breadcrumb/${breadcrumb.id}`}
      className="block animate-fade-up"
      style={style}
    >
      <div className="glass-card p-5 hover:border-accent/50 hover:shadow-warm transition-all duration-300 group">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-serif text-lg font-medium text-foreground truncate">
                  {breadcrumb.title}
                </h3>
                {isSharedWithMultiple && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Users className="w-3 h-3" />
                    Family
                  </span>
                )}
              </div>
              {breadcrumb.topic && (
                <span className="flex-shrink-0 text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                  {breadcrumb.topic.name}
                </span>
              )}
            </div>

            {preview && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {breadcrumb.is_scripture && breadcrumb.scripture_reference 
                  ? `📖 ${breadcrumb.scripture_reference}` 
                  : preview
                }
              </p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {showRecipient && breadcrumb.recipient && !isSharedWithMultiple && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  For {breadcrumb.recipient.display_name}
                </span>
              )}
              {showRecipient && isSharedWithMultiple && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Shared with {breadcrumb.recipient_count} members
                </span>
              )}
              {showCreator && breadcrumb.creator && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  From {breadcrumb.creator.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDistanceToNow(new Date(breadcrumb.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}