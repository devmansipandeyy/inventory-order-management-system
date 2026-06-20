import { useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { productsApi } from "../api/endpoints";
import { getErrorMessage } from "../api/client";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { useToast } from "./Toast";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportResultSuccess } from "../api/types";

interface RowError {
  row: number;
  error: string;
}

export function ImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResultSuccess | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setRowErrors(null);
    setFatal(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setRowErrors(null);
    setFatal(null);
    try {
      const res = await productsApi.importCsv(file);
      setResult(res);
      if (res.errors?.length) setRowErrors(res.errors);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Imported ${res.imported} product(s)`);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 422) {
        const detail = e.response.data?.detail as
          | { imported?: number; errors?: RowError[] }
          | undefined;
        if (detail?.errors) {
          setRowErrors(detail.errors);
          setResult({
            imported: detail.imported ?? 0,
            skipped_existing: 0,
            errors: detail.errors,
          });
          qc.invalidateQueries({ queryKey: ["products"] });
          toast.error("Some rows could not be imported");
        } else {
          setFatal(getErrorMessage(e));
        }
      } else {
        setFatal(getErrorMessage(e));
        toast.error(getErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import products (CSV)"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
          <Button onClick={submit} loading={busy} disabled={!file}>
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Upload a CSV with product rows. Existing SKUs are skipped; bad rows are
          reported below.
        </p>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-1 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700"
        />

        {result && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Imported {result.imported}
            {typeof result.skipped_existing === "number" &&
              `, skipped ${result.skipped_existing} existing`}
            .
          </div>
        )}

        {fatal && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fatal}</div>
        )}

        {rowErrors && rowErrors.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              Row errors ({rowErrors.length})
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 scrollbar-thin">
              <Table className="min-w-full text-sm">
                <TableHeader className="bg-slate-50">
                  <TableRow className="text-left text-xs uppercase text-slate-400 hover:bg-transparent">
                    <TableHead className="px-3 py-2 font-medium text-slate-400">Row</TableHead>
                    <TableHead className="px-3 py-2 font-medium text-slate-400">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {rowErrors.map((r, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell className="px-3 py-2 font-mono text-slate-600">{r.row}</TableCell>
                      <TableCell className="px-3 py-2 text-red-600">{r.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
