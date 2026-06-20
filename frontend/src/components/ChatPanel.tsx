import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { aiApi } from "../api/endpoints";
import { useChat, type ChatTurn } from "../hooks/useChat";
import { Button, Spinner } from "./ui";
import { Input } from "@/components/ui/input";
import { classNames } from "../lib/format";

function FeedbackButtons({
  turn,
  onRate,
}: {
  turn: ChatTurn;
  onRate: (rating: 1 | -1) => void;
}) {
  if (!turn.messageId) return null;
  return (
    <div className="mt-1 flex gap-1">
      <button
        aria-label="Helpful"
        onClick={() => onRate(1)}
        className={classNames(
          "rounded px-1.5 py-0.5 text-xs hover:bg-slate-200",
          turn.feedback === 1 && "bg-emerald-100 text-emerald-700",
        )}
      >
        👍
      </button>
      <button
        aria-label="Not helpful"
        onClick={() => onRate(-1)}
        className={classNames(
          "rounded px-1.5 py-0.5 text-xs hover:bg-slate-200",
          turn.feedback === -1 && "bg-red-100 text-red-700",
        )}
      >
        👎
      </button>
    </div>
  );
}

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const { turns, sending, error, send, resolveAction, rate, clear } = useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const statusQuery = useQuery({
    queryKey: ["ai", "status"],
    queryFn: aiApi.status,
    staleTime: 60_000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, sending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = draft.trim();
    if (!msg) return;
    setDraft("");
    void send(msg);
  };

  const disabled = statusQuery.data?.enabled === false;

  return (
    <div className="flex h-full flex-col">
      {statusQuery.data?.enabled === false && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          AI is currently disabled on the server. Chat is unavailable.
        </div>
      )}
      {statusQuery.data?.enabled && statusQuery.data.model && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
          <span>Model: {statusQuery.data.model}</span>
          <button
            onClick={() => void clear()}
            disabled={turns.length === 0}
            className="text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
          >
            Clear chat
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin"
      >
        {turns.length === 0 && (
          <div className="mt-8 text-center text-sm text-slate-400">
            <p className="font-medium text-slate-500">Ask the inventory assistant</p>
            <p className="mt-1">
              e.g. &ldquo;Which products are below reorder point?&rdquo; or
              &ldquo;Create a purchase order for SKU-001&rdquo;
            </p>
          </div>
        )}
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={classNames(
              "flex",
              turn.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div className={classNames("max-w-[85%]", turn.role === "user" && "text-right")}>
              <div
                className={classNames(
                  "inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                  turn.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-800",
                )}
              >
                {turn.content}
              </div>

              {turn.pending && !turn.resolved && (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm">
                  <p className="font-medium text-amber-900">Confirmation required</p>
                  <p className="mt-1 text-amber-800">{turn.pending.summary}</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Tool: <code>{turn.pending.tool}</code>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        resolveAction(turn.id, turn.pending!.pending_id, "confirm")
                      }
                      loading={sending}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        resolveAction(turn.id, turn.pending!.pending_id, "reject")
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {turn.role === "assistant" && (
                <FeedbackButtons
                  turn={turn}
                  onRate={(r) => turn.messageId && rate(turn.id, turn.messageId, r)}
                />
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner className="h-4 w-4" /> Thinking…
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-slate-200 p-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "AI disabled" : "Type a message…"}
          className="flex-1 disabled:bg-slate-100 disabled:opacity-100"
        />
        <Button type="submit" disabled={disabled || !draft.trim()} size={compact ? "sm" : "md"}>
          Send
        </Button>
      </form>
    </div>
  );
}
