import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, User } from "lucide-react";
import landingBg from "@/assets/landing-bg.jpg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-no-repeat"
        style={{ 
          backgroundImage: `url(${landingBg})`,
          backgroundPosition: 'center bottom'
        }}
      />
      
      {/* Dark Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/85 via-black/70 to-black/50" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-4xl mx-auto px-6">
            <div className="flex h-14 items-center justify-between">
              {/* Logo */}
              <Link 
                to={profile?.role === "creator" ? "/creator" : "/recipient"} 
                className="text-sm font-medium uppercase tracking-widest text-white/80 hover:text-white transition-colors"
              >
                Breadcrumbs
              </Link>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="hidden sm:inline text-sm">
                      {profile?.name || "Account"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-black/90 border-white/20 text-white">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{profile?.name}</p>
                    <p className="text-xs text-white/60 capitalize">{profile?.role}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-white/20" />
                  <DropdownMenuItem 
                    onClick={() => navigate("/settings")}
                    className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20" />
                  <DropdownMenuItem 
                    onClick={handleSignOut} 
                    className="text-red-400 hover:text-red-300 hover:bg-white/10 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 py-8">
          <div className="max-w-4xl mx-auto px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
