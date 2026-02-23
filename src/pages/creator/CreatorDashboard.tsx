import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search, Filter, Loader2, Sparkles, TrendingUp, User, ChevronRight, ChevronDown } from "lucide-react";
import { BreadcrumbCard } from "@/components/BreadcrumbCard";
import { SwipeableCard } from "@/components/SwipeableCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { QuickCaptureButton } from "@/components/QuickCaptureButton";
import { ProgressSummaryWidget } from "@/components/gamification/ProgressSummaryWidget";

interface Breadcrumb {
  id: string;
  title: string;
  content_type: string;
  text_body: string | null;
  is_scripture: boolean;
  scripture_reference: string | null;
  created_at: string;
  recipient: {
    id: string;
    display_name: string;
  };
  topic: {
    id: string;
    name: string;
  } | null;
  recipient_count?: number;
  recipient_names?: string[];
  recipients_info?: { id: string; name: string }[];
}
interface Recipient {
  id: string;
  display_name: string;
}
interface Topic {
  id: string;
  name: string;
}
export default function CreatorDashboard() {
  const {
    profile,
    isLoading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [familyId, setFamilyId] = useState<string | undefined>(undefined);
  const [breadcrumbsOpen, setBreadcrumbsOpen] = useState(false);
  
  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }
    if (profile && profile.role !== "creator") {
      navigate("/recipient");
      return;
    }
    if (profile) {
      fetchData();
    }
  }, [profile, authLoading, navigate]);
  const fetchData = async () => {
    if (!profile) return;
    try {
      const {
        data: breadcrumbsData,
        error: breadcrumbsError
      } = await supabase.from("breadcrumbs").select(`
          id,
          title,
          content_type,
          text_body,
          is_scripture,
          scripture_reference,
          created_at,
          recipient:recipients(id, display_name),
          topic:topics(id, name)
        `).eq("creator_id", profile.id).order("created_at", {
        ascending: false
      });
      if (breadcrumbsError) throw breadcrumbsError;

      // Fetch recipient counts, names, and IDs for each breadcrumb
      const breadcrumbIds = (breadcrumbsData || []).map(b => b.id);
      let recipientData: Record<string, { count: number; names: string[]; info: { id: string; name: string }[] }> = {};
      
      if (breadcrumbIds.length > 0) {
        const { data: recipientLinks } = await supabase
          .from("breadcrumb_recipients")
          .select("breadcrumb_id, recipient:recipients(id, display_name)")
          .in("breadcrumb_id", breadcrumbIds);
        
        if (recipientLinks) {
          recipientLinks.forEach(link => {
            if (!recipientData[link.breadcrumb_id]) {
              recipientData[link.breadcrumb_id] = { count: 0, names: [], info: [] };
            }
            recipientData[link.breadcrumb_id].count++;
            const recipient = link.recipient as any;
            if (recipient?.display_name) {
              recipientData[link.breadcrumb_id].names.push(recipient.display_name);
              recipientData[link.breadcrumb_id].info.push({ 
                id: recipient.id, 
                name: recipient.display_name 
              });
            }
          });
        }
      }

      // Merge recipient data into breadcrumbs
      const breadcrumbsWithCounts = (breadcrumbsData || []).map(b => ({
        ...b,
        recipient_count: recipientData[b.id]?.count || 1,
        recipient_names: recipientData[b.id]?.names || [],
        recipients_info: recipientData[b.id]?.info || []
      }));

      const {
        data: recipientsData,
        error: recipientsError
      } = await supabase.from("recipients").select("id, display_name").eq("creator_id", profile.id);
      if (recipientsError) throw recipientsError;
      const {
        data: topicsData,
        error: topicsError
      } = await supabase.from("topics").select("id, name").eq("is_active", true).order("sort_order");
      if (topicsError) throw topicsError;

      // Fetch family ID
      const { data: familyData } = await supabase.rpc("get_user_family_id", { _user_id: profile.user_id });
      if (familyData) {
        setFamilyId(familyData);
      }

      setBreadcrumbs(breadcrumbsWithCounts as any || []);
      setRecipients(recipientsData || []);
      setTopics(topicsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const filteredBreadcrumbs = breadcrumbs.filter(b => {
    const matchesSearch = !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.text_body?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRecipient = selectedRecipient === "all" || 
      b.recipient?.id === selectedRecipient ||
      b.recipients_info?.some(r => r.id === selectedRecipient);
    const matchesTopic = selectedTopic === "all" || b.topic?.id === selectedTopic;
    return matchesSearch && matchesRecipient && matchesTopic;
  });

  const handleRecipientFilter = (recipientId: string) => {
    setSelectedRecipient(recipientId);
  };

  const handleDeleteBreadcrumb = async (breadcrumbId: string) => {
    // Prevent double-delete
    if (deletingIds.has(breadcrumbId)) return;
    
    setDeletingIds(prev => new Set(prev).add(breadcrumbId));
    
    try {
      // First delete related records
      await supabase
        .from("breadcrumb_recipients")
        .delete()
        .eq("breadcrumb_id", breadcrumbId);
      
      await supabase
        .from("breadcrumb_scriptures")
        .delete()
        .eq("breadcrumb_id", breadcrumbId);

      // Then delete the breadcrumb
      const { error } = await supabase
        .from("breadcrumbs")
        .delete()
        .eq("id", breadcrumbId);

      if (error) throw error;

      // Update local state
      setBreadcrumbs(prev => prev.filter(b => b.id !== breadcrumbId));
      toast.success("Breadcrumb deleted");
    } catch (error) {
      console.error("Error deleting breadcrumb:", error);
      toast.error("Failed to delete breadcrumb");
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(breadcrumbId);
        return next;
      });
    }
  };
  if (authLoading || isLoading) {
    return <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>;
  }
  return <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-white">
            Welcome, {profile?.name?.split(" ")[0]}
          </h1>
          <p className="text-white/60 mt-0.5 text-sm sm:text-base">
            {breadcrumbs.length === 0 ? "Start leaving breadcrumbs for your loved ones." : `You've left ${breadcrumbs.length} breadcrumb${breadcrumbs.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link to="/creator/progress">
            <Button variant="outline" size="sm" className="gap-1.5 border-white/30 text-white hover:bg-white/10">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Progress</span>
            </Button>
          </Link>
          <Link to="/creator/prompts">
            <Button variant="outline" size="sm" className="gap-1.5 border-white/30 text-white hover:bg-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prompts</span>
            </Button>
          </Link>
          
          <Link to="/creator/prompts">
            <Button size="sm" className="gap-1.5 bg-white text-black hover:bg-white/90">
              <Plus className="w-3.5 h-3.5" />
              Create
            </Button>
          </Link>
        </div>
      </div>



      {/* Progress Summary Widget */}
      <div className="mb-4 sm:mb-6">
        <ProgressSummaryWidget profileId={profile?.id} />
      </div>

      {/* Filters */}
      <div className="p-3 sm:p-4 mb-4 sm:mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input placeholder="Search breadcrumbs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger className="w-[140px] bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="All Recipients" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="all" className="text-white">All Recipients</SelectItem>
                {recipients.map(r => <SelectItem key={r.id} value={r.id} className="text-white">
                    {r.display_name}
                  </SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedTopic} onValueChange={setSelectedTopic}>
              <SelectTrigger className="w-[120px] bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="All Topics" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="all" className="text-white">All Topics</SelectItem>
                {[...topics].sort((a, b) => a.name.localeCompare(b.name)).map(t => <SelectItem key={t.id} value={t.id} className="text-white">
                    {t.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>

          </div>
        </div>
      </div>

      {/* Breadcrumbs List */}
      <div className="rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 p-3 sm:p-6">
        <button
          onClick={() => setBreadcrumbsOpen(!breadcrumbsOpen)}
          className="w-full flex items-center justify-between"
        >
          <h2 className="font-serif text-lg font-medium text-white">
            Your Breadcrumbs
            <span className="ml-2 text-sm font-normal text-white/40">({filteredBreadcrumbs.length})</span>
          </h2>
          <ChevronDown className={`w-5 h-5 text-white/60 transition-transform duration-200 ${breadcrumbsOpen ? "rotate-180" : ""}`} />
        </button>
        {breadcrumbsOpen && (
          <div className="mt-4">
            {filteredBreadcrumbs.length === 0 ? <div className="text-center py-12">
              {breadcrumbs.length === 0 ? <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Plus className="w-8 h-8 text-white/60" />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-white mb-2">
                    No breadcrumbs yet
                  </h3>
                  <p className="text-white/60 mb-6 max-w-sm mx-auto">
                    {recipients.length === 0 ? "Add a recipient first, then start leaving wisdom for them." : "Start leaving wisdom, stories, and scriptures for your loved ones."}
                  </p>
                  <Link to={recipients.length === 0 ? "/creator/recipients" : "/creator/create"}>
                    <Button className="bg-white text-black hover:bg-white/90">
                      {recipients.length === 0 ? "Add a Recipient" : "Create Your First Breadcrumb"}
                    </Button>
                  </Link>
                </> : <>
                  <Filter className="w-12 h-12 mx-auto mb-4 text-white/60" />
                  <h3 className="font-serif text-xl font-medium text-white mb-2">
                    No matching breadcrumbs
                  </h3>
                  <p className="text-white/60">
                    Try adjusting your filters or search query.
                  </p>
                </>}
            </div> : <div className="grid gap-3 sm:gap-4">
              {filteredBreadcrumbs.map(breadcrumb => (
                isMobile ? (
                  <SwipeableCard 
                    key={breadcrumb.id} 
                    onDelete={() => handleDeleteBreadcrumb(breadcrumb.id)}
                    disabled={deletingIds.has(breadcrumb.id)}
                  >
                    <BreadcrumbCard 
                      breadcrumb={breadcrumb} 
                      showRecipient 
                      onRecipientClick={handleRecipientFilter} 
                    />
                  </SwipeableCard>
                ) : (
                  <BreadcrumbCard 
                    key={breadcrumb.id} 
                    breadcrumb={breadcrumb} 
                    showRecipient 
                    onRecipientClick={handleRecipientFilter} 
                  />
                )
              ))}
            </div>}
          </div>
        )}
      </div>

      {/* Quick Capture Floating Button */}
      {profile && recipients.length > 0 && (
        <QuickCaptureButton
          recipients={recipients}
          creatorId={profile.id}
          familyId={familyId}
          onSuccess={fetchData}
        />
      )}
    </DashboardLayout>;
}