import { ReactNode, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, User, Globe, ChevronRight, Users, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState<{ id: string; display_name: string }[]>([]);

  useEffect(() => {
    if (profile?.role === "creator") {
      supabase
        .from("recipients")
        .select("id, display_name")
        .eq("creator_id", profile.id)
        .then(({ data }) => {
          if (data) setRecipients(data);
        });
    }
  }, [profile]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full bg-background" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex h-14 items-center justify-between">
            {/* Logo / Home */}
            <Link 
              to={profile?.role === "creator" ? "/creator" : "/recipient"} 
              className="text-sm font-light uppercase tracking-widest text-foreground hover:text-muted-foreground transition-colors"
            >
              Breadcrumbs
            </Link>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {profile?.role === "creator" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">Recipients</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-background border-border z-50">
                    {recipients.map(r => (
                      <DropdownMenuItem
                        key={r.id}
                        onClick={() => navigate(`/creator/recipients`)}
                        className="gap-2 cursor-pointer text-xs"
                      >
                        <User className="w-4 h-4" />
                        {r.display_name}
                      </DropdownMenuItem>
                    ))}
                    {recipients.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => navigate("/creator/recipients")}
                      className="gap-2 cursor-pointer text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      Manage Recipients
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* User Menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="hidden sm:inline text-sm">Profile</span>
                  </Button>
                </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <SheetHeader className="p-6 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <SheetTitle className="text-base font-semibold">
                        {profile?.name || "User"}
                      </SheetTitle>
                      <p className="text-sm text-muted-foreground">
                        {profile?.email}
                      </p>
                    </div>
                  </div>
                </SheetHeader>
                
                <div className="py-2">
                  <button
                    onClick={() => navigate(profile?.role === "creator" ? "/creator/profile" : "/settings")}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Profile</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <button
                    onClick={() => navigate("/settings")}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Settings</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Breadcrumbs Language</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <div className="my-2 mx-6 border-t border-border" />
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-destructive"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Logout</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-4xl mx-auto px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
