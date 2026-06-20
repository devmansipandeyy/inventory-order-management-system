import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { stockApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import { Modal } from "./Modal";
import { Button, Field } from "./ui";
import { useToast } from "./Toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MovementType, Product } from "../api/types";

const TYPES: MovementType[] = ["purchase", "sale", "adjustment", "return"];

export function StockAdjustModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<MovementType>("adjustment");
  const [qtyDelta, setQtyDelta] = useState<number>(0);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setType("adjustment");
      setQtyDelta(0);
      setReason("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      stockApi.createMovement({
        product_id: product!.id,
        type,
        qty_delta: qtyDelta,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success("Stock movement recorded");
      qc.invalidateQueries({ queryKey: ["products"] });
      if (product) {
        qc.invalidateQueries({ queryKey: ["product", product.id] });
        qc.invalidateQueries({ queryKey: ["movements", product.id] });
      }
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Adjust stock — ${product.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={qtyDelta === 0}
          >
            Record movement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Current on hand: <span className="font-medium text-slate-800">{product.on_hand}</span>
        </p>
        <Field label="Movement type" required>
          <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quantity delta (use negative to decrease)" required>
          <Input
            type="number"
            value={qtyDelta}
            onChange={(e) => setQtyDelta(Number(e.target.value))}
          />
        </Field>
        <Field label="Reason">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Cycle count correction"
          />
        </Field>
      </div>
    </Modal>
  );
}
