import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersApi, ordersApi, productsApi } from "../api/endpoints";
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
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "../lib/format";
import type { Customer, Order, OrderInput, Product } from "../api/types";

const PLACEHOLDER = "__none__";

interface DraftLine {
  product_id: number | "";
  qty: number;
}

function statusColor(status: string): "green" | "amber" | "red" | "blue" | "slate" {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "red";
  if (s.includes("plac")) return "green";
  return "slate";
}

export function OrdersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);

  const list = useQuery({ queryKey: ["orders"], queryFn: ordersApi.list });
  const customers = useQuery({ queryKey: ["customers"], queryFn: customersApi.list });

  const customerName = (id: number) =>
    customers.data?.find((c) => c.id === id)?.full_name ?? `Customer #${id}`;

  const cancel = useMutation({
    mutationFn: (id: number) => ordersApi.remove(id),
    onSuccess: () => {
      toast.success("Order cancelled — stock restored");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setCancelling(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Customer sales orders"
        actions={<Button onClick={() => setCreateOpen(true)}>+ Create order</Button>}
      />
      <Card>
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="No orders" description="Create a sales order for a customer." />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">Order #</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Customer</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Total</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Status</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Created</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Lines</TableHead>
                <TableHead className="px-5 py-3 text-right font-medium text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {list.data!.map((o) => {
                const cancelled = o.status.toLowerCase().includes("cancel");
                return (
                  <TableRow key={o.id} className="hover:bg-slate-50">
                    <TableCell className="px-5 py-3 font-mono text-slate-600">#{o.id}</TableCell>
                    <TableCell className="px-5 py-3 text-slate-800">{customerName(o.customer_id)}</TableCell>
                    <TableCell className="px-5 py-3 text-slate-700">{formatCurrency(o.total_amount)}</TableCell>
                    <TableCell className="px-5 py-3">
                      <Badge color={statusColor(o.status)}>{o.status}</Badge>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-slate-400">{formatDateTime(o.created_at)}</TableCell>
                    <TableCell className="px-5 py-3 text-slate-500">{o.lines?.length ?? 0}</TableCell>
                    <TableCell className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(o)}>
                        View
                      </Button>
                      {!cancelled && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelling(o)}>
                          <span className="text-red-600">Cancel</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreateOrderModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <ViewOrderModal
        order={viewing}
        onClose={() => setViewing(null)}
        customerName={customerName}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
        loading={cancel.isPending}
        title="Cancel order"
        confirmLabel="Cancel order"
        message={`Cancel order #${cancelling?.id}? Stock will be restored.`}
      />
    </div>
  );
}

function ViewOrderModal({
  order,
  onClose,
  customerName,
}: {
  order: Order | null;
  onClose: () => void;
  customerName: (id: number) => string;
}) {
  const products = useQuery({
    queryKey: ["products", "all-for-order"],
    queryFn: () => productsApi.list({ page: 1, page_size: 500, sort: "name", order: "asc" }),
    enabled: Boolean(order),
  });

  const productName = (id: number) => {
    const p = products.data?.items.find((x) => x.id === id);
    return p ? `${p.sku} — ${p.name}` : `Product #${id}`;
  };

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      wide
      title={order ? `Order #${order.id}` : "Order"}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {order && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div>
              <span className="text-slate-400">Customer: </span>
              <span className="font-medium text-slate-800">{customerName(order.customer_id)}</span>
            </div>
            <div>
              <span className="text-slate-400">Status: </span>
              <Badge color={statusColor(order.status)}>{order.status}</Badge>
            </div>
            <div>
              <span className="text-slate-400">Created: </span>
              <span className="text-slate-700">{formatDateTime(order.created_at)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100">
            <Table className="min-w-full text-sm">
              <TableHeader>
                <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                  <TableHead className="px-4 py-2 font-medium text-slate-400">Product</TableHead>
                  <TableHead className="px-4 py-2 text-right font-medium text-slate-400">Qty</TableHead>
                  <TableHead className="px-4 py-2 text-right font-medium text-slate-400">Unit price</TableHead>
                  <TableHead className="px-4 py-2 text-right font-medium text-slate-400">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-50">
                {order.lines.map((l) => (
                  <TableRow key={l.id} className="hover:bg-transparent">
                    <TableCell className="px-4 py-2 text-slate-800">{productName(l.product_id)}</TableCell>
                    <TableCell className="px-4 py-2 text-right text-slate-600">{l.qty}</TableCell>
                    <TableCell className="px-4 py-2 text-right text-slate-600">
                      {formatCurrency(l.unit_price)}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right text-slate-700">
                      {formatCurrency(l.qty * l.unit_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-right text-sm font-semibold text-slate-800">
            Total: {formatCurrency(order.total_amount)}
          </p>
        </div>
      )}
    </Modal>
  );
}

function CreateOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState<number | "">("");
  const [lines, setLines] = useState<DraftLine[]>([{ product_id: "", qty: 1 }]);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
    enabled: open,
  });
  const products = useQuery({
    queryKey: ["products", "all-for-order"],
    queryFn: () => productsApi.list({ page: 1, page_size: 500, sort: "name", order: "asc" }),
    enabled: open,
  });

  const reset = () => {
    setCustomerId("");
    setLines([{ product_id: "", qty: 1 }]);
    setFormError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const create = useMutation({
    mutationFn: (input: OrderInput) => ordersApi.create(input),
    onSuccess: () => {
      toast.success("Order created");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      close();
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const updateLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const validLines = lines.filter((l) => l.product_id !== "" && l.qty > 0);

  const submit = () => {
    setFormError(null);
    if (customerId === "") {
      setFormError("Select a customer");
      return;
    }
    if (validLines.length === 0) {
      setFormError("Add at least one product line");
      return;
    }
    create.mutate({
      customer_id: Number(customerId),
      lines: validLines.map((l) => ({ product_id: Number(l.product_id), qty: l.qty })),
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Create order"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending}>Create order</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Customer" required>
          <Select
            value={customerId === "" ? PLACEHOLDER : String(customerId)}
            onValueChange={(v) => setCustomerId(v === PLACEHOLDER ? "" : Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PLACEHOLDER}>— Select customer —</SelectItem>
              {(customers.data ?? []).map((c: Customer) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Lines</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLines((ls) => [...ls, { product_id: "", qty: 1 }])}
            >
              + Add line
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <Select
                  value={line.product_id === "" ? PLACEHOLDER : String(line.product_id)}
                  onValueChange={(v) =>
                    updateLine(idx, {
                      product_id: v === PLACEHOLDER ? "" : Number(v),
                    })
                  }
                >
                  <SelectTrigger className="col-span-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLACEHOLDER}>— Product —</SelectItem>
                    {(products.data?.items ?? []).map((p: Product) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.sku} — {p.name} ({p.on_hand} on hand)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  className="col-span-3"
                  value={line.qty}
                  placeholder="Qty"
                  onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                />
                <button
                  className="col-span-1 text-slate-400 hover:text-red-600 disabled:opacity-40"
                  onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Prices and totals are computed by the server.
          </p>
        </div>

        {formError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
        )}
      </div>
    </Modal>
  );
}
