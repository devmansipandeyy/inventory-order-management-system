
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export type UserRole = "admin" | "staff" | string;

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  category_id?: number | null;
  supplier_id?: number | null;
  unit_price: number;
  cost_price: number;
  reorder_point: number;
  reorder_qty: number;
  on_hand: number;
  category_name?: string | null;
  supplier_name?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  category_id?: number | null;
  supplier_id?: number | null;
  unit_price: number;
  cost_price: number;
  reorder_point: number;
  reorder_qty: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
}

export interface CategoryInput {
  name: string;
  description?: string;
}

export interface Supplier {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  lead_time_days?: number | null;
}

export interface SupplierInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  lead_time_days?: number;
}

export type MovementType = "purchase" | "sale" | "adjustment" | "return";

export interface StockMovement {
  id: number;
  product_id: number;
  type: MovementType;
  qty_delta: number;
  reason?: string | null;
  created_at: string;
}

export interface StockMovementInput {
  product_id: number;
  type: MovementType;
  qty_delta: number;
  reason?: string;
}

export interface StockLevel {
  product_id: number;
  sku: string;
  name: string;
  on_hand: number;
  reorder_point: number;
  below_reorder: boolean;
}

export interface PurchaseOrderLine {
  product_id: number;
  qty: number;
  unit_cost: number;
  sku?: string;
  name?: string;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name?: string | null;
  status: string;
  expected_at?: string | null;
  created_at?: string | null;
  received_at?: string | null;
  total_cost?: number | null;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderInput {
  supplier_id: number;
  expected_at?: string | null;
  lines: { product_id: number; qty: number; unit_cost: number }[];
}

export interface Customer {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
}

export interface CustomerInput {
  full_name: string;
  email: string;
  phone?: string;
}

export interface OrderLine {
  id: number;
  product_id: number;
  qty: number;
  unit_price: number;
}

export interface Order {
  id: number;
  customer_id: number;
  status: string;
  total_amount: number;
  created_at: string;
  lines: OrderLine[];
}

export interface OrderInput {
  customer_id: number;
  lines: { product_id: number; qty: number }[];
}

export interface DashboardSummary {
  total_skus: number;
  total_customers: number;
  total_orders: number;
  total_units: number;
  stock_value: number;
  low_stock_count: number;
  pending_pos: number;
  recent_movements: StockMovement[];
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entity?: string | null;
  detail?: Record<string, unknown> | string | null;
  created_at: string;
}

export interface ValuationRow {
  product_id: number;
  sku: string;
  name: string;
  on_hand: number;
  cost_price: number;
  value: number;
}

export interface ValuationResponse {
  rows: ValuationRow[];
  total_value?: number;
}

export interface AiStatus {
  enabled: boolean;
  model?: string | null;
}

export type MessageId = string | number;

export interface ChatMessageResponse {
  type: "message";
  content: string;
  message_id: MessageId;
  status?: string;
  result?: unknown;
}

export interface ChatConfirmResponse {
  type: "confirm_required";
  pending_id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
}

export type ChatResponse = ChatMessageResponse | ChatConfirmResponse;

export interface ActionResponse {
  type: "message";
  content: string;
  status: string;
  result?: unknown;
}

export interface Forecast {
  product_id: number;
  history: number[];
  forecast: number[];
  recommended_reorder_qty: number;
  explanation: string;
}

export interface ReorderSuggestion {
  product_id: number;
  sku: string;
  name: string;
  on_hand: number;
  reorder_point: number;
  supplier_id?: number | null;
  forecast?: number | number[] | null;
  recommended_reorder_qty: number;
}

export interface ReorderSuggestions {
  suggestions: ReorderSuggestion[];
}

export interface Prompt {
  id: number;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export interface PromptInput {
  name: string;
  content: string;
  activate?: boolean;
}

export interface EvalRunStart {
  run_id: number;
  total: number;
  status: string;
}

export interface EvalRunSummary {
  id: number;
  status: string;
  total: number;
  passed: number;
  pass_rate: number;
  created_at: string;
}

export interface EvalCaseResult {
  case_id: string | number;
  question: string;
  tool_ok: boolean;
  answer_ok: boolean;
  passed: boolean;
  actual?: unknown;
}

export interface EvalRunDetail {
  id: number;
  status: string;
  total: number;
  passed: number;
  pass_rate: number;
  results: EvalCaseResult[];
}

export interface ProductQuery {
  q?: string;
  category_id?: number | "";
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface ImportResultSuccess {
  imported: number;
  skipped_existing: number;
  errors: { row: number; error: string }[];
}

export interface ImportResultError {
  imported: number;
  errors: { row: number; error: string }[];
}
