import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, User, Heart, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Creator {
  id: string;
  name: string;
}

interface TalkToCreatorChatProps {
  creator: Creator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TalkToCreatorChat({ creator, open, onOpenChange }: TalkToCreatorChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset chat when creator changes or dialog opens
  useEffect(() => {
    if (open) {
      setMessages([]);
      setInputMessage("");
      // Add initial greeting
      setMessages([{
        role: "assistant",
        content: `Hi there! I'm here to share ${creator.name.split(" ")[0]}'s wisdom and thoughts with you. What would you like to talk about?`
      }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, creator.id, creator.name]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    
    // Add user message
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    
    setIsLoading(true);

    try {
      // Send only the actual conversation (excluding the initial greeting for cleaner history)
      const historyForApi = newMessages.filter((_, i) => i > 0);
      
      const response = await supabase.functions.invoke("talk-to-creator", {
        body: {
          message: userMessage,
          creatorId: creator.id,
          creatorName: creator.name,
          conversationHistory: historyForApi.slice(0, -1), // Exclude current message
        },
      });

      if (response.error) throw response.error;

      const data = response.data;
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data?.response || "I'm having trouble responding right now."
      }]);
    } catch (error: any) {
      console.error("Error in chat:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to get a response. Please try again.",
        variant: "destructive",
      });
      // Remove the user message if we failed
      setMessages(prev => prev.slice(0, -1));
      setInputMessage(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[600px] flex flex-col p-0 gap-0 bg-gradient-to-b from-background to-secondary/30 border-border">
        <DialogHeader className="px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-serif text-lg">Talk to {creator.name.split(" ")[0]}</span>
              <p className="text-xs text-muted-foreground font-normal">
                Powered by their breadcrumbs
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                        <Heart className="w-3 h-3 text-accent" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {creator.name.split(" ")[0]}
                      </span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                      <Heart className="w-3 h-3 text-accent" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-background/80 backdrop-blur-sm">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder={`Ask ${creator.name.split(" ")[0]} anything...`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Responses are based on {creator.name.split(" ")[0]}'s saved wisdom
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
