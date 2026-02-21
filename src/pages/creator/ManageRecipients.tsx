import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, User, Trash2, Edit2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Recipient {
  id: string;
  display_name: string;
  email: string | null;
  relationship: string | null;
  created_at: string;
}

export default function ManageRecipients() {
  const { profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    relationship: "",
  });
  const [isSaving, setIsSaving] = useState(false);

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
      fetchRecipients();
    }
  }, [profile, authLoading, navigate]);

  const fetchRecipients = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from("recipients")
        .select("*")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecipients(data || []);
    } catch (error) {
      console.error("Error fetching recipients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("recipients")
          .update({
            display_name: formData.display_name,
            email: formData.email || null,
            relationship: formData.relationship || null,
          })
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Recipient updated",
          description: `${formData.display_name} has been updated.`,
        });
      } else {
        const { error } = await supabase.from("recipients").insert({
          creator_id: profile.id,
          display_name: formData.display_name,
          email: formData.email || null,
          relationship: formData.relationship || null,
        });

        if (error) throw error;

        toast({
          title: "Recipient added",
          description: `${formData.display_name} has been added.`,
        });
      }

      setFormData({ display_name: "", email: "", relationship: "" });
      setEditingId(null);
      setIsDialogOpen(false);
      fetchRecipients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (recipient: Recipient) => {
    setFormData({
      display_name: recipient.display_name,
      email: recipient.email || "",
      relationship: recipient.relationship || "",
    });
    setEditingId(recipient.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("recipients").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Recipient deleted",
        description: "The recipient has been removed.",
      });

      fetchRecipients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete recipient.",
        variant: "destructive",
      });
    }
  };

  const openNewDialog = () => {
    setFormData({ display_name: "", email: "", relationship: "" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/creator" 
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-white">
              Your Recipients
            </h1>
            <p className="text-white/60 mt-1">
              Manage the people you're leaving breadcrumbs for.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="gap-2 bg-white text-black hover:bg-white/90" 
                onClick={openNewDialog}
              >
                <Plus className="w-4 h-4" />
                Add Recipient
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black/90 border-white/20 text-white">
              <DialogHeader>
                <DialogTitle className="font-serif text-white">
                  {editingId ? "Edit Recipient" : "Add New Recipient"}
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  {editingId 
                    ? "Update the recipient's information."
                    : "Add someone you want to leave breadcrumbs for."
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name" className="text-white/80">Name *</Label>
                  <Input
                    id="display_name"
                    placeholder="e.g., Cairo, My Daughter"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="their.email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                  <p className="text-xs text-white/40">
                    If provided, they can log in to view their breadcrumbs.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship" className="text-white/80">Relationship (optional)</Label>
                  <Input
                    id="relationship"
                    placeholder="e.g., Son, Daughter, Spouse"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-white text-black hover:bg-white/90"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingId ? (
                      "Update"
                    ) : (
                      "Add Recipient"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Recipients List */}
      {recipients.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
            <User className="w-8 h-8 text-white/60" />
          </div>
          <h3 className="font-serif text-xl font-medium text-white mb-2">
            No recipients yet
          </h3>
          <p className="text-white/60 mb-6 max-w-sm mx-auto">
            Add the people you want to leave breadcrumbs for — your children, spouse, or anyone special.
          </p>
          <Button className="bg-white text-black hover:bg-white/90" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Recipient
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {recipients.map((recipient) => (
            <div 
              key={recipient.id} 
              className="p-5 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-medium text-white">
                      {recipient.display_name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      {recipient.relationship && (
                        <span>{recipient.relationship}</span>
                      )}
                      {recipient.email && (
                        <span className="text-xs">{recipient.email}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(recipient)}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-400 hover:text-red-300 hover:bg-white/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-black/90 border-white/20 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Delete recipient?</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60">
                          This will permanently delete {recipient.display_name} and all breadcrumbs left for them. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(recipient.id)}
                          className="bg-red-500 text-white hover:bg-red-600"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
