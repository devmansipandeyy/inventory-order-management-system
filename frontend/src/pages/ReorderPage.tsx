import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi, poApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import {
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
import type { ReorderSuggestion } from "../api/types";

function forecastLabel(forecast: ReorderSuggestion["forecast"]): string {
  if (forecast == null) return "—";
  if (Array.isArray(forecast)) {
    if (forecast.length === 0) return "—";
    const sum = forecast.reduce((a, b) => a + b, 0);
    return `${Math.round(sum)} (next ${forecast.length})`;
  }
  return String(Math.round(forecast));
}

export function ReorderPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const suggestions = useQuery({
    queryKey: ["reorder-suggestions"],
    queryFn: aiApi.reorderSuggestions,
  });

  const createPo = useMutation({
    mutationFn: (s: ReorderSuggestion) => {
      if (s.supplier_id == null) {
        return Promise.reject(new Error("No supplier set for this product"));
      }
      return poApi.create({
        supplier_id: s.supplier_id,
        lines: [
          {
            product_id: s.product_id,
            qty: s.recommended_reorder_qty,
            unit_cost: 0,
          },
        ],
      });
    },
    onSuccess: () => {
      toast.success("Purchase order created");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const list = suggestions.data?.suggestions ?? [];

  return (
    <div>
      <PageHeader
        title="Forecasting & Reorder"
        subtitle="AI-recommended reorder suggestions"
        actions={
          <Button variant="secondary" onClick={() => suggestions.refetch()} loading={suggestions.isFetching}>
            Refresh
          </Button>
        }
      />
      <Card>
        {suggestions.isLoading ? (
          <LoadingState label="Computing suggestions…" />
        ) : suggestions.isError ? (
          <ErrorState message={getErrorMessage(suggestions.error)} onRetry={() => suggestions.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title="No reorder suggestions" description="Everything is sufficiently stocked." />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">SKU</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Product</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">On hand</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Reorder point</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Forecast demand</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Recommended qty</TableHead>
                <TableHead className="px-5 py-3 text-right font-medium text-slate-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {list.map((s) => (
                <TableRow key={s.product_id} className="hover:bg-slate-50">
                  <TableCell className="px-5 py-3 font-mono text-slate-600">{s.sku}</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-slate-800">{s.name}</TableCell>
                  <TableCell className="px-5 py-3 font-semibold text-red-600">{s.on_hand}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">{s.reorder_point}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-600">{forecastLabel(s.forecast)}</TableCell>
                  <TableCell className="px-5 py-3 font-medium text-indigo-700">{s.recommended_reorder_qty}</TableCell>
                  <TableCell className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      disabled={s.supplier_id == null}
                      onClick={() => createPo.mutate(s)}
                      loading={createPo.isPending && createPo.variables?.product_id === s.product_id}
                    >
                      Create PO
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        Tip: open a product&apos;s detail page to see its full demand forecast chart and explanation.
      </p>
    </div>
  );
}
