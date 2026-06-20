import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "../api/endpoints";
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
import { Textarea } from "@/components/ui/textarea";
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
import type { Category, CategoryInput } from "../api/types";

export function CategoriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryInput>({ name: "", description: "" });

  const list = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });

  useEffect(() => {
    if (formOpen) {
      setForm({ name: editing?.name ?? "", description: editing?.description ?? "" });
    }
  }, [formOpen, editing]);

  const save = useMutation({
    mutationFn: (input: CategoryInput) =>
      editing ? categoriesApi.update(editing.id, input) : categoriesApi.create(input),
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setFormOpen(false);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: () => {
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Categories"
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>+ New category</Button>
        }
      />
      <Card>
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="No categories" description="Create your first category." />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">Name</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Description</TableHead>
                <TableHead className="px-5 py-3 text-right font-medium text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {list.data!.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50">
                  <TableCell className="px-5 py-3 font-medium text-slate-800">{c.name}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">{c.description || "—"}</TableCell>
                  <TableCell className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setFormOpen(true); }}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(c)}>
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
        title={editing ? "Edit category" : "New category"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} loading={save.isPending} disabled={!form.name.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Description">
            <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete category"
        message={`Delete "${deleting?.name}"?`}
      />
    </div>
  );
}
