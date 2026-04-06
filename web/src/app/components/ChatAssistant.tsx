import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Send,
  Plus,
  RotateCcw,
  Check,
  Undo2,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useChat } from "../contexts/ChatContext";
import {
  applyActivityEdit,
  DEFAULT_USER_ID,
  type ChatActivityEdit,
} from "shared";
import { usePlanner } from "shared";

interface ChatAssistantProps {
  isOpen?: boolean;
  onToggle?: () => void;
  planId?: string;
}

const SUGGESTIONS = [
  "Make it more sensory",
  "Add fine motor activities",
  "Simplify for 1-year-olds",
  "Suggest outdoor alternatives",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-muted-foreground/40 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-2">Thinking...</span>
    </div>
  );
}

function ActivityEditCard({
  edit,
  planId,
  onApplied,
  onDismiss,
}: {
  edit: ChatActivityEdit;
  planId: string | undefined;
  onApplied: () => void;
  onDismiss: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [undoData, setUndoData] = useState<Record<string, unknown> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { currentPlan, setCurrentPlan } = usePlanner();

  const changedFields = Object.entries(edit).filter(
    ([key, val]) => key !== "activity_id" && val != null
  );

  const handleApply = async () => {
    if (!planId) return;
    setApplying(true);
    try {
      const result = await applyActivityEdit(
        DEFAULT_USER_ID,
        planId,
        edit.activity_id,
        edit
      );

      // Save current activity state for undo
      if (currentPlan) {
        const currentActivity = currentPlan.activities.find(
          (a) => a.id === edit.activity_id
        );
        if (currentActivity) {
          setUndoData({ ...currentActivity });
        }

        // Update local plan state
        setCurrentPlan({
          ...currentPlan,
          activities: currentPlan.activities.map((a) => {
            if (a.id === edit.activity_id) {
              const updated = result.activity;
              return {
                ...a,
                title: (updated.title as string) ?? a.title,
                domain: (updated.domain as string) ?? a.domain,
                duration: (updated.duration as number) ?? a.duration,
                description: (updated.description as string) ?? a.description,
                materials: (updated.materials as string[]) ?? a.materials,
                themeConnection: (updated.theme_connection as string) ?? a.themeConnection,
                safetyNotes: (updated.safety_notes as string) ?? a.safetyNotes,
                reflectionPrompts: (updated.reflection_prompts as string[]) ?? a.reflectionPrompts,
                adaptations: updated.adaptations
                  ? (updated.adaptations as any[]).map((ad: any) => ({
                      age: ad.age_group,
                      content: ad.description,
                    }))
                  : a.adaptations,
              };
            }
            return a;
          }),
        });
      }

      setApplied(true);
      toast.success("Activity updated successfully!");

      // Auto-dismiss undo after 10s
      undoTimerRef.current = setTimeout(() => {
        setUndoData(null);
        onApplied();
      }, 10000);
    } catch (err) {
      toast.error("Failed to apply edit. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const handleUndo = async () => {
    if (!planId || !undoData || !currentPlan) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    try {
      // Re-apply original data
      await applyActivityEdit(DEFAULT_USER_ID, planId, edit.activity_id, {
        activity_id: edit.activity_id,
        ...(undoData as any),
      });

      setCurrentPlan({
        ...currentPlan,
        activities: currentPlan.activities.map((a) =>
          a.id === edit.activity_id ? ({ ...a, ...(undoData as any) }) : a
        ),
      });

      toast.success("Change reverted.");
      setUndoData(null);
      setApplied(false);
      onDismiss();
    } catch {
      toast.error("Failed to undo. Please try again.");
    }
  };

  return (
    <div className="mx-2 my-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-xs font-medium text-primary">
          Activity Modification
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        <span className="font-medium">{edit.activity_id}</span>
      </p>
      <div className="space-y-1 mb-3">
        {changedFields.map(([key, val]) => (
          <div key={key} className="text-xs">
            <span className="font-medium text-foreground">
              {key.replace(/_/g, " ")}:
            </span>{" "}
            <span className="text-muted-foreground">
              {Array.isArray(val)
                ? val.length + " items"
                : typeof val === "string"
                  ? val.length > 60
                    ? val.slice(0, 60) + "…"
                    : val
                  : String(val)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {!applied ? (
          <>
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {applying ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-3 h-3 border border-primary-foreground/30 border-t-primary-foreground rounded-full"
                />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Apply to Plan
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Dismiss
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Applied
            </span>
            {undoData && (
              <button
                onClick={handleUndo}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
              >
                <Undo2 className="w-3 h-3" /> Undo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  planId,
  onEditApplied,
  onEditDismissed,
}: {
  message: {
    id: string;
    role: string;
    content: string;
    metadata: Record<string, unknown>;
  };
  planId: string | undefined;
  onEditApplied: () => void;
  onEditDismissed: () => void;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const hasError = message.metadata?.error === true;
  const activityEdit = message.metadata?.activity_edit as
    | ChatActivityEdit
    | undefined;

  if (isSystem) {
    const isRichContent = message.content.includes("`") || message.content.includes("**");
    return (
      <div className={`flex justify-center my-3 ${isRichContent ? "px-2" : ""}`}>
        <div className={isRichContent
          ? "px-4 py-3 bg-muted/20 rounded-xl max-w-[85%]"
          : "px-3 py-1.5 bg-muted/30 rounded-full"
        }>
          {isRichContent ? (
            <div className="text-xs text-muted-foreground prose prose-sm max-w-none prose-p:my-0.5 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              {message.content}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
            : "bg-muted/30 text-foreground rounded-2xl rounded-bl-md px-4 py-2.5"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {hasError && (
          <div className="flex items-center gap-1 mt-1.5">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span className="text-xs text-red-400">
              Error — try again
            </span>
          </div>
        )}
        {activityEdit && (
          <ActivityEditCard
            edit={activityEdit}
            planId={planId}
            onApplied={onEditApplied}
            onDismiss={onEditDismissed}
          />
        )}
      </div>
    </div>
  );
}

export function ChatAssistant({
  isOpen = false,
  onToggle = () => {},
  planId,
}: ChatAssistantProps) {
  const {
    messages,
    loading,
    error,
    sendMessage,
    startNewThread,
    clearHistory,
    retryLastMessage,
    clearPendingEdit,
  } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Local-only system messages (e.g. /help output)
  const [localSystemMessages, setLocalSystemMessages] = useState<typeof messages>([]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const trimmed = input.trim();
    setInput("");

    if (trimmed.startsWith("/")) {
      const lower = trimmed.toLowerCase();

      if (lower === "/clear") {
        clearHistory();
        setLocalSystemMessages([]);
        toast.success("Chat history cleared.");
        return;
      }

      if (lower === "/help") {
        setLocalSystemMessages((prev) => [
          ...prev,
          {
            id: `system-help-${Date.now()}`,
            role: "system" as const,
            content:
              "**Available commands:**\n" +
              "`/clear` — Clear this conversation's chat history\n" +
              "`/help` — Show this help message",
            metadata: {},
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      // Unknown command — send as regular message
    }

    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  const allMessages = [...messages, ...localSystemMessages];
  const isEmpty = allMessages.length === 0;

  // Shared chat content (used by both mobile and desktop)
  const chatContent = (
    <>
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shrink-0">
        <h3 className="font-medium">Curriculum Assistant</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={startNewThread}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <>
            <div className="bg-muted/20 rounded-2xl p-4 mb-4">
              <p className="text-sm text-foreground">
                Hello! I can help you modify activities, suggest alternatives,
                simplify content, or answer curriculum questions. How can I
                assist you today?
              </p>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-muted-foreground mb-2">
                Quick suggestions:
              </p>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  className="w-full text-left px-4 py-2.5 bg-accent/20 hover:bg-accent/30 rounded-xl text-sm transition-colors"
                  onClick={() => handleSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {allMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                planId={planId}
                onEditApplied={clearPendingEdit}
                onEditDismissed={clearPendingEdit}
              />
            ))}
            {loading && <TypingIndicator />}
            {error?.retryable && !loading && (
              <div className="flex justify-center mb-3">
                <button
                  onClick={retryLastMessage}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your request..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
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
            {chatContent}
          </motion.div>

          {/* Desktop: Right Side Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="hidden md:flex fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-40 flex-col"
          >
            {chatContent}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
