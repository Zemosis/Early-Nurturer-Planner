/**
 * ChatContext — Web-only chat provider for the AI curriculum assistant.
 *
 * Manages chat thread state, message history, and plan context.
 * Placed in web/ (not shared/) because chat UX differs on mobile.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  sendChatMessage,
  fetchChatThread,
  startNewChatThread,
  DEFAULT_USER_ID,
  type ChatMessage,
  type ChatActivityEdit,
  type ChatPlanContext,
  type ChatResponse,
} from "shared";

interface ChatError {
  code: string;
  retryable: boolean;
}

interface ChatContextValue {
  messages: ChatMessage[];
  threadId: string | null;
  loading: boolean;
  error: ChatError | null;
  sendMessage: (text: string) => Promise<void>;
  startNewThread: () => Promise<void>;
  retryLastMessage: () => Promise<void>;
  pendingEdit: ChatActivityEdit | null;
  clearPendingEdit: () => void;
  threadRotated: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
  planId: string | undefined;
  planContext: ChatPlanContext | null;
}

export function ChatProvider({ children, planId, planContext }: ChatProviderProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [pendingEdit, setPendingEdit] = useState<ChatActivityEdit | null>(null);
  const [threadRotated, setThreadRotated] = useState(false);
  const lastUserMessage = useRef<string | null>(null);
  const isFirstMessage = useRef(true);

  // Reset when plan changes
  useEffect(() => {
    setMessages([]);
    setThreadId(null);
    setError(null);
    setPendingEdit(null);
    setThreadRotated(false);
    isFirstMessage.current = true;
  }, [planId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      setError(null);
      setLoading(true);
      lastUserMessage.current = text;

      // Optimistically add user message
      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
        metadata: {},
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      try {
        const shouldSendContext = isFirstMessage.current && planContext;
        const response: ChatResponse = await sendChatMessage(DEFAULT_USER_ID, {
          threadId: threadId ?? undefined,
          message: text,
          planContext: shouldSendContext ? planContext : undefined,
        });

        isFirstMessage.current = false;
        setThreadId(response.thread_id);

        // Replace temp user message and add assistant response
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id);
          const newMessages = [
            ...withoutTemp,
            // Add the real user message back (server doesn't return it, keep our local one)
            { ...tempUserMsg, id: `user-${Date.now()}` },
            response.message,
          ];
          return newMessages;
        });

        // Handle activity edit
        if (response.activity_edit) {
          setPendingEdit(response.activity_edit as ChatActivityEdit);
        }

        // Handle thread rotation
        if (response.thread_rotated) {
          setThreadRotated(true);
          // Add a system notification
          setMessages((prev) => [
            ...prev,
            {
              id: `system-rotation-${Date.now()}`,
              role: "system",
              content:
                "New conversation started (context limit reached). Your plan context has been carried over.",
              metadata: {},
              created_at: new Date().toISOString(),
            },
          ]);
        }

        // Handle error in response
        if (response.error) {
          setError({
            code: response.error.code,
            retryable: response.error.retryable,
          });
        }
      } catch (err) {
        setError({ code: "NETWORK_ERROR", retryable: true });
        // Remove the optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      } finally {
        setLoading(false);
      }
    },
    [loading, threadId, planContext]
  );

  const startNewThread = useCallback(async () => {
    try {
      const result = await startNewChatThread(DEFAULT_USER_ID, planContext ?? undefined);
      setThreadId(result.thread_id);
      setMessages([]);
      setError(null);
      setPendingEdit(null);
      setThreadRotated(false);
      isFirstMessage.current = true;
    } catch {
      // Silently fail — user can retry
    }
  }, [planContext]);

  const retryLastMessage = useCallback(async () => {
    if (lastUserMessage.current) {
      await sendMessage(lastUserMessage.current);
    }
  }, [sendMessage]);

  const clearPendingEdit = useCallback(() => {
    setPendingEdit(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        threadId,
        loading,
        error,
        sendMessage,
        startNewThread,
        retryLastMessage,
        pendingEdit,
        clearPendingEdit,
        threadRotated,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}
