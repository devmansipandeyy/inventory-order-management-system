import { useQuery } from "@tanstack/react-query";
import { auditApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "../lib/format";
import type { AuditEntry } from "../api/types";

function renderDetail(detail: AuditEntry["detail"]): string {
  if (detail == null) return "—";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return "—";
  }
}

export function AuditPage() {
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => auditApi.list(200) });

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Recent system activity" />
      <Card>
        {audit.isLoading ? (
          <LoadingState />
        ) : audit.isError ? (
          <ErrorState message={getErrorMessage(audit.error)} onRetry={() => audit.refetch()} />
        ) : (audit.data ?? []).length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">Actor</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Action</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Entity</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Detail</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {audit.data!.map((a) => (
                <TableRow key={a.id} className="hover:bg-slate-50">
                  <TableCell className="px-5 py-3 text-slate-700">{a.actor}</TableCell>
                  <TableCell className="px-5 py-3">
                    <Badge color="indigo">{a.action}</Badge>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-slate-600">{a.entity || "—"}</TableCell>
                  <TableCell className="px-5 py-3 max-w-md truncate font-mono text-xs text-slate-500">{renderDetail(a.detail)}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-400">{formatDateTime(a.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
