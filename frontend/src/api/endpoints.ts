import { api } from "./client";
import { API_BASE } from "../lib/config";
import { getToken } from "../lib/auth";
import type {
  ActionResponse,
  AiStatus,
  AuditEntry,
  AuthTokens,
  Category,
  CategoryInput,
  ChatResponse,
  Customer,
  CustomerInput,
  DashboardSummary,
  EvalRunDetail,
  EvalRunStart,
  EvalRunSummary,
  Forecast,
  ImportResultSuccess,
  Order,
  OrderInput,
  Paginated,
  Product,
  ProductInput,
  ProductQuery,
  Prompt,
  PromptInput,
  PurchaseOrder,
  PurchaseOrderInput,
  ReorderSuggestions,
  StockLevel,
  StockMovement,
  StockMovementInput,
  Supplier,
  SupplierInput,
  User,
  ValuationResponse,
} from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthTokens>("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

export const productsApi = {
  list: (query: ProductQuery) =>
    api
      .get<Paginated<Product>>("/products", {
        params: {
          q: query.q || undefined,
          category_id: query.category_id || undefined,
          sort: query.sort,
          order: query.order,
          page: query.page,
          page_size: query.page_size,
        },
      })
      .then((r) => r.data),
  get: (id: number) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  create: (input: ProductInput) =>
    api.post<Product>("/products", input).then((r) => r.data),
  update: (id: number, input: Partial<ProductInput>) =>
    api.put<Product>(`/products/${id}`, input).then((r) => r.data),
  remove: (id: number) => api.delete(`/products/${id}`).then((r) => r.data),
  exportUrl: () => `${API_BASE}/products/export`,
  importCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ImportResultSuccess>("/products/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};

export const categoriesApi = {
  list: () => api.get<Category[]>("/categories").then((r) => r.data),
  create: (input: CategoryInput) =>
    api.post<Category>("/categories", input).then((r) => r.data),
  update: (id: number, input: CategoryInput) =>
    api.put<Category>(`/categories/${id}`, input).then((r) => r.data),
  remove: (id: number) => api.delete(`/categories/${id}`).then((r) => r.data),
};

export const suppliersApi = {
  list: () => api.get<Supplier[]>("/suppliers").then((r) => r.data),
  create: (input: SupplierInput) =>
    api.post<Supplier>("/suppliers", input).then((r) => r.data),
  update: (id: number, input: SupplierInput) =>
    api.put<Supplier>(`/suppliers/${id}`, input).then((r) => r.data),
  remove: (id: number) => api.delete(`/suppliers/${id}`).then((r) => r.data),
};

export const customersApi = {
  list: () => api.get<Customer[]>("/customers").then((r) => r.data),
  get: (id: number) => api.get<Customer>(`/customers/${id}`).then((r) => r.data),
  create: (input: CustomerInput) =>
    api.post<Customer>("/customers", input).then((r) => r.data),
  remove: (id: number) => api.delete(`/customers/${id}`).then((r) => r.data),
};

export const ordersApi = {
  list: () => api.get<Order[]>("/orders").then((r) => r.data),
  get: (id: number) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  create: (input: OrderInput) =>
    api.post<Order>("/orders", input).then((r) => r.data),
  remove: (id: number) => api.delete(`/orders/${id}`).then((r) => r.data),
};

export const stockApi = {
  createMovement: (input: StockMovementInput) =>
    api.post<StockMovement>("/stock/movements", input).then((r) => r.data),
  movements: (productId?: number, limit?: number) =>
    api
      .get<StockMovement[]>("/stock/movements", {
        params: { product_id: productId, limit },
      })
      .then((r) => r.data),
  levels: () => api.get<StockLevel[]>("/stock/levels").then((r) => r.data),
};

export const poApi = {
  list: () => api.get<PurchaseOrder[]>("/purchase-orders").then((r) => r.data),
  get: (id: number) =>
    api.get<PurchaseOrder>(`/purchase-orders/${id}`).then((r) => r.data),
  create: (input: PurchaseOrderInput) =>
    api.post<PurchaseOrder>("/purchase-orders", input).then((r) => r.data),
  receive: (id: number) =>
    api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`).then((r) => r.data),
};

export const dashboardApi = {
  summary: () =>
    api.get<DashboardSummary>("/dashboard/summary").then((r) => r.data),
};

export const reportsApi = {
  lowStock: () => api.get<StockLevel[]>("/reports/low-stock").then((r) => r.data),
  valuation: () =>
    api.get<ValuationResponse>("/reports/valuation").then((r) => r.data),
};

export const auditApi = {
  list: (limit?: number) =>
    api.get<AuditEntry[]>("/audit", { params: { limit } }).then((r) => r.data),
};

export const aiApi = {
  status: () => api.get<AiStatus>("/ai/status").then((r) => r.data),
  chat: (sessionId: string, message: string) =>
    api
      .post<ChatResponse>("/ai/chat", { session_id: sessionId, message })
      .then((r) => r.data),
  action: (pendingId: string, decision: "confirm" | "reject") =>
    api
      .post<ActionResponse>(`/ai/actions/${pendingId}`, { decision })
      .then((r) => r.data),
  history: (sessionId: string) =>
    api
      .get<{ id: number; role: "user" | "assistant"; content: string; rating: number | null }[]>(
        `/ai/chat/${sessionId}`,
      )
      .then((r) => r.data),
  clearChat: (sessionId: string) =>
    api.delete(`/ai/chat/${sessionId}`).then((r) => r.data),
  feedback: (messageId: string | number, rating: 1 | -1) =>
    api
      .post("/ai/feedback", { message_id: messageId, rating })
      .then((r) => r.data),
  forecast: (productId: number) =>
    api.get<Forecast>(`/ai/forecast/${productId}`).then((r) => r.data),
  reorderSuggestions: () =>
    api.get<ReorderSuggestions>("/ai/reorder-suggestions").then((r) => r.data),
  prompts: () => api.get<Prompt[]>("/ai/prompts").then((r) => r.data),
  createPrompt: (input: PromptInput) =>
    api.post<Prompt>("/ai/prompts", input).then((r) => r.data),
  activatePrompt: (id: number) =>
    api.post<Prompt>(`/ai/prompts/${id}/activate`).then((r) => r.data),
  runEval: () => api.post<EvalRunStart>("/ai/evals/run").then((r) => r.data),
  evals: () => api.get<EvalRunSummary[]>("/ai/evals").then((r) => r.data),
  evalDetail: (runId: number) =>
    api.get<EvalRunDetail>(`/ai/evals/${runId}`).then((r) => r.data),
};

export async function downloadProductsCsv(): Promise<void> {
  const res = await api.get("/products/export", { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export { getToken };
