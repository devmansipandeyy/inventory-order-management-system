from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: str = "staff"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(ORMModel):
    id: int
    email: EmailStr
    name: str
    role: str


class CategoryIn(BaseModel):
    name: str
    description: str | None = None


class CategoryOut(ORMModel):
    id: int
    name: str
    description: str | None = None


class SupplierIn(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    lead_time_days: int = 7


class SupplierOut(ORMModel):
    id: int
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    lead_time_days: int


class ProductIn(BaseModel):
    sku: str
    name: str
    description: str | None = None
    category_id: int | None = None
    supplier_id: int | None = None
    unit_price: float = 0.0
    cost_price: float = 0.0
    reorder_point: int = 10
    reorder_qty: int = 50


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category_id: int | None = None
    supplier_id: int | None = None
    unit_price: float | None = None
    cost_price: float | None = None
    reorder_point: int | None = None
    reorder_qty: int | None = None


class ProductOut(ORMModel):
    id: int
    sku: str
    name: str
    description: str | None = None
    category_id: int | None = None
    supplier_id: int | None = None
    unit_price: float
    cost_price: float
    reorder_point: int
    reorder_qty: int
    on_hand: int = 0
    category_name: str | None = None
    supplier_name: str | None = None


class ProductList(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int


class CustomerIn(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    phone: str | None = None


class CustomerOut(ORMModel):
    id: int
    full_name: str
    email: EmailStr
    phone: str | None = None


class OrderLineIn(BaseModel):
    product_id: int
    qty: int = Field(gt=0)


class OrderIn(BaseModel):
    customer_id: int
    lines: list[OrderLineIn] = Field(min_length=1)


class OrderLineOut(ORMModel):
    id: int
    product_id: int
    qty: int
    unit_price: float


class OrderOut(ORMModel):
    id: int
    customer_id: int
    status: str
    total_amount: float
    created_at: datetime
    lines: list[OrderLineOut]


class MovementIn(BaseModel):
    product_id: int
    type: str = "adjustment"
    qty_delta: int
    reason: str | None = None


class MovementOut(ORMModel):
    id: int
    product_id: int
    type: str
    qty_delta: int
    reason: str | None = None
    user_id: int | None = None
    created_at: datetime


class StockLevel(BaseModel):
    product_id: int
    sku: str
    name: str
    on_hand: int
    reorder_point: int
    below_reorder: bool


class POLineIn(BaseModel):
    product_id: int
    qty: int
    unit_cost: float = 0.0


class POIn(BaseModel):
    supplier_id: int
    expected_at: datetime | None = None
    lines: list[POLineIn]


class POLineOut(ORMModel):
    id: int
    product_id: int
    qty: int
    unit_cost: float


class POOut(ORMModel):
    id: int
    supplier_id: int
    status: str
    created_at: datetime
    expected_at: datetime | None = None
    lines: list[POLineOut]


class DashboardSummary(BaseModel):
    total_skus: int
    total_customers: int
    total_orders: int
    total_units: int
    stock_value: float
    low_stock_count: int
    pending_pos: int
    recent_movements: list[MovementOut]


class ChatIn(BaseModel):
    session_id: str
    message: str


class ActionDecision(BaseModel):
    decision: str


class ForecastOut(BaseModel):
    product_id: int
    history: list[int]
    forecast: list[float]
    recommended_reorder_qty: int
    explanation: str


class FeedbackIn(BaseModel):
    message_id: int
    rating: int


class PromptIn(BaseModel):
    name: str
    content: str
    activate: bool = False


class PromptOut(ORMModel):
    id: int
    name: str
    content: str
    is_active: bool
    created_at: datetime


class EvalRunOut(ORMModel):
    id: int
    status: str
    total: int
    passed: int
    pass_rate: float
    created_at: datetime


class AuditOut(ORMModel):
    id: int
    actor: str
    action: str
    entity: str | None = None
    detail: dict | None = None
    created_at: datetime
