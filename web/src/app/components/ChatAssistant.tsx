import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send } from "lucide-react";

interface ChatAssistantProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatAssistant({ isOpen, onToggle }: ChatAssistantProps) {
  const [message, setMessage] = useState("");

  const suggestions = [
    "Make it more sensory",
    "Add fine motor",
    "Simplify for 1-year-olds",
    "Make it more theme-based",
  ];

  return (
    <>
      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile: Full Screen Slide Up */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-white z-40 flex flex-col md:hidden"
            >
              <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
                <h3 className="font-medium">Curriculum Assistant</h3>
                <button onClick={onToggle} className="p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-muted/20 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-foreground">
                    Hello! I can help you modify activities, regenerate specific days, simplify
                    content, or add extensions. How can I assist you today?
                  </p>
                </div>

                {/* Quick Suggestions */}
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Quick suggestions:</p>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left px-4 py-2.5 bg-accent/20 hover:bg-accent/30 rounded-xl text-sm transition-colors"
                      onClick={() => setMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your request..."
                    className="flex-1 px-4 py-3 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button className="p-3 bg-primary text-primary-foreground rounded-xl">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Desktop: Right Side Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="hidden md:flex fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-40 flex-col"
            >
              <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
                <h3 className="font-medium">Curriculum Assistant</h3>
                <button onClick={onToggle} className="p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-muted/20 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-foreground">
                    Hello! I can help you modify activities, regenerate specific days, simplify
                    content, or add extensions. How can I assist you today?
                  </p>
                </div>

                {/* Quick Suggestions */}
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Quick suggestions:</p>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left px-4 py-2.5 bg-accent/20 hover:bg-accent/30 rounded-xl text-sm transition-colors"
                      onClick={() => setMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your request..."
                    className="flex-1 px-4 py-3 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button className="p-3 bg-primary text-primary-foreground rounded-xl">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}