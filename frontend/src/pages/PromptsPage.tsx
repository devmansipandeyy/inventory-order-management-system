import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "../lib/format";
import type { PromptInput } from "../api/types";

export function PromptsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PromptInput>({ name: "", content: "", activate: false });

  const prompts = useQuery({ queryKey: ["prompts"], queryFn: aiApi.prompts });

  const create = useMutation({
    mutationFn: (input: PromptInput) => aiApi.createPrompt(input),
    onSuccess: () => {
      toast.success("Prompt version created");
      qc.invalidateQueries({ queryKey: ["prompts"] });
      setOpen(false);
      setForm({ name: "", content: "", activate: false });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const activate = useMutation({
    mutationFn: (id: number) => aiApi.activatePrompt(id),
    onSuccess: () => {
      toast.success("Prompt activated");
      qc.invalidateQueries({ queryKey: ["prompts"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Prompts"
        subtitle="Manage system prompt versions"
        actions={<Button onClick={() => setOpen(true)}>+ New version</Button>}
      />

      {prompts.isLoading ? (
        <LoadingState />
      ) : prompts.isError ? (
        <ErrorState message={getErrorMessage(prompts.error)} onRetry={() => prompts.refetch()} />
      ) : (prompts.data ?? []).length === 0 ? (
        <Card>
          <EmptyState title="No prompts" description="Create your first prompt version." />
        </Card>
      ) : (
        <div className="space-y-4">
          {prompts.data!.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{p.name}</h3>
                    {p.is_active && <Badge color="green">Active</Badge>}
                    <span className="text-xs text-slate-400">#{p.id}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateTime(p.created_at)}
                  </p>
                </div>
                {!p.is_active && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => activate.mutate(p.id)}
                    loading={activate.isPending && activate.variables === p.id}
                  >
                    Activate
                  </Button>
                )}
              </div>
              <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700 scrollbar-thin">
                {p.content}
              </pre>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title="New prompt version"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => create.mutate(form)}
              loading={create.isPending}
              disabled={!form.name.trim() || !form.content.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Content" required>
            <Textarea
              className="font-mono"
              rows={10}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={form.activate ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, activate: v === true }))}
            />
            Activate this version immediately
          </label>
        </div>
      </Modal>
    </div>
  );
}
