import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import type { ChatConfirmResponse, MessageId } from "../api/types";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  messageId?: MessageId;
  pending?: ChatConfirmResponse;
  feedback?: 1 | -1;
  resolved?: boolean;
}

const SESSION_KEY = "ai_session_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadSessionId(): string {
  if (typeof localStorage === "undefined") return uuid();
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = uuid();
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

export function useChat() {
  const sessionId = useRef<string>(loadSessionId());
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    aiApi
      .history(sessionId.current)
      .then((rows) => {
        if (!active) return;
        setTurns(
          rows.map((row) => ({
            id: uuid(),
            role: row.role,
            content: row.content,
            messageId: row.role === "assistant" ? row.id : undefined,
            feedback: row.rating === 1 ? 1 : row.rating === -1 ? -1 : undefined,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const send = useCallback(
    async (message: string) => {
      if (!message.trim() || sending) return;
      setError(null);
      const userTurn: ChatTurn = { id: uuid(), role: "user", content: message };
      setTurns((prev) => [...prev, userTurn]);
      setSending(true);
      try {
        const res = await aiApi.chat(sessionId.current, message);
        if (res.type === "message") {
          setTurns((prev) => [
            ...prev,
            { id: uuid(), role: "assistant", content: res.content, messageId: res.message_id },
          ]);
        } else {
          setTurns((prev) => [
            ...prev,
            { id: uuid(), role: "assistant", content: res.summary, pending: res },
          ]);
        }
      } catch (e) {
        setError(getErrorMessage(e, "Failed to reach the assistant"));
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  const resolveAction = useCallback(
    async (turnId: string, pendingId: string, decision: "confirm" | "reject") => {
      setSending(true);
      setError(null);
      try {
        const res = await aiApi.action(pendingId, decision);
        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, resolved: true } : t)));
        setTurns((prev) => [...prev, { id: uuid(), role: "assistant", content: res.content }]);
      } catch (e) {
        setError(getErrorMessage(e, "Failed to submit decision"));
      } finally {
        setSending(false);
      }
    },
    [],
  );

  const rate = useCallback(async (turnId: string, messageId: MessageId, rating: 1 | -1) => {
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, feedback: rating } : t)));
    try {
      await aiApi.feedback(messageId, rating);
    } catch {
      setTurns((prev) => prev);
    }
  }, []);

  const clear = useCallback(async () => {
    const id = sessionId.current;
    setTurns([]);
    setError(null);
    try {
      await aiApi.clearChat(id);
    } catch {
      setError(null);
    }
  }, []);

  return {
    turns,
    sending,
    loadingHistory,
    error,
    send,
    resolveAction,
    rate,
    clear,
    sessionId: sessionId.current,
  };
}
