import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { suppliersApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import type { Supplier, SupplierInput } from "../api/types";

const empty: SupplierInput = {
  name: "",
  email: "",
  phone: "",
  address: "",
  lead_time_days: undefined,
};

export function SuppliersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(empty);

  const list = useQuery({ queryKey: ["suppliers"], queryFn: suppliersApi.list });

  useEffect(() => {
    if (formOpen) {
      setForm(
        editing
          ? {
              name: editing.name,
              email: editing.email ?? "",
              phone: editing.phone ?? "",
              address: editing.address ?? "",
              lead_time_days: editing.lead_time_days ?? undefined,
            }
          : empty,
      );
    }
  }, [formOpen, editing]);

  const save = useMutation({
    mutationFn: (input: SupplierInput) =>
      editing ? suppliersApi.update(editing.id, input) : suppliersApi.create(input),
    onSuccess: () => {
      toast.success(editing ? "Supplier updated" : "Supplier created");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setFormOpen(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => suppliersApi.remove(id),
    onSuccess: () => {
      toast.success("Supplier deleted");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}>+ New supplier</Button>}
      />
      <Card>
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="No suppliers" description="Add your first supplier." />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">Name</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Email</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Phone</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Lead time</TableHead>
                <TableHead className="px-5 py-3 text-right font-medium text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {list.data!.map((s) => (
                <TableRow key={s.id} className="hover:bg-slate-50">
                  <TableCell className="px-5 py-3 font-medium text-slate-800">{s.name}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">{s.email || "—"}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">{s.phone || "—"}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">
                    {s.lead_time_days != null ? `${s.lead_time_days} days` : "—"}
                  </TableCell>
                  <TableCell className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setFormOpen(true); }}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(s)}>
                      <span className="text-red-600">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit supplier" : "New supplier"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} loading={save.isPending} disabled={!form.name.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </Field>
          </div>
          <Field label="Lead time (days)">
            <Input
              type="number"
              min="0"
              value={form.lead_time_days ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  lead_time_days: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete supplier"
        message={`Delete "${deleting?.name}"?`}
      />
    </div>
  );
}
