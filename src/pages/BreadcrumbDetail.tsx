import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, FileText, Calendar, User, Quote, Loader2, Mic } from "lucide-react";
import { format } from "date-fns";

interface BreadcrumbDetail {
  id: string;
  title: string;
  content_type: string;
  text_body: string | null;
  audio_url: string | null;
  is_scripture: boolean;
  scripture_reference: string | null;
  scripture_text: string | null;
  include_commentary: boolean;
  commentary_text: string | null;
  created_at: string;
  updated_at: string;
  recipient: {
    id: string;
    display_name: string;
  };
  topic: {
    id: string;
    name: string;
  } | null;
  creator: {
    id: string;
    name: string;
  };
}

export default function BreadcrumbDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }

    if (profile && id) {
      fetchBreadcrumb();
    }
  }, [profile, id, authLoading, navigate]);

  const fetchBreadcrumb = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          content_type,
          text_body,
          audio_url,
          is_scripture,
          scripture_reference,
          scripture_text,
          include_commentary,
          commentary_text,
          created_at,
          updated_at,
          recipient:recipients(id, display_name),
          topic:topics(id, name),
          creator:profiles!breadcrumbs_creator_id_fkey(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setBreadcrumb(data as any);
    } catch (err: any) {
      console.error("Error fetching breadcrumb:", err);
      setError("This breadcrumb could not be found or you don't have access to it.");
    } finally {
      setIsLoading(false);
    }
  };

  const backPath = profile?.role === "creator" ? "/creator" : "/recipient";

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !breadcrumb) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <h3 className="font-serif text-xl font-medium text-white mb-2">
            {error || "Breadcrumb not found"}
          </h3>
          <Link to={backPath}>
            <Button variant="outline" className="mt-4 border-white/20 text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const getContentIcon = () => {
    if (breadcrumb.is_scripture) return <BookOpen className="w-6 h-6" />;
    if (breadcrumb.content_type === "voice_note") return <Mic className="w-6 h-6" />;
    return <FileText className="w-6 h-6" />;
  };

  return (
    <DashboardLayout>
      {/* Back Link */}
      <Link 
        to={backPath}
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100/20 text-amber-100 flex items-center justify-center">
            {getContentIcon()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-serif font-semibold text-white">
              {breadcrumb.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/60">
              {profile?.role === "creator" && breadcrumb.recipient && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  For {breadcrumb.recipient.display_name}
                </span>
              )}
              {profile?.role === "recipient" && breadcrumb.creator && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  From {breadcrumb.creator.name}
                </span>
              )}
              {breadcrumb.topic && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-xs">
                  {breadcrumb.topic.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(breadcrumb.created_at), "MMMM d, yyyy")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Note Audio */}
      {breadcrumb.audio_url && (
        <div className="p-6 mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
          <h3 className="font-serif text-lg font-medium text-white mb-4">
            Voice Note
          </h3>
          <audio 
            controls 
            src={breadcrumb.audio_url} 
            className="w-full"
          />
        </div>
      )}

      {/* Main Content */}
      {breadcrumb.text_body && (
        <div className="p-6 mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
          <h3 className="font-serif text-lg font-medium text-white mb-4">
            {breadcrumb.is_scripture ? "Reflection" : "Message"}
          </h3>
          <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
            {breadcrumb.text_body}
          </p>
        </div>
      )}

      {/* Commentary */}
      {breadcrumb.include_commentary && breadcrumb.commentary_text && (
        <div className="p-6 mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 border-l-4 border-l-amber-100/50">
          <h3 className="font-serif text-lg font-medium text-white mb-4">
            Personal Commentary
          </h3>
          <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
            {breadcrumb.commentary_text}
          </p>
        </div>
      )}

      {/* Scripture Reference */}
      {breadcrumb.scripture_reference && (
        <div className="p-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
          <div className="flex items-start gap-3">
            <Quote className="w-5 h-5 text-amber-100 flex-shrink-0 mt-1" />
            <div>
              <p className="font-serif text-lg font-medium text-white mb-2">
                {breadcrumb.scripture_reference}
              </p>
              {breadcrumb.scripture_text && (
                <p className="text-white/70 italic leading-relaxed">
                  "{breadcrumb.scripture_text}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
