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
import { ArrowLeft, Plus, Loader2, BookOpen, FileText, Mic, AlertCircle } from "lucide-react";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
interface Recipient {
  id: string;
  display_name: string;
}
interface Topic {
  id: string;
  name: string;
}
interface DuplicateWarning {
  id: string;
  title: string;
}
type ContentType = "text" | "voice_note" | "scripture";
export default function CreateBreadcrumb() {
  const {
    profile,
    user,
    isLoading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isNewTopicDialogOpen, setIsNewTopicDialogOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [formData, setFormData] = useState({
    recipient_ids: [] as string[],
    topic_id: "",
    title: "",
    content_type: "text" as ContentType,
    text_body: "",
    is_scripture: false,
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
      const [recipientsRes, topicsRes] = await Promise.all([supabase.from("recipients").select("id, display_name").eq("creator_id", profile.id), supabase.from("topics").select("id, name").eq("creator_id", profile.id)]);
      if (recipientsRes.error) throw recipientsRes.error;
      if (topicsRes.error) throw topicsRes.error;
      setRecipients(recipientsRes.data || []);
      setTopics(topicsRes.data || []);
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
        const {
          data,
          error
        } = await supabase.from("breadcrumbs").select("id, title").eq("creator_id", profile.id).eq("recipient_id", formData.recipient_ids[0]).ilike("title", formData.title).gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()).limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
          setDuplicateWarning({
            id: data[0].id,
            title: data[0].title
          });
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
  const handleAddTopic = async () => {
    if (!profile || !newTopicName.trim()) return;
    try {
      const {
        data,
        error
      } = await supabase.from("topics").insert({
        creator_id: profile.id,
        name: newTopicName.trim()
      }).select().single();
      if (error) throw error;
      setTopics([...topics, data]);
      setFormData({
        ...formData,
        topic_id: data.id
      });
      setNewTopicName("");
      setIsNewTopicDialogOpen(false);
      toast({
        title: "Topic created",
        description: `"${data.name}" has been added.`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create topic.",
        variant: "destructive"
      });
    }
  };
  const uploadAudio = async (blob: Blob): Promise<string | null> => {
    if (!user) return null;
    setIsUploading(true);
    try {
      const fileExt = blob.type.includes("webm") ? "webm" : "mp4";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const {
        error: uploadError
      } = await supabase.storage.from("audio").upload(fileName, blob, {
        contentType: blob.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const {
        data: urlData
      } = supabase.storage.from("audio").getPublicUrl(fileName);
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
    setFormData({
      ...formData,
      audio_url: ""
    });
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
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

    // Validate voice note has audio
    if (formData.content_type === "voice_note" && !audioBlob) {
      toast({
        title: "Recording required",
        description: "Please record a voice note before saving.",
        variant: "destructive"
      });
      return;
    }
    setIsSaving(true);
    try {
      let audioUrl = formData.audio_url;

      // Upload audio if we have a new recording
      if (formData.content_type === "voice_note" && audioBlob) {
        const uploadedUrl = await uploadAudio(audioBlob);
        if (!uploadedUrl) {
          setIsSaving(false);
          return;
        }
        audioUrl = uploadedUrl;
      }
      const contentType = formData.is_scripture ? "scripture" : formData.content_type;

      // Use selected recipient IDs
      const targetRecipientIds = formData.recipient_ids;

      // Create breadcrumb(s) for each recipient
      const breadcrumbsToInsert = targetRecipientIds.map(recipientId => ({
        creator_id: profile.id,
        recipient_id: recipientId,
        topic_id: formData.topic_id || null,
        title: formData.title.trim(),
        content_type: contentType,
        text_body: formData.text_body || null,
        audio_url: audioUrl || null,
        is_scripture: formData.is_scripture,
        scripture_reference: formData.scripture_reference || null,
        scripture_text: formData.scripture_text || null,
        include_commentary: formData.include_commentary,
        commentary_text: formData.commentary_text || null
      }));
      const {
        error
      } = await supabase.from("breadcrumbs").insert(breadcrumbsToInsert);
      if (error) throw error;
      const recipientCount = targetRecipientIds.length;
      toast({
        title: recipientCount > 1 ? "Breadcrumbs created" : "Breadcrumb created",
        description: recipientCount > 1 ? `Your wisdom has been saved for ${recipientCount} family members.` : "Your wisdom has been saved."
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
    return <DashboardLayout>
        <div className="container-narrow flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>;
  }
  if (recipients.length === 0) {
    return <DashboardLayout>
        <div className="container-narrow text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
            <Plus className="w-8 h-8 text-muted-foreground" />
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
      </DashboardLayout>;
  }
  return <DashboardLayout>
      <div className="container-narrow">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <Link to="/creator" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-border">
            Create Breadcrumb
          </h1>
          <p className="text-muted-foreground mt-1">
            Leave a piece of wisdom for someone you love.
          </p>
        </div>

        {/* Duplicate Warning */}
        {duplicateWarning && <Alert className="mb-6 animate-fade-up border-accent/50 bg-accent/5">
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
          </Alert>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 animate-fade-up space-y-6" style={{
        animationDelay: "0.1s"
      }}>
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

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <div className="flex gap-2">
              <Select value={formData.topic_id} onValueChange={value => {
              if (value === "__new__") {
                setIsNewTopicDialogOpen(true);
              } else {
                setFormData({
                  ...formData,
                  topic_id: value
                });
              }
            }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a topic (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map(t => <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>)}
                  <SelectItem value="__new__" className="text-accent">
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      New Topic
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder="e.g., On handling money when anxious" value={formData.title} onChange={e => setFormData({
            ...formData,
            title: e.target.value
          })} />
          </div>

          {/* Content Type Selector */}
          <div className="space-y-3">
            <Label>Content Type</Label>
            <div className="grid grid-cols-3 gap-3">
              <button type="button" onClick={() => setFormData({
              ...formData,
              content_type: "text",
              is_scripture: false
            })} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.content_type === "text" && !formData.is_scripture ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <FileText className={`w-6 h-6 ${formData.content_type === "text" && !formData.is_scripture ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Text</span>
              </button>
              <button type="button" onClick={() => setFormData({
              ...formData,
              content_type: "voice_note",
              is_scripture: false
            })} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.content_type === "voice_note" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Mic className={`w-6 h-6 ${formData.content_type === "voice_note" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Voice Note</span>
              </button>
              <button type="button" onClick={() => setFormData({
              ...formData,
              content_type: "scripture",
              is_scripture: true
            })} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.is_scripture ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <BookOpen className={`w-6 h-6 ${formData.is_scripture ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Scripture</span>
              </button>
            </div>
          </div>

          {/* Voice Note Recorder */}
          {formData.content_type === "voice_note" && <div className="space-y-2">
              <Label>Voice Recording</Label>
              <VoiceRecorder onRecordingComplete={handleRecordingComplete} onRemove={handleRemoveRecording} audioUrl={formData.audio_url} />
            </div>}

          {/* Scripture Fields */}
          {formData.is_scripture && <>
              <div className="space-y-2">
                <Label htmlFor="scripture_reference">Scripture Reference</Label>
                <Input id="scripture_reference" placeholder="e.g., Matthew 6:22" value={formData.scripture_reference} onChange={e => setFormData({
              ...formData,
              scripture_reference: e.target.value
            })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scripture_text">Scripture Text (optional)</Label>
                <Textarea id="scripture_text" placeholder="The light of the body is the eye..." value={formData.scripture_text} onChange={e => setFormData({
              ...formData,
              scripture_text: e.target.value
            })} rows={4} />
              </div>
            </>}

          {/* Main Content for Text */}
          {(formData.content_type === "text" || formData.is_scripture) && <div className="space-y-2">
              <Label htmlFor="text_body">
                {formData.is_scripture ? "Your Reflection" : "Your Message"}
              </Label>
              <Textarea id="text_body" placeholder={formData.is_scripture ? "What does this scripture mean to you? Why is it important?" : "Write your wisdom, story, or lesson here..."} value={formData.text_body} onChange={e => setFormData({
            ...formData,
            text_body: e.target.value
          })} rows={6} />
            </div>}

          {/* Optional note for voice notes */}
          {formData.content_type === "voice_note" && <div className="space-y-2">
              <Label htmlFor="text_body">Additional Notes (optional)</Label>
              <Textarea id="text_body" placeholder="Add any written notes to accompany your voice recording..." value={formData.text_body} onChange={e => setFormData({
            ...formData,
            text_body: e.target.value
          })} rows={3} />
            </div>}

          {/* Include Commentary */}
          <div className="flex items-center justify-between py-4 border-t border-border">
            <div>
              <Label htmlFor="include_commentary" className="cursor-pointer">
                Include Personal Commentary
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add additional context or thoughts beyond your main message.
              </p>
            </div>
            <Switch id="include_commentary" checked={formData.include_commentary} onCheckedChange={checked => setFormData({
            ...formData,
            include_commentary: checked
          })} />
          </div>

          {formData.include_commentary && <div className="space-y-2">
              <Label htmlFor="commentary_text">Your Commentary</Label>
              <Textarea id="commentary_text" placeholder="Add your personal thoughts, context, or additional reflections..." value={formData.commentary_text} onChange={e => setFormData({
            ...formData,
            commentary_text: e.target.value
          })} rows={4} />
            </div>}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link to="/creator">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="hero" disabled={isSaving || isUploading}>
              {isSaving || isUploading ? <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isUploading ? "Uploading..." : "Saving..."}
                </> : "Save Breadcrumb"}
            </Button>
          </div>
        </form>

        {/* New Topic Dialog */}
        <Dialog open={isNewTopicDialogOpen} onOpenChange={setIsNewTopicDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Create New Topic</DialogTitle>
              <DialogDescription>
                Topics help organize your breadcrumbs by theme.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="new_topic_name">Topic Name</Label>
                <Input id="new_topic_name" placeholder="e.g., Faith, Money, Relationships" value={newTopicName} onChange={e => setNewTopicName(e.target.value)} onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTopic();
                }
              }} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsNewTopicDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleAddTopic}>
                  Create Topic
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>;
}