import { useEffect, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "../api/endpoints";
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
import type { Customer, CustomerInput } from "../api/types";

const empty: CustomerInput = { full_name: "", email: "", phone: "" };

export function CustomersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(empty);
  const [emailError, setEmailError] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["customers"], queryFn: customersApi.list });

  useEffect(() => {
    if (formOpen) {
      setForm(empty);
      setEmailError(null);
    }
  }, [formOpen]);

  const save = useMutation({
    mutationFn: (input: CustomerInput) => customersApi.create(input),
    onSuccess: () => {
      toast.success("Customer created");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setFormOpen(false);
    },
    onError: (e) => {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setEmailError("Email already registered");
        return;
      }
      toast.error(getErrorMessage(e));
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => customersApi.remove(id),
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const submit = () => {
    setEmailError(null);
    save.mutate(form);
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={<Button onClick={() => setFormOpen(true)}>+ Add customer</Button>}
      />
      <Card>
        {list.isLoading ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="No customers" description="Add your first customer." />
        ) : (
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-transparent">
                <TableHead className="px-5 py-3 font-medium text-slate-400">Full name</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Email</TableHead>
                <TableHead className="px-5 py-3 font-medium text-slate-400">Phone</TableHead>
                <TableHead className="px-5 py-3 text-right font-medium text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-50">
              {list.data!.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50">
                  <TableCell className="px-5 py-3 font-medium text-slate-800">{c.full_name}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">{c.email}</TableCell>
                  <TableCell className="px-5 py-3 text-slate-500">{c.phone || "—"}</TableCell>
                  <TableCell className="px-5 py-3 text-right">
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
        title="Add customer"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              loading={save.isPending}
              disabled={!form.full_name.trim() || !form.email.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Full name" required>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Email" required error={emailError ?? undefined}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => {
                setEmailError(null);
                setForm((f) => ({ ...f, email: e.target.value }));
              }}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete customer"
        message={`Delete "${deleting?.full_name}"?`}
      />
    </div>
  );
}
