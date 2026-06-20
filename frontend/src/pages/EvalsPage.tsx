import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/ui";
import { useToast } from "../components/Toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "../lib/format";

function Check({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="font-semibold text-emerald-600">✓</span>
  ) : (
    <span className="font-semibold text-red-600">✗</span>
  );
}

function isDone(status: string): boolean {
  const s = status.toLowerCase();
  return s === "done" || s === "completed" || s === "complete" || s === "finished";
}

export function EvalsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<number | null>(null);

  const history = useQuery({ queryKey: ["evals"], queryFn: aiApi.evals });

  const detail = useQuery({
    queryKey: ["eval", activeRunId],
    queryFn: () => aiApi.evalDetail(activeRunId!),
    enabled: activeRunId != null,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && isDone(data.status)) return false;
      return 1500;
    },
  });

  const detailStatus = detail.data?.status;
  useEffect(() => {
    if (detailStatus && isDone(detailStatus)) {
      qc.invalidateQueries({ queryKey: ["evals"] });
    }
  }, [detailStatus, qc]);

  const runEval = useMutation({
    mutationFn: aiApi.runEval,
    onSuccess: (res) => {
      toast.success(`Eval started (${res.total} cases)`);
      setActiveRunId(res.run_id);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const running = Boolean(detail.data && !isDone(detail.data.status));

  return (
    <div>
      <PageHeader
        title="Evals"
        subtitle="Run and review LLM evaluation suites"
        actions={
          <Button onClick={() => runEval.mutate()} loading={runEval.isPending || running}>
            Run eval
          </Button>
        }
      />

      {activeRunId != null && (
        <Card className="mb-6">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Current run</h2>
            <Badge color={running ? "amber" : "green"}>
              {detail.data?.status ?? "starting"}
            </Badge>
          </div>
          {detail.isLoading && !detail.data ? (
            <LoadingState label="Starting run…" />
          ) : detail.isError ? (
            <ErrorState message={getErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
          ) : detail.data ? (
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-8">
                <div>
                  <p className="text-sm text-slate-500">Pass rate</p>
                  <p className="text-4xl font-bold text-indigo-600">
                    {Math.round((detail.data.pass_rate ?? 0) * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Passed</p>
                  <p className="text-2xl font-semibold text-slate-800">
                    {detail.data.passed} / {detail.data.total}
                  </p>
                </div>
                {running && <LoadingState label="Running cases…" />}
              </div>

              {detail.data.results?.length > 0 && (
                <div className="mt-5">
                  <Table className="min-w-full text-sm">
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                        <TableHead className="px-3 py-2 font-medium text-slate-400">Case</TableHead>
                        <TableHead className="px-3 py-2 font-medium text-slate-400">Question</TableHead>
                        <TableHead className="px-3 py-2 text-center font-medium text-slate-400">Tool</TableHead>
                        <TableHead className="px-3 py-2 text-center font-medium text-slate-400">Answer</TableHead>
                        <TableHead className="px-3 py-2 text-center font-medium text-slate-400">Passed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-50">
                      {detail.data.results.map((r) => (
                        <TableRow key={r.case_id}>
                          <TableCell className="px-3 py-2 font-mono text-slate-600">{r.case_id}</TableCell>
                          <TableCell className="px-3 py-2 max-w-md truncate text-slate-700">{r.question}</TableCell>
                          <TableCell className="px-3 py-2 text-center"><Check ok={r.tool_ok} /></TableCell>
                          <TableCell className="px-3 py-2 text-center"><Check ok={r.answer_ok} /></TableCell>
                          <TableCell className="px-3 py-2 text-center"><Check ok={r.passed} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      )}

      <Card>
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">Past runs</h2>
        </div>
        {history.isLoading ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState message={getErrorMessage(history.error)} onRetry={() => history.refetch()} />
        ) : (history.data ?? []).length === 0 ? (
          <EmptyState title="No eval runs yet" description="Run your first eval to see results." />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">Run</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Status</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Pass rate</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Passed</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Created</TableHead>
                <TableHead className="px-5 py-3 text-right font-medium text-slate-400"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {history.data!.map((r) => (
                <TableRow key={r.id} className="hover:bg-slate-50">
                  <TableCell className="px-5 py-3 font-mono text-slate-600">{r.id}</TableCell>
                  <TableCell className="px-5 py-3">
                    <Badge color={isDone(r.status) ? "green" : "amber"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="px-5 py-3 font-medium text-slate-800">
                    {Math.round((r.pass_rate ?? 0) * 100)}%
                  </TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">{r.passed} / {r.total}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-400">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setActiveRunId(r.id)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
