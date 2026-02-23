import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PenLine, Eye, ArrowLeft } from "lucide-react";
import { MinimalLayout } from "@/components/layout/MinimalLayout";
import TypewriterText from "@/components/TypewriterText";

const GetStarted = () => {
  return (
    <MinimalLayout centered maxWidth="md">
      {/* Back Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </motion.div>

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight text-foreground mb-3">
          <TypewriterText 
            text="How would you like to use Breadcrumbs?" 
            speed={0.04} 
            showCursor={false}
          />
        </h1>
        <motion.p 
          className="text-muted-foreground mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          Choose your role to get started.
        </motion.p>

        <motion.div 
          className="grid gap-4 max-w-lg mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.5 }}
        >
          <RoleCard
            to="/auth?role=creator"
            icon={<PenLine className="w-6 h-6" />}
            title="I am a Creator"
            description="I want to leave breadcrumbs for my loved ones."
          />
          <RoleCard
            to="/auth?role=recipient"
            icon={<Eye className="w-6 h-6" />}
            title="I am a Recipient"
            description="Someone has left breadcrumbs for me to discover."
          />
        </motion.div>
      </div>
    </MinimalLayout>
  );
};

const RoleCard = ({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Link to={to}>
    <div className="p-6 text-left rounded-lg bg-card border border-border hover:border-foreground/30 transition-all cursor-pointer group">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted text-foreground flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-light text-foreground mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  </Link>
);

export default GetStarted;
