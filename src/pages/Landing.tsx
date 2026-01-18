import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Landing = () => {
  return (
    <div className="min-h-screen w-full bg-background">
      {/* Content */}
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        {/* Main heading */}
        <h1 className="mb-6 text-center text-5xl font-light tracking-tight text-foreground md:text-6xl lg:text-7xl">
          Breadcrumbs
        </h1>

        {/* Tagline */}
        <p className="mb-12 max-w-lg text-center text-lg font-light text-muted-foreground md:text-xl">
          Preserve your wisdom. Let it keep speaking.
        </p>

        {/* Primary button */}
        <Link to="/get-started">
          <Button 
            variant="outline" 
            size="lg"
            className="border-foreground px-10 py-6 text-base font-normal tracking-wide text-foreground hover:bg-foreground hover:text-background"
          >
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Landing;