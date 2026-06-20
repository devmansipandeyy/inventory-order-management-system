import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, productsApi, suppliersApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import { Modal } from "./Modal";
import { Button, Field } from "./ui";
import { useToast } from "./Toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, ProductInput } from "../api/types";

interface Props {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

const NONE = "__none__";

const empty: ProductInput = {
  sku: "",
  name: "",
  description: "",
  category_id: null,
  supplier_id: null,
  unit_price: 0,
  cost_price: 0,
  reorder_point: 0,
  reorder_qty: 0,
};

export function ProductFormModal({ open, onClose, product }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductInput>(empty);

  const categories = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list, enabled: open });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: suppliersApi.list, enabled: open });

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        sku: product.sku,
        name: product.name,
        description: product.description ?? "",
        category_id: product.category_id ?? null,
        supplier_id: product.supplier_id ?? null,
        unit_price: product.unit_price,
        cost_price: product.cost_price,
        reorder_point: product.reorder_point,
        reorder_qty: product.reorder_qty,
      });
    } else {
      setForm(empty);
    }
  }, [open, product]);

  const mutation = useMutation({
    mutationFn: (input: ProductInput) =>
      product ? productsApi.update(product.id, input) : productsApi.create(input),
    onSuccess: () => {
      toast.success(product ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["products"] });
      if (product) qc.invalidateQueries({ queryKey: ["product", product.id] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const update = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={product ? "Edit product" : "New product"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {product ? "Save changes" : "Create"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SKU" required>
          <Input
            value={form.sku}
            required
            disabled={Boolean(product)}
            onChange={(e) => update("sku", e.target.value)}
          />
        </Field>
        <Field label="Name" required>
          <Input
            value={form.name}
            required
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Category">
          <Select
            value={form.category_id != null ? String(form.category_id) : NONE}
            onValueChange={(v) => update("category_id", v === NONE ? null : Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— None —</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Supplier">
          <Select
            value={form.supplier_id != null ? String(form.supplier_id) : NONE}
            onValueChange={(v) => update("supplier_id", v === NONE ? null : Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— None —</SelectItem>
              {(suppliers.data ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Unit price" required>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.unit_price}
            onChange={(e) => update("unit_price", Number(e.target.value))}
          />
        </Field>
        <Field label="Cost price" required>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.cost_price}
            onChange={(e) => update("cost_price", Number(e.target.value))}
          />
        </Field>
        <Field label="Reorder point" required>
          <Input
            type="number"
            min="0"
            value={form.reorder_point}
            onChange={(e) => update("reorder_point", Number(e.target.value))}
          />
        </Field>
        <Field label="Reorder qty" required>
          <Input
            type="number"
            min="0"
            value={form.reorder_qty}
            onChange={(e) => update("reorder_qty", Number(e.target.value))}
          />
        </Field>
      </form>
    </Modal>
  );
}
