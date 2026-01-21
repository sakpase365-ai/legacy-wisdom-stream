import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mic, Square, Play, Pause, Trash2, Loader2, 
  Sparkles, Check, X, ChevronRight, Edit2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  recipients: { id: string; display_name: string }[];
  creatorId: string;
  familyId?: string;
  initialPrompt?: string;
  initialTags?: string[];
}

interface StructuredBreadcrumb {
  title: string;
  summary: string;
  key_points: string[];
  tags: string[];
  topics: string[];
  references: string[];
  is_sensitive: boolean;
  sensitivity_reason?: string;
}

type Step = "input" | "processing" | "preview" | "saving";

export function QuickCaptureModal({ 
  open, 
  onOpenChange, 
  onSuccess,
  recipients,
  creatorId,
  familyId,
  initialPrompt,
  initialTags
}: QuickCaptureModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [inputType, setInputType] = useState<"text" | "voice">("text");
  const [textContent, setTextContent] = useState("");
  const [promptContext, setPromptContext] = useState<string | null>(null);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Preview state
  const [structured, setStructured] = useState<StructuredBreadcrumb | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      resetState();
    } else if (initialPrompt) {
      // Set initial prompt context when modal opens with a prompt
      setPromptContext(initialPrompt);
      setInputType("voice"); // Default to voice for prompts
    }
  }, [open, initialPrompt]);

  const resetState = () => {
    setStep("input");
    setTextContent("");
    setPromptContext(null);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setIsRecording(false);
    setRecordingTime(0);
    setStructured(null);
    setEditedTitle("");
    setSelectedRecipients([]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const removeRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
  };

  // Process content with AI
  const handleProcess = async () => {
    const content = inputType === "text" ? textContent : "Voice note recorded";
    if (inputType === "text" && !textContent.trim()) {
      toast.error("Please enter some content");
      return;
    }
    if (inputType === "voice" && !audioBlob) {
      toast.error("Please record a voice note");
      return;
    }

    setStep("processing");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // For voice, we'd need speech-to-text first - for now use placeholder
      const rawContent = inputType === "text" 
        ? textContent 
        : "[Voice note - transcription pending]";

      const { data, error } = await supabase.functions.invoke("capture-breadcrumb", {
        body: {
          action: "capture",
          raw_content: rawContent,
          media_type: inputType,
          beneficiaries: selectedRecipients.length > 0 
            ? selectedRecipients.map(id => recipients.find(r => r.id === id)?.display_name || "")
            : ["All"],
        }
      });

      if (error) throw error;
      
      setStructured(data.structured_breadcrumb);
      setEditedTitle(data.structured_breadcrumb.title);
      setStep("preview");
    } catch (error) {
      console.error("Error processing content:", error);
      toast.error("Failed to process content");
      setStep("input");
    }
  };

  // Save the breadcrumb
  const handleSave = async () => {
    if (!structured) return;
    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setStep("saving");

    try {
      // Upload audio if present
      let audioPath: string | null = null;
      if (audioBlob) {
        const fileName = `${creatorId}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("voice-notes")
          .upload(fileName, audioBlob);
        if (!uploadError) {
          audioPath = fileName;
        }
      }

      // Get topic ID from first topic if available
      let topicId: string | null = null;
      if (structured.topics.length > 0) {
        const { data: topicData } = await supabase
          .from("topics")
          .select("id")
          .ilike("name", structured.topics[0])
          .limit(1)
          .single();
        if (topicData) topicId = topicData.id;
      }

      // Create the breadcrumb
      const { data: breadcrumb, error: insertError } = await supabase
        .from("breadcrumbs")
        .insert({
          creator_id: creatorId,
          recipient_id: selectedRecipients[0], // Primary recipient
          family_id: familyId || null,
          title: editedTitle || structured.title,
          content_type: inputType === "voice" ? "voice_note" : "text",
          text_body: inputType === "text" ? textContent : structured.summary,
          audio_url: audioPath,
          tags: structured.tags,
          visibility: "family",
          is_scripture: structured.references.length > 0,
          scripture_reference: structured.references.join(", ") || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Link all selected recipients
      if (breadcrumb && selectedRecipients.length > 0) {
        const recipientLinks = selectedRecipients.map(recipientId => ({
          breadcrumb_id: breadcrumb.id,
          recipient_id: recipientId,
        }));
        await supabase.from("breadcrumb_recipients").insert(recipientLinks);
      }

      toast.success("Breadcrumb saved!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving breadcrumb:", error);
      toast.error("Failed to save breadcrumb");
      setStep("preview");
    }
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev => 
      prev.includes(id) 
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {step === "input" && "Quick Capture"}
            {step === "processing" && "Processing..."}
            {step === "preview" && "Preview Breadcrumb"}
            {step === "saving" && "Saving..."}
          </DialogTitle>
        </DialogHeader>

        {/* Hidden audio element */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}

        {/* Step: Input */}
        {step === "input" && (
          <div className="space-y-4">
            {/* Show prompt context if available */}
            {promptContext && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Recording prompt:</p>
                <p className="text-foreground font-medium">{promptContext}</p>
              </div>
            )}
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as "text" | "voice")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4">
                <Textarea
                  placeholder="Share a thought, story, lesson, or piece of wisdom..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="min-h-[150px] bg-secondary/50 border-border"
                />
              </TabsContent>

              <TabsContent value="voice" className="mt-4">
                {/* Not recording, no recording */}
                {!isRecording && !audioUrl && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-full flex items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border bg-secondary/30 hover:bg-secondary/50 transition-all"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mic className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Record Voice Note</p>
                      <p className="text-sm text-muted-foreground">Tap to start</p>
                    </div>
                  </button>
                )}

                {/* Recording in progress */}
                {isRecording && (
                  <div className="flex items-center justify-between p-6 rounded-xl bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                      </div>
                      <div>
                        <p className="font-medium">Recording...</p>
                        <p className="text-2xl font-mono text-destructive">{formatTime(recordingTime)}</p>
                      </div>
                    </div>
                    <Button variant="destructive" onClick={stopRecording}>
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                )}

                {/* Recording complete */}
                {!isRecording && audioUrl && (
                  <div className="flex items-center justify-between p-6 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={togglePlayback}
                        className="w-12 h-12 rounded-full"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                      </Button>
                      <div>
                        <p className="font-medium">Voice Note</p>
                        <p className="text-sm text-muted-foreground">{formatTime(recordingTime)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={removeRecording}>
                      <Trash2 className="w-5 h-5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Recipients selection */}
            <div className="space-y-2">
              <Label>For</Label>
              <div className="flex flex-wrap gap-2">
                {recipients.map(r => (
                  <Badge
                    key={r.id}
                    variant={selectedRecipients.includes(r.id) ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleRecipient(r.id)}
                  >
                    {r.display_name}
                    {selectedRecipients.includes(r.id) && <Check className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={handleProcess}
                disabled={(inputType === "text" && !textContent.trim()) || (inputType === "voice" && !audioUrl)}
              >
                <Sparkles className="w-4 h-4" />
                Process with AI
              </Button>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <Sparkles className="w-5 h-5 text-primary absolute -top-1 -right-1" />
            </div>
            <p className="text-muted-foreground">AI is structuring your breadcrumb...</p>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && structured && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Editable title */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Title <Edit2 className="w-3 h-3 text-muted-foreground" />
              </Label>
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="font-medium bg-secondary/50"
              />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label>Summary</Label>
              <p className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg">
                {structured.summary}
              </p>
            </div>

            {/* Key Points */}
            <div className="space-y-2">
              <Label>Key Points</Label>
              <ul className="text-sm space-y-1">
                {structured.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1">
                {structured.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Topics */}
            <div className="space-y-2">
              <Label>Topics</Label>
              <div className="flex flex-wrap gap-1">
                {structured.topics.map((topic, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>

            {/* References */}
            {structured.references.length > 0 && (
              <div className="space-y-2">
                <Label>References</Label>
                <div className="flex flex-wrap gap-1">
                  {structured.references.map((ref, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30">
                      {ref}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sensitivity warning */}
            {structured.is_sensitive && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                <p className="font-medium text-amber-200">⚠️ Sensitive Content</p>
                <p className="text-amber-200/70">{structured.sensitivity_reason}</p>
              </div>
            )}

            {/* Recipients */}
            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="flex flex-wrap gap-2">
                {recipients.map(r => (
                  <Badge
                    key={r.id}
                    variant={selectedRecipients.includes(r.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleRecipient(r.id)}
                  >
                    {r.display_name}
                    {selectedRecipients.includes(r.id) && <Check className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep("input")}>
                Back
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={handleSave}
                disabled={selectedRecipients.length === 0}
              >
                <Check className="w-4 h-4" />
                Save Breadcrumb
              </Button>
            </div>
          </div>
        )}

        {/* Step: Saving */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Saving your breadcrumb...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
