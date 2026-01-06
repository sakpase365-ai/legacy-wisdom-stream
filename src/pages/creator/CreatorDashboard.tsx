import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search, Filter, Loader2 } from "lucide-react";
import { BreadcrumbCard } from "@/components/BreadcrumbCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  
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

      // Fetch recipient counts and names for each breadcrumb
      const breadcrumbIds = (breadcrumbsData || []).map(b => b.id);
      let recipientData: Record<string, { count: number; names: string[] }> = {};
      
      if (breadcrumbIds.length > 0) {
        const { data: recipientLinks } = await supabase
          .from("breadcrumb_recipients")
          .select("breadcrumb_id, recipient:recipients(display_name)")
          .in("breadcrumb_id", breadcrumbIds);
        
        if (recipientLinks) {
          recipientLinks.forEach(link => {
            if (!recipientData[link.breadcrumb_id]) {
              recipientData[link.breadcrumb_id] = { count: 0, names: [] };
            }
            recipientData[link.breadcrumb_id].count++;
            const recipientName = (link.recipient as any)?.display_name;
            if (recipientName) {
              recipientData[link.breadcrumb_id].names.push(recipientName);
            }
          });
        }
      }

      // Merge recipient data into breadcrumbs
      const breadcrumbsWithCounts = (breadcrumbsData || []).map(b => ({
        ...b,
        recipient_count: recipientData[b.id]?.count || 1,
        recipient_names: recipientData[b.id]?.names || []
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
    const matchesRecipient = selectedRecipient === "all" || b.recipient?.id === selectedRecipient;
    const matchesTopic = selectedTopic === "all" || b.topic?.id === selectedTopic;
    return matchesSearch && matchesRecipient && matchesTopic;
  });
  if (authLoading || isLoading) {
    return <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>;
  }
  return <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-white">
            Welcome, {profile?.name?.split(" ")[0]}
          </h1>
          <p className="text-white/60 mt-1">
            {breadcrumbs.length === 0 ? "Start leaving breadcrumbs for your loved ones." : `You've left ${breadcrumbs.length} breadcrumb${breadcrumbs.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/creator/recipients">
            <Button className="gap-2 bg-amber-100 text-amber-950 hover:bg-amber-200">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Recipients</span>
            </Button>
          </Link>
          <Link to="/creator/create">
            <Button className="gap-2 bg-amber-100 text-amber-950 hover:bg-amber-200">
              <Plus className="w-4 h-4" />
              Create
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
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
                {topics.map(t => <SelectItem key={t.id} value={t.id} className="text-white">
                    {t.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>

          </div>
        </div>
      </div>

      {/* Breadcrumbs List */}
      {filteredBreadcrumbs.length === 0 ? <div className="text-center py-16">
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
                <Button className="bg-amber-100 text-amber-950 hover:bg-amber-200">
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
        </div> : <div className="grid gap-4">
          {filteredBreadcrumbs.map(breadcrumb => <BreadcrumbCard key={breadcrumb.id} breadcrumb={breadcrumb} showRecipient />)}
        </div>}
    </DashboardLayout>;
}