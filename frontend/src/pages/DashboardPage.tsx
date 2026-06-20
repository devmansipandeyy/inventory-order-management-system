import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardApi, reportsApi } from "../api/endpoints";
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
import { formatCurrency, formatDateTime, formatNumber } from "../lib/format";
import type { ValuationRow } from "../api/types";

function topByValue(rows: ValuationRow[]) {
  return [...rows]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((r) => ({ name: r.sku, value: r.value }));
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ?? "text-slate-900"}`}>
        {value}
      </p>
    </Card>
  );
}

export function DashboardPage() {
  const summary = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.summary,
  });
  const lowStock = useQuery({
    queryKey: ["reports", "low-stock"],
    queryFn: reportsApi.lowStock,
  });
  const valuation = useQuery({
    queryKey: ["reports", "valuation"],
    queryFn: reportsApi.valuation,
  });

  if (summary.isLoading) return <LoadingState />;
  if (summary.isError)
    return (
      <ErrorState
        message={getErrorMessage(summary.error)}
        onRetry={() => summary.refetch()}
      />
    );

  const data = summary.data!;
  const chartData = valuation.data ? topByValue(valuation.data.rows) : [];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your inventory" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total SKUs" value={formatNumber(data.total_skus)} />
        <Kpi label="Total Units" value={formatNumber(data.total_units)} />
        <Kpi label="Stock Value" value={formatCurrency(data.stock_value)} />
        <Kpi
          label="Low Stock"
          value={formatNumber(data.low_stock_count)}
          accent={data.low_stock_count > 0 ? "text-red-600" : "text-slate-900"}
        />
        <Kpi label="Pending POs" value={formatNumber(data.pending_pos)} />
        <Kpi label="Total Customers" value={formatNumber(data.total_customers)} />
        <Kpi label="Total Orders" value={formatNumber(data.total_orders)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Low-stock alerts</h2>
            <Link to="/reorder" className="text-sm text-indigo-600 hover:underline">
              View reorder
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {lowStock.isLoading ? (
              <LoadingState />
            ) : lowStock.isError ? (
              <ErrorState message={getErrorMessage(lowStock.error)} />
            ) : (lowStock.data ?? []).filter((l) => l.below_reorder).length === 0 ? (
              <EmptyState title="All stocked up" description="No products below reorder point." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {lowStock.data!
                  .filter((l) => l.below_reorder)
                  .map((l) => (
                    <li key={l.product_id} className="flex items-center justify-between px-5 py-3">
                      <Link to={`/products/${l.product_id}`} className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{l.name}</p>
                        <p className="text-xs text-slate-400">{l.sku}</p>
                      </Link>
                      <div className="text-right">
                        <Badge color="red">{l.on_hand} on hand</Badge>
                        <p className="mt-0.5 text-xs text-slate-400">reorder @ {l.reorder_point}</p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold text-slate-800">Top products by stock value</h2>
          </div>
          <div className="h-80 p-4">
            {valuation.isLoading ? (
              <LoadingState />
            ) : chartData.length === 0 ? (
              <EmptyState title="No valuation data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-20}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} width={70} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">Recent movements</h2>
        </div>
        {data.recent_movements.length === 0 ? (
          <EmptyState title="No recent movements" />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-2 font-medium text-slate-400">Type</TableHead>
                <TableHead className="px-5 py-2 font-medium text-slate-400">Product</TableHead>
                <TableHead className="px-5 py-2 font-medium text-slate-400">Qty Δ</TableHead>
                <TableHead className="px-5 py-2 font-medium text-slate-400">Reason</TableHead>
                <TableHead className="px-5 py-2 font-medium text-slate-400">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {data.recent_movements.map((m) => (
                <TableRow key={m.id} className="hover:bg-transparent">
                  <TableCell className="px-5 py-2 capitalize">{m.type}</TableCell>
                  <TableCell className="px-5 py-2">
                    <Link to={`/products/${m.product_id}`} className="text-indigo-600 hover:underline">
                      #{m.product_id}
                    </Link>
                  </TableCell>
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
    </div>
  );
}
