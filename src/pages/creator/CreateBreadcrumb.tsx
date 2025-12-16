import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, BookOpen, FileText, Mic, AlertCircle, ChevronRight } from "lucide-react";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Recipient {
  id: string;
  display_name: string;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Topic {
  id: string;
  name: string;
  category_id: string;
  sort_order: number;
}

interface DuplicateWarning {
  id: string;
  title: string;
}

type ContentType = "text" | "voice_note";

type Step = 1 | 2 | 3;

export default function CreateBreadcrumb() {
  const { profile, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [scriptureOpen, setScriptureOpen] = useState(false);

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    recipient_ids: [] as string[],
    title: "",
    content_type: "text" as ContentType,
    text_body: "",
    scripture_reference: "",
    scripture_text: "",
    include_commentary: false,
    commentary_text: "",
    audio_url: ""
  });

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
      const [recipientsRes, categoriesRes, topicsRes, familyRes] = await Promise.all([
        supabase.from("recipients").select("id, display_name").eq("creator_id", profile.id),
        supabase.from("categories").select("id, name, sort_order").eq("is_active", true).order("sort_order"),
        supabase.from("topics").select("id, name, category_id, sort_order").eq("is_active", true).order("sort_order"),
        supabase.from("family_members").select("family_id").eq("user_id", profile.user_id).maybeSingle()
      ]);

      if (recipientsRes.error) throw recipientsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (topicsRes.error) throw topicsRes.error;

      setRecipients(recipientsRes.data || []);
      setCategories(categoriesRes.data || []);
      setTopics(topicsRes.data || []);
      
      if (familyRes.data) {
        setFamilyId(familyRes.data.family_id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for duplicates when title or recipient changes (skip for multiple recipients)
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!profile || !formData.title || formData.recipient_ids.length !== 1) {
        setDuplicateWarning(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("breadcrumbs")
          .select("id, title")
          .eq("creator_id", profile.id)
          .eq("recipient_id", formData.recipient_ids[0])
          .ilike("title", formData.title)
          .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          setDuplicateWarning({ id: data[0].id, title: data[0].title });
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error("Error checking duplicate:", error);
      }
    };
    const debounce = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(debounce);
  }, [formData.title, formData.recipient_ids, profile]);

  const uploadAudio = async (blob: Blob): Promise<string | null> => {
    if (!user) return null;
    setIsUploading(true);
    try {
      const fileExt = blob.type.includes("webm") ? "webm" : "mp4";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, blob, { contentType: blob.type, upsert: false });

      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error: any) {
      console.error("Error uploading audio:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload voice note.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
  };

  const handleRemoveRecording = () => {
    setAudioBlob(null);
    setFormData({ ...formData, audio_url: "" });
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedTopicId(null);
    setCurrentStep(2);
  };

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopicId(topicId);
    setCurrentStep(3);
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setSelectedCategoryId(null);
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setSelectedTopicId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedTopicId) return;

    if (formData.recipient_ids.length === 0) {
      toast({
        title: "Recipient required",
        description: "Please select at least one recipient.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please add a title for this breadcrumb.",
        variant: "destructive"
      });
      return;
    }

    if (formData.content_type === "voice_note" && !audioBlob) {
      toast({
        title: "Recording required",
        description: "Please record a voice note before saving.",
        variant: "destructive"
      });
      return;
    }

    if (formData.content_type === "text" && !formData.text_body.trim()) {
      toast({
        title: "Content required",
        description: "Please add some content for this breadcrumb.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      let audioUrl = formData.audio_url;

      if (formData.content_type === "voice_note" && audioBlob) {
        const uploadedUrl = await uploadAudio(audioBlob);
        if (!uploadedUrl) {
          setIsSaving(false);
          return;
        }
        audioUrl = uploadedUrl;
      }

      const breadcrumbsToInsert = formData.recipient_ids.map(recipientId => ({
        creator_id: profile.id,
        recipient_id: recipientId,
        topic_id: selectedTopicId,
        family_id: familyId,
        visibility: "family" as const,
        title: formData.title.trim(),
        content_type: formData.content_type,
        text_body: formData.text_body || null,
        audio_url: audioUrl || null,
        is_scripture: false,
        scripture_reference: formData.scripture_reference || null,
        scripture_text: formData.scripture_text || null,
        include_commentary: formData.include_commentary,
        commentary_text: formData.commentary_text || null
      }));

      const { error } = await supabase.from("breadcrumbs").insert(breadcrumbsToInsert);
      if (error) throw error;

      const recipientCount = formData.recipient_ids.length;
      toast({
        title: recipientCount > 1 ? "Breadcrumbs created" : "Breadcrumb created",
        description: recipientCount > 1
          ? `Your wisdom has been saved for ${recipientCount} family members.`
          : "Your wisdom has been saved."
      });
      navigate("/creator");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create breadcrumb.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="container-narrow flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (recipients.length === 0) {
    return (
      <DashboardLayout>
        <div className="container-narrow text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl font-medium text-foreground mb-2">
            Add a recipient first
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            You need to add someone to leave breadcrumbs for before you can create one.
          </p>
          <Link to="/creator/recipients">
            <Button variant="hero">Add a Recipient</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const selectedTopic = topics.find(t => t.id === selectedTopicId);
  const filteredTopics = topics.filter(t => t.category_id === selectedCategoryId);

  return (
    <DashboardLayout>
      <div className="container-narrow">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <button
            onClick={currentStep === 1 ? () => navigate("/creator") : handleBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? "Back to Dashboard" : "Back"}
          </button>
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            Create Breadcrumb
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentStep === 1 && "Step 1: Choose a category"}
            {currentStep === 2 && `Step 2: Choose a topic in ${selectedCategory?.name}`}
            {currentStep === 3 && "Step 3: Add your wisdom"}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  currentStep >= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step}
              </div>
              {step < 3 && (
                <ChevronRight className={`w-4 h-4 ${currentStep > step ? "text-primary" : "text-muted-foreground"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Category Selection */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className="glass-card p-6 text-left hover:border-primary/50 transition-all group"
              >
                <h3 className="font-serif text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {topics.filter(t => t.category_id === category.id).length} topics
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Topic Selection */}
        {currentStep === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
            {filteredTopics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleTopicSelect(topic.id)}
                className="glass-card p-6 text-left hover:border-primary/50 transition-all group"
              >
                <h3 className="font-serif text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                  {topic.name}
                </h3>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Breadcrumb Details */}
        {currentStep === 3 && (
          <>
            {/* Selected Category & Topic */}
            <div className="glass-card p-4 mb-6 animate-fade-up">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium text-foreground">{selectedCategory?.name}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Topic:</span>
                <span className="font-medium text-foreground">{selectedTopic?.name}</span>
              </div>
            </div>

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <Alert className="mb-6 animate-fade-up border-accent/50 bg-accent/5">
                <AlertCircle className="w-4 h-4 text-accent" />
                <AlertTitle>This looks like a duplicate</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>A similar breadcrumb was recently created: "{duplicateWarning.title}"</span>
                  <div className="flex gap-2 mt-2 sm:mt-0">
                    <Link to={`/breadcrumb/${duplicateWarning.id}`}>
                      <Button variant="outline" size="sm">View existing</Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 animate-fade-up space-y-6">
              {/* Recipients Multi-Select */}
              <div className="space-y-3">
                <Label>Who is this for? *</Label>
                {recipients.length > 1 && (
                  <div className="flex items-center space-x-2 pb-2 border-b border-border/50">
                    <Checkbox
                      id="select-all"
                      checked={formData.recipient_ids.length === recipients.length}
                      onCheckedChange={(checked) => {
                        setFormData({
                          ...formData,
                          recipient_ids: checked ? recipients.map(r => r.id) : []
                        });
                      }}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select All Family Members
                    </label>
                  </div>
                )}
                <div className="space-y-2">
                  {recipients.map(r => (
                    <div key={r.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`recipient-${r.id}`}
                        checked={formData.recipient_ids.includes(r.id)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            recipient_ids: checked
                              ? [...formData.recipient_ids, r.id]
                              : formData.recipient_ids.filter(id => id !== r.id)
                          });
                        }}
                      />
                      <label htmlFor={`recipient-${r.id}`} className="text-sm cursor-pointer">
                        {r.display_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., On handling money when anxious"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Content Type Selector */}
              <div className="space-y-3">
                <Label>Content Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, content_type: "text" })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      formData.content_type === "text"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <FileText className={`w-6 h-6 ${formData.content_type === "text" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, content_type: "voice_note" })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      formData.content_type === "voice_note"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Mic className={`w-6 h-6 ${formData.content_type === "voice_note" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">Voice Note</span>
                  </button>
                </div>
              </div>

              {/* Text Content */}
              {formData.content_type === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="text_body">Your Message *</Label>
                  <Textarea
                    id="text_body"
                    placeholder="Share your wisdom, story, or advice..."
                    value={formData.text_body}
                    onChange={e => setFormData({ ...formData, text_body: e.target.value })}
                    rows={6}
                  />
                </div>
              )}

              {/* Voice Note Recorder */}
              {formData.content_type === "voice_note" && (
                <div className="space-y-2">
                  <Label>Voice Recording *</Label>
                  <VoiceRecorder
                    onRecordingComplete={handleRecordingComplete}
                    onRemove={handleRemoveRecording}
                    audioUrl={formData.audio_url}
                  />
                </div>
              )}

              {/* Scripture (Optional) */}
              <Collapsible open={scriptureOpen} onOpenChange={setScriptureOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    Add Scripture (Optional)
                    <ChevronRight className={`w-4 h-4 transition-transform ${scriptureOpen ? "rotate-90" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="scripture_reference">Scripture Reference</Label>
                    <Input
                      id="scripture_reference"
                      placeholder="e.g., Matthew 6:22"
                      value={formData.scripture_reference}
                      onChange={e => setFormData({ ...formData, scripture_reference: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scripture_text">Scripture Text</Label>
                    <Textarea
                      id="scripture_text"
                      placeholder="Enter the scripture passage..."
                      value={formData.scripture_text}
                      onChange={e => setFormData({ ...formData, scripture_text: e.target.value })}
                      rows={3}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Commentary */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include_commentary"
                    checked={formData.include_commentary}
                    onCheckedChange={checked => setFormData({ ...formData, include_commentary: checked })}
                  />
                  <Label htmlFor="include_commentary">Add personal commentary</Label>
                </div>
                {formData.include_commentary && (
                  <div className="space-y-2">
                    <Label htmlFor="commentary_text">Your Commentary</Label>
                    <Textarea
                      id="commentary_text"
                      placeholder="Add your personal reflection or context..."
                      value={formData.commentary_text}
                      onChange={e => setFormData({ ...formData, commentary_text: e.target.value })}
                      rows={3}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button type="button" variant="outline" onClick={() => navigate("/creator")}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={isSaving || isUploading}>
                  {(isSaving || isUploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isUploading ? "Uploading..." : isSaving ? "Saving..." : "Save Breadcrumb"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
