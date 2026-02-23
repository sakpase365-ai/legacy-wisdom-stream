import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import TypewriterText from "@/components/TypewriterText";

const Landing = () => {
  return (
    <div className="min-h-screen w-full bg-background">
      {/* Content */}
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* Main heading */}
        <h1 className="mb-4 text-center text-3xl font-light tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl sm:mb-6">
          <TypewriterText text="Breadcrumbs" speed={0.1} showCursor={false} />
          <span className="inline-flex">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0.4, 1] }}
                transition={{ 
                  delay: 1.1 + i * 0.3, 
                  duration: 2,
                  times: [0, 0.1, 0.5, 0.75, 1],
                  repeat: Infinity,
                  repeatDelay: 0.5
                }}
              >
                .
              </motion.span>
            ))}
          </span>
        </h1>

        {/* Tagline */}
        <p className="mb-8 max-w-lg text-center text-base font-light text-muted-foreground sm:text-lg md:text-xl sm:mb-12">
          <TypewriterText 
            text="Preserve your wisdom. For generations to come." 
            delay={0.8} 
            speed={0.03} 
          />
        </p>

        {/* Primary button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 0.4 }}
        >
          <Link to="/get-started">
            <Button 
              variant="outline" 
              size="lg"
              className="border-foreground px-8 py-5 text-sm font-normal tracking-wide text-foreground hover:bg-foreground hover:text-background sm:px-10 sm:py-6 sm:text-base"
            >
              Get Started
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;