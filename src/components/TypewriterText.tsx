import { motion } from "framer-motion";

interface TypewriterTextProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
  showCursor?: boolean;
  hideCursorOnComplete?: boolean;
}

const TypewriterText = ({ 
  text, 
  className = "", 
  delay = 0,
  speed = 0.05,
  showCursor = true,
  hideCursorOnComplete = true,
}: TypewriterTextProps) => {
  const letters = text.split("");
  const totalDuration = delay + letters.length * speed;

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delay,
        staggerChildren: speed,
      },
    },
  };

  const child = {
    hidden: { opacity: 0, y: 2 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0,
      },
    },
  };

  const cursorVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delay,
      },
    },
    complete: hideCursorOnComplete ? {
      opacity: 0,
      transition: {
        delay: totalDuration,
        duration: 0.2,
      },
    } : {},
  };

  return (
    <span className={`inline-flex ${className}`}>
      <motion.span
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {letters.map((letter, index) => (
          <motion.span key={index} variants={child}>
            {letter === " " ? "\u00A0" : letter}
          </motion.span>
        ))}
      </motion.span>
      {showCursor && (
        <motion.span
          className="ml-[2px] inline-block w-[2px] bg-current"
          initial="hidden"
          animate={["visible", "complete"]}
          variants={cursorVariants}
          style={{
            animation: "blink 1s step-end infinite",
          }}
        />
      )}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
};

export default TypewriterText;
