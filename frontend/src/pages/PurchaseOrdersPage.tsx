import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { poApi, productsApi, suppliersApi } from "../api/endpoints";
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
import type { PurchaseOrder, PurchaseOrderInput } from "../api/types";

const PLACEHOLDER = "__none__";

interface DraftLine {
  product_id: number | "";
  qty: number;
  unit_cost: number;
}

function statusColor(status: string): "green" | "amber" | "blue" | "slate" {
  const s = status.toLowerCase();
  if (s.includes("receiv")) return "green";
  if (s.includes("pending") || s.includes("open") || s.includes("draft")) return "amber";
  if (s.includes("order")) return "blue";
  return "slate";
}

export function PurchaseOrdersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery({ queryKey: ["purchase-orders"], queryFn: poApi.list });

  const receive = useMutation({
    mutationFn: (id: number) => poApi.receive(id),
    onSuccess: () => {
      toast.success("PO received — stock updated");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        actions={<Button onClick={() => setCreateOpen(true)}>+ New PO</Button>}
      />
      <Card>
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="No purchase orders" description="Create a PO to restock products." />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">PO #</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Supplier</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Status</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Lines</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Expected</TableHead>
                <TableHead className="px-5 py-3 text-right font-medium text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {list.data!.map((po) => (
                <PoRow key={po.id} po={po} onReceive={(id) => receive.mutate(id)} receiving={receive.isPending} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreatePoModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function PoRow({
  po,
  onReceive,
  receiving,
}: {
  po: PurchaseOrder;
  onReceive: (id: number) => void;
  receiving: boolean;
}) {
  const received = po.status.toLowerCase().includes("receiv");
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell className="px-5 py-3 font-mono text-slate-600">#{po.id}</TableCell>
      <TableCell className="px-5 py-3 text-slate-800">{po.supplier_name || `Supplier #${po.supplier_id}`}</TableCell>
      <TableCell className="px-5 py-3">
        <Badge color={statusColor(po.status)}>{po.status}</Badge>
      </TableCell>
      <TableCell className="px-5 py-3 text-slate-500">{po.lines?.length ?? 0}</TableCell>
      <TableCell className="px-5 py-3 text-slate-400">{po.expected_at ? formatDateTime(po.expected_at) : "—"}</TableCell>
      <TableCell className="px-5 py-3 text-right">
        {received ? (
          <span className="text-xs text-slate-400">Received</span>
        ) : (
          <Button size="sm" onClick={() => onReceive(po.id)} loading={receiving}>
            Receive
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function CreatePoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [expectedAt, setExpectedAt] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ product_id: "", qty: 1, unit_cost: 0 }]);

  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: suppliersApi.list, enabled: open });
  const products = useQuery({
    queryKey: ["products", "all-for-po"],
    queryFn: () => productsApi.list({ page: 1, page_size: 500, sort: "name", order: "asc" }),
    enabled: open,
  });

  const reset = () => {
    setSupplierId("");
    setExpectedAt("");
    setLines([{ product_id: "", qty: 1, unit_cost: 0 }]);
  };

  const create = useMutation({
    mutationFn: (input: PurchaseOrderInput) => poApi.create(input),
    onSuccess: () => {
      toast.success("Purchase order created");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const validLines = lines.filter((l) => l.product_id !== "" && l.qty > 0);

  const submit = () => {
    if (supplierId === "") {
      toast.error("Select a supplier");
      return;
    }
    if (validLines.length === 0) {
      toast.error("Add at least one product line");
      return;
    }
    create.mutate({
      supplier_id: Number(supplierId),
      expected_at: expectedAt || undefined,
      lines: validLines.map((l) => ({
        product_id: Number(l.product_id),
        qty: l.qty,
        unit_cost: l.unit_cost,
      })),
    });
  };

  const total = validLines.reduce((sum, l) => sum + l.qty * l.unit_cost, 0);

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      wide
      title="New purchase order"
      footer={
        <>
          <Button variant="secondary" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending}>Create PO</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier" required>
            <Select
              value={supplierId === "" ? PLACEHOLDER : String(supplierId)}
              onValueChange={(v) => setSupplierId(v === PLACEHOLDER ? "" : Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PLACEHOLDER}>— Select supplier —</SelectItem>
                {(suppliers.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expected date">
            <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Lines</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLines((ls) => [...ls, { product_id: "", qty: 1, unit_cost: 0 }])}
            >
              + Add line
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <Select
                  value={line.product_id === "" ? PLACEHOLDER : String(line.product_id)}
                  onValueChange={(v) => {
                    const pid = v === PLACEHOLDER ? "" : Number(v);
                    const prod = products.data?.items.find((p) => p.id === pid);
                    updateLine(idx, {
                      product_id: pid,
                      unit_cost: prod && line.unit_cost === 0 ? prod.cost_price : line.unit_cost,
                    });
                  }}
                >
                  <SelectTrigger className="col-span-6 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLACEHOLDER}>— Product —</SelectItem>
                    {(products.data?.items ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.sku} — {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  className="col-span-2"
                  value={line.qty}
                  placeholder="Qty"
                  onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="col-span-3"
                  value={line.unit_cost}
                  placeholder="Unit cost"
                  onChange={(e) => updateLine(idx, { unit_cost: Number(e.target.value) })}
                />
                <button
                  className="col-span-1 text-slate-400 hover:text-red-600"
                  onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-right text-sm font-medium text-slate-700">
            Estimated total: {formatCurrency(total)}
          </p>
        </div>
      </div>
    </Modal>
  );
}
