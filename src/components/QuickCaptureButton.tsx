import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QuickCaptureModal } from "./QuickCaptureModal";
import { motion, AnimatePresence } from "framer-motion";

interface QuickCaptureButtonProps {
  recipients: { id: string; display_name: string }[];
  creatorId: string;
  familyId?: string;
  onSuccess?: () => void;
}

export function QuickCaptureButton({ 
  recipients, 
  creatorId, 
  familyId,
  onSuccess 
}: QuickCaptureButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          size="lg"
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 bg-amber-100 text-amber-950 hover:bg-amber-200"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>

      {/* Modal */}
      <QuickCaptureModal
        open={isOpen}
        onOpenChange={setIsOpen}
        recipients={recipients}
        creatorId={creatorId}
        familyId={familyId}
        onSuccess={onSuccess}
      />
    </>
  );
}
