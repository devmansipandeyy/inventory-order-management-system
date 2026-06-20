import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aiApi, productsApi, stockApi } from "../api/endpoints";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductFormModal } from "../components/ProductFormModal";
import { StockAdjustModal } from "../components/StockAdjustModal";
import { formatCurrency, formatDateTime } from "../lib/format";

function buildForecastSeries(history: number[], forecast: number[]) {
  const data: { idx: number; history: number | null; forecast: number | null }[] = [];
  history.forEach((v, i) => {
    data.push({ idx: i + 1, history: v, forecast: null });
  });
  if (history.length > 0 && forecast.length > 0) {
    data[data.length - 1].forecast = history[history.length - 1];
  }
  forecast.forEach((v, i) => {
    data.push({ idx: history.length + i + 1, history: null, forecast: v });
  });
  return data;
}

export function ProductDetailPage() {
  const { id } = useParams();
  const productId = Number(id);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const product = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productsApi.get(productId),
    enabled: Number.isFinite(productId),
  });

  const movements = useQuery({
    queryKey: ["movements", productId],
    queryFn: () => stockApi.movements(productId, 50),
    enabled: Number.isFinite(productId),
  });

  const forecast = useQuery({
    queryKey: ["forecast", productId],
    queryFn: () => aiApi.forecast(productId),
    enabled: Number.isFinite(productId),
    retry: false,
  });

  if (product.isLoading) return <LoadingState />;
  if (product.isError)
    return <ErrorState message={getErrorMessage(product.error)} onRetry={() => product.refetch()} />;

  const p = product.data!;
  const low = p.on_hand <= p.reorder_point;
  const series =
    forecast.data && (forecast.data.history.length || forecast.data.forecast.length)
      ? buildForecastSeries(forecast.data.history, forecast.data.forecast)
      : [];

  return (
    <div>
      <div className="mb-2">
        <Link to="/products" className="text-sm text-indigo-600 hover:underline">
          ← Back to products
        </Link>
      </div>
      <PageHeader
        title={p.name}
        subtitle={p.sku}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
              + Adjust stock
            </Button>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 font-semibold text-slate-800">Details</h2>
          <dl className="space-y-2 text-sm">
            <Row label="On hand">
              <span className={low ? "font-semibold text-red-600" : "font-medium"}>{p.on_hand}</span>
              {low && <Badge color="red">below reorder</Badge>}
            </Row>
            <Row label="Reorder point">{p.reorder_point}</Row>
            <Row label="Reorder qty">{p.reorder_qty}</Row>
            <Row label="Unit price">{formatCurrency(p.unit_price)}</Row>
            <Row label="Cost price">{formatCurrency(p.cost_price)}</Row>
            <Row label="Category">{p.category_name || "—"}</Row>
            <Row label="Supplier">{p.supplier_name || "—"}</Row>
          </dl>
          {p.description && (
            <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {p.description}
            </p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Demand forecast</h2>
          </div>
          <div className="p-4">
            {forecast.isLoading ? (
              <LoadingState label="Generating forecast…" />
            ) : forecast.isError ? (
              <ErrorState message={getErrorMessage(forecast.error, "Forecast unavailable")} onRetry={() => forecast.refetch()} />
            ) : series.length === 0 ? (
              <EmptyState title="No forecast data" />
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="idx" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={45} />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine x={forecast.data!.history.length} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="history"
                        name="History"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        name="Forecast"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 rounded-lg bg-indigo-50 p-4">
                  <p className="text-sm font-medium text-indigo-900">
                    Recommended reorder qty: {forecast.data!.recommended_reorder_qty}
                  </p>
                  <p className="mt-1 text-sm text-indigo-800">{forecast.data!.explanation}</p>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">Stock movement history</h2>
        </div>
        {movements.isLoading ? (
          <LoadingState />
        ) : movements.isError ? (
          <ErrorState message={getErrorMessage(movements.error)} onRetry={() => movements.refetch()} />
        ) : (movements.data ?? []).length === 0 ? (
          <EmptyState title="No movements yet" />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-2 font-medium text-slate-400">Type</TableHead>
                <TableHead className="px-5 py-2 font-medium text-slate-400">Qty Δ</TableHead>
                <TableHead className="px-5 py-2 font-medium text-slate-400">Reason</TableHead>
                <TableHead className="px-5 py-2 font-medium text-slate-400">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {movements.data!.map((m) => (
                <TableRow key={m.id} className="hover:bg-transparent">
                  <TableCell className="px-5 py-2 capitalize">{m.type}</TableCell>
                  <TableCell className={`px-5 py-2 font-medium ${m.qty_delta < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {m.qty_delta > 0 ? "+" : ""}
                    {m.qty_delta}
                  </TableCell>
                  <TableCell className="px-5 py-2 text-slate-500">{m.reason || "—"}</TableCell>
                  <TableCell className="px-5 py-2 text-slate-400">{formatDateTime(m.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ProductFormModal open={editOpen} onClose={() => setEditOpen(false)} product={p} />
      <StockAdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} product={p} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="flex items-center gap-2 text-slate-800">{children}</dd>
    </div>
  );
}
