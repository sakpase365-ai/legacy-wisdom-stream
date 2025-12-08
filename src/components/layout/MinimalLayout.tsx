import { ReactNode } from "react";
import landingBg from "@/assets/landing-bg.jpg";

interface MinimalLayoutProps {
  children: ReactNode;
  /** If true, centers content vertically (for Landing, Auth pages) */
  centered?: boolean;
  /** Max width of content container */
  maxWidth?: "sm" | "md" | "lg";
}

export function MinimalLayout({ 
  children, 
  centered = false,
  maxWidth = "md" 
}: MinimalLayoutProps) {
  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
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
      
      {/* Dark Overlay - darker at top, fading toward middle */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/85 via-black/70 to-black/50" />
      
      {/* Content */}
      <div 
        className={`relative z-10 min-h-screen ${
          centered 
            ? "flex flex-col items-center justify-center" 
            : "flex flex-col"
        }`}
      >
        <div className={`w-full ${maxWidthClasses[maxWidth]} mx-auto px-6 py-12`}>
          {children}
        </div>
      </div>
    </div>
  );
}
