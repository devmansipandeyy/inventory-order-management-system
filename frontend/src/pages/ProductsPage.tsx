import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  categoriesApi,
  downloadProductsCsv,
  productsApi,
} from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Spinner,
} from "../components/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ProductFormModal } from "../components/ProductFormModal";
import { StockAdjustModal } from "../components/StockAdjustModal";
import { ImportModal } from "../components/ImportModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { formatCurrency } from "../lib/format";
import type { Product, ProductQuery } from "../api/types";

const PAGE_SIZE = 20;
const ALL = "__all__";

const SORTS: { value: string; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "sku", label: "SKU" },
  { value: "on_hand", label: "On hand" },
  { value: "unit_price", label: "Unit price" },
];

export function ProductsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [exporting, setExporting] = useState(false);

  const query: ProductQuery = {
    q,
    category_id: categoryId,
    sort,
    order,
    page,
    page_size: PAGE_SIZE,
  };

  const products = useQuery({
    queryKey: ["products", query],
    queryFn: () => productsApi.list(query),
    placeholderData: keepPreviousData,
  });

  const categories = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadProductsCsv();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setOrder("asc");
    }
    setPage(1);
  };

  const total = products.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${total} item${total === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button variant="secondary" onClick={handleExport} loading={exporting}>
              Export CSV
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + New product
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label className="mb-1 block text-xs font-medium text-slate-500">Search</Label>
            <Input
              placeholder="Search by name or SKU…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-48">
            <Label className="mb-1 block text-xs font-medium text-slate-500">Category</Label>
            <Select
              value={categoryId === "" ? ALL : String(categoryId)}
              onValueChange={(v) => {
                setCategoryId(v === ALL ? "" : Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="mb-1 block text-xs font-medium text-slate-500">Sort by</Label>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}>
            {order === "asc" ? "Asc ↑" : "Desc ↓"}
          </Button>
        </div>
      </Card>

      <Card>
        {products.isLoading ? (
          <LoadingState />
        ) : products.isError ? (
          <ErrorState message={getErrorMessage(products.error)} onRetry={() => products.refetch()} />
        ) : products.data!.items.length === 0 ? (
          <EmptyState
            title="No products found"
            description="Try adjusting your filters or add a new product."
            action={
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>+ New product</Button>
            }
          />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <SortableTh label="SKU" col="sku" sort={sort} order={order} onClick={toggleSort} />
                <SortableTh label="Name" col="name" sort={sort} order={order} onClick={toggleSort} />
                <TableHead className="px-4 py-3 font-medium text-slate-400">Category</TableHead>
                <SortableTh label="On hand" col="on_hand" sort={sort} order={order} onClick={toggleSort} />
                <SortableTh label="Unit price" col="unit_price" sort={sort} order={order} onClick={toggleSort} />
                <TableHead className="px-4 py-3 text-right font-medium text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {products.data!.items.map((p) => {
                const low = p.on_hand <= p.reorder_point;
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/products/${p.id}`)}
                  >
                    <TableCell className="px-4 py-3 font-mono text-slate-600">{p.sku}</TableCell>
                    <TableCell className="px-4 py-3 font-medium text-slate-800">{p.name}</TableCell>
                    <TableCell className="px-4 py-3 text-slate-500">{p.category_name || "—"}</TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={low ? "font-semibold text-red-600" : "text-slate-700"}>
                        {p.on_hand}
                      </span>
                      {low && (
                        <Badge color="red">
                          <span className="ml-1">low</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">{formatCurrency(p.unit_price)}</TableCell>
                    <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setAdjusting(p)}>
                          + Adjust stock
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                          <span className="text-red-600">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!products.isLoading && total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              Page {page} of {totalPages}
              {products.isFetching && <Spinner className="h-3 w-3" />}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} product={editing} />
      <StockAdjustModal open={Boolean(adjusting)} onClose={() => setAdjusting(null)} product={adjusting} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete product"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
      />
    </div>
  );
}

function SortableTh({
  label,
  col,
  sort,
  order,
  onClick,
}: {
  label: string;
  col: string;
  sort: string;
  order: "asc" | "desc";
  onClick: (col: string) => void;
}) {
  const active = sort === col;
  return (
    <TableHead
      className="cursor-pointer select-none px-4 py-3 font-medium text-slate-400 hover:text-slate-600"
      onClick={() => onClick(col)}
    >
      {label}
      {active && <span className="ml-1">{order === "asc" ? "↑" : "↓"}</span>}
    </TableHead>
  );
}
