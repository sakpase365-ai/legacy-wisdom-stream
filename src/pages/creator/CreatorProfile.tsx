import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, X, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const RELATIONSHIP_OPTIONS = [
  "Spouse",
  "Partner",
  "Child",
  "Son",
  "Daughter",
  "Stepchild",
  "Stepson",
  "Stepdaughter",
  "Mother",
  "Father",
  "Stepmother",
  "Stepfather",
  "Grandmother",
  "Grandfather",
  "Grandchild",
  "Grandson",
  "Granddaughter",
  "Brother",
  "Sister",
  "Half-brother",
  "Half-sister",
  "Stepbrother",
  "Stepsister",
  "Aunt",
  "Uncle",
  "Niece",
  "Nephew",
  "Cousin",
  "Mother-in-law",
  "Father-in-law",
  "Sister-in-law",
  "Brother-in-law",
  "Son-in-law",
  "Daughter-in-law",
  "Guardian",
  "Godparent",
  "Godchild",
  "Other",
];

interface FamilyMember {
  id?: string;
  display_name: string;
  relationship: string;
  custom_relationship?: string;
  date_of_birth: Date | null;
}

const CreatorProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [creatorDob, setCreatorDob] = useState<Date | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [existingFamilyId, setExistingFamilyId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<FamilyMember>({
    display_name: "",
    relationship: "",
    custom_relationship: "",
    date_of_birth: null,
  });

  useEffect(() => {
    if (profile) {
      setCreatorName(profile.name || "");
      loadCreatorProfile();
      loadFamilyMembers();
      loadExistingFamily();
    }
  }, [profile]);

  const loadExistingFamily = async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id, families(name)")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setExistingFamilyId(data.family_id);
        setFamilyName((data.families as any)?.name || "");
      }
    } catch (error) {
      console.error("Error loading family:", error);
    }
  };

  const loadCreatorProfile = async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("date_of_birth")
        .eq("user_id", profile.user_id)
        .single();

      if (error) throw error;
      if (data?.date_of_birth) {
        setCreatorDob(new Date(data.date_of_birth));
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const loadFamilyMembers = async () => {
    if (!profile) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("recipients")
        .select("*")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      setFamilyMembers(
        (data || []).map((r) => ({
          id: r.id,
          display_name: r.display_name,
          relationship: RELATIONSHIP_OPTIONS.includes(r.relationship || "") 
            ? r.relationship || "" 
            : "Other",
          custom_relationship: !RELATIONSHIP_OPTIONS.includes(r.relationship || "") 
            ? r.relationship || "" 
            : "",
          date_of_birth: r.date_of_birth ? new Date(r.date_of_birth) : null,
        }))
      );
    } catch (error) {
      console.error("Error loading family members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      display_name: "",
      relationship: "",
      custom_relationship: "",
      date_of_birth: null,
    });
    setShowAddForm(false);
    setEditingIndex(null);
  };

  const handleAddMember = () => {
    setShowAddForm(true);
    setEditingIndex(null);
    setFormData({
      display_name: "",
      relationship: "",
      custom_relationship: "",
      date_of_birth: null,
    });
  };

  const handleEditMember = (index: number) => {
    setEditingIndex(index);
    setShowAddForm(true);
    setFormData({ ...familyMembers[index] });
  };

  const handleRemoveMember = async (index: number) => {
    const member = familyMembers[index];
    
    if (member.id) {
      try {
        const { error } = await supabase
          .from("recipients")
          .delete()
          .eq("id", member.id);

        if (error) throw error;
      } catch (error) {
        console.error("Error removing family member:", error);
        toast({
          title: "Error",
          description: "Failed to remove family member.",
          variant: "destructive",
        });
        return;
      }
    }

    setFamilyMembers((prev) => prev.filter((_, i) => i !== index));
    toast({
      title: "Family member removed",
    });
  };

  const handleSaveMember = async () => {
    if (!formData.display_name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.relationship) {
      toast({
        title: "Error",
        description: "Please select a relationship.",
        variant: "destructive",
      });
      return;
    }

    const relationship = formData.relationship === "Other" 
      ? formData.custom_relationship || "Other" 
      : formData.relationship;

    const memberData = {
      display_name: formData.display_name.trim(),
      relationship,
      date_of_birth: formData.date_of_birth,
    };

    if (editingIndex !== null) {
      const updatedMembers = [...familyMembers];
      updatedMembers[editingIndex] = { 
        ...updatedMembers[editingIndex], 
        ...memberData 
      };
      setFamilyMembers(updatedMembers);
    } else {
      setFamilyMembers((prev) => [...prev, memberData]);
    }

    resetForm();
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    if (!creatorName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Update creator's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: creatorName.trim(),
          date_of_birth: creatorDob ? format(creatorDob, "yyyy-MM-dd") : null,
        })
        .eq("user_id", profile.user_id);

      if (profileError) throw profileError;

      // Create or update family
      let familyId = existingFamilyId;
      
      if (!familyId) {
        // Create new family with owner using security definer function
        const { data: newFamilyId, error: familyError } = await supabase
          .rpc("create_family_with_owner", {
            _family_name: familyName.trim() || `${creatorName.trim()}'s Family`,
            _user_id: profile.user_id,
          });

        if (familyError) throw familyError;
        familyId = newFamilyId;
      } else if (familyName.trim()) {
        // Update existing family name
        await supabase
          .from("families")
          .update({ name: familyName.trim() })
          .eq("id", familyId);
      }

      // Save family members (recipients)
      for (const member of familyMembers) {
        const relationship = member.relationship === "Other" 
          ? member.custom_relationship || "Other" 
          : member.relationship;

        const recipientData = {
          creator_id: profile.id,
          display_name: member.display_name,
          relationship,
          date_of_birth: member.date_of_birth 
            ? format(member.date_of_birth, "yyyy-MM-dd") 
            : null,
        };

        if (member.id) {
          const { error } = await supabase
            .from("recipients")
            .update(recipientData)
            .eq("id", member.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("recipients")
            .insert(recipientData);

          if (error) throw error;
        }
      }

      toast({
        title: "Profile saved!",
        description: "Your profile and family have been set up.",
      });

      navigate("/creator");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-serif font-semibold text-white mb-3">
            Set up your Creator profile
          </h1>
          <p className="text-white/60 text-sm md:text-base max-w-md mx-auto">
            Tell us about you and your family so Breadcrumbs knows who you're speaking to.
          </p>
        </div>

        {/* About You Section */}
        <div className="p-6 md:p-8 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 mb-6">
          <h2 className="text-lg font-serif font-medium text-white mb-6">
            About You
          </h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="creatorName" className="text-white/80">
                Full Name
              </Label>
              <Input
                id="creatorName"
                placeholder="Your full name"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                      !creatorDob && "text-white/40"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {creatorDob ? format(creatorDob, "PPP") : "Select your date of birth"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={creatorDob || undefined}
                    onSelect={(date) => setCreatorDob(date || null)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    captionLayout="dropdown"
                    fromYear={1920}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Your Family Section */}
        <div className="p-6 md:p-8 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 mb-6">
          <h2 className="text-lg font-serif font-medium text-white mb-2">
            Your Family
          </h2>
          <p className="text-white/50 text-sm mb-6">
            Give your family a name. This helps organize all breadcrumbs shared within your family.
          </p>

          <div className="space-y-2">
            <Label htmlFor="familyName" className="text-white/80">
              Family Name
            </Label>
            <Input
              id="familyName"
              placeholder={`e.g., ${creatorName.trim() || "The Smith"}'s Family`}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
        </div>

        {/* Family Members Section */}
        <div className="p-6 md:p-8 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 mb-6">
          <h2 className="text-lg font-serif font-medium text-white mb-2">
            Family members
          </h2>
          <p className="text-white/50 text-sm mb-6">
            Add the people you want to leave Breadcrumbs for.
          </p>

          {/* Family Members List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/60" />
            </div>
          ) : familyMembers.length === 0 && !showAddForm ? (
            <p className="text-white/40 text-sm text-center py-6">
              You haven't added any family members yet.
            </p>
          ) : (
            <div className="space-y-3 mb-6">
              {familyMembers.map((member, index) => (
                <div
                  key={member.id || index}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <div>
                    <p className="text-white font-medium">{member.display_name}</p>
                    <p className="text-white/50 text-sm">
                      {member.relationship === "Other" 
                        ? member.custom_relationship || "Other" 
                        : member.relationship}
                      {member.date_of_birth && (
                        <span> • {format(member.date_of_birth, "MMM d, yyyy")}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditMember(index)}
                      className="p-2 text-white/50 hover:text-white transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveMember(index)}
                      className="p-2 text-white/50 hover:text-red-400 transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="p-4 rounded-lg bg-white/5 border border-white/20 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">
                  {editingIndex !== null ? "Edit family member" : "Add family member"}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-1 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Name</Label>
                  <Input
                    placeholder="Family member's name"
                    value={formData.display_name}
                    onChange={(e) =>
                      setFormData({ ...formData, display_name: e.target.value })
                    }
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Relationship</Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) =>
                      setFormData({ ...formData, relationship: value })
                    }
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/20 text-white max-h-60">
                      {RELATIONSHIP_OPTIONS.map((rel) => (
                        <SelectItem key={rel} value={rel}>
                          {rel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.relationship === "Other" && (
                  <div className="space-y-2">
                    <Label className="text-white/80">Specify relationship</Label>
                    <Input
                      placeholder="e.g., Family friend"
                      value={formData.custom_relationship}
                      onChange={(e) =>
                        setFormData({ ...formData, custom_relationship: e.target.value })
                      }
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-white/80">Date of Birth</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                          !formData.date_of_birth && "text-white/40"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.date_of_birth
                          ? format(formData.date_of_birth, "PPP")
                          : "Select date of birth"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background border" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.date_of_birth || undefined}
                        onSelect={(date) =>
                          setFormData({ ...formData, date_of_birth: date || null })
                        }
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                        captionLayout="dropdown"
                        fromYear={1920}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveMember}
                    className="bg-amber-100 text-amber-950 hover:bg-amber-200"
                  >
                    {editingIndex !== null ? "Update" : "Save family member"}
                  </Button>
                  <button
                    onClick={resetForm}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Button */}
          {!showAddForm && (
            <Button
              onClick={handleAddMember}
              className="w-full bg-amber-100 text-amber-950 hover:bg-amber-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add family member
            </Button>
          )}
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="w-full bg-amber-100 text-amber-950 hover:bg-amber-200"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save profile and continue"
          )}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default CreatorProfile;
