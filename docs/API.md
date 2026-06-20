# API reference

Auto-generated from the FastAPI OpenAPI schema (Ethara Inventory API v0.1.0).
Live interactive docs: `/docs` (Swagger UI) and `/redoc`. Raw schema: `/openapi.json`.

**54 endpoints** across 39 paths.

| Group | Method | Path | Summary |
| --- | --- | --- | --- |
| ai | `POST` | `/ai/actions/{action_id}` | Resolve |
| ai | `POST` | `/ai/chat` | Chat |
| ai | `DELETE` | `/ai/chat/{session_id}` | Clear Chat |
| ai | `GET` | `/ai/chat/{session_id}` | Chat History |
| ai | `GET` | `/ai/evals` | List Evals |
| ai | `POST` | `/ai/evals/run` | Run Eval |
| ai | `GET` | `/ai/evals/{run_id}` | Get Eval |
| ai | `GET` | `/ai/evals/{run_id}/stream` | Stream Eval |
| ai | `POST` | `/ai/feedback` | Feedback |
| ai | `GET` | `/ai/forecast/{product_id}` | Forecast |
| ai | `GET` | `/ai/prompts` | List Prompts |
| ai | `POST` | `/ai/prompts` | Create Prompt |
| ai | `POST` | `/ai/prompts/{prompt_id}/activate` | Activate Prompt |
| ai | `GET` | `/ai/reorder-suggestions` | Reorder Suggestions |
| ai | `GET` | `/ai/status` | Ai Status |
| auth | `POST` | `/auth/login` | Login |
| auth | `GET` | `/auth/me` | Me |
| auth | `POST` | `/auth/refresh` | Refresh |
| auth | `POST` | `/auth/register` | Register |
| catalog | `GET` | `/categories` | List Categories |
| catalog | `POST` | `/categories` | Create Category |
| catalog | `DELETE` | `/categories/{cat_id}` | Delete Category |
| catalog | `PUT` | `/categories/{cat_id}` | Update Category |
| catalog | `GET` | `/suppliers` | List Suppliers |
| catalog | `POST` | `/suppliers` | Create Supplier |
| catalog | `DELETE` | `/suppliers/{sup_id}` | Delete Supplier |
| catalog | `PUT` | `/suppliers/{sup_id}` | Update Supplier |
| customers | `GET` | `/customers` | List Customers |
| customers | `POST` | `/customers` | Create Customer |
| customers | `DELETE` | `/customers/{customer_id}` | Delete Customer |
| customers | `GET` | `/customers/{customer_id}` | Get Customer |
| dashboard | `GET` | `/audit` | Audit |
| dashboard | `GET` | `/dashboard/summary` | Summary |
| dashboard | `GET` | `/reports/low-stock` | Low Stock |
| dashboard | `GET` | `/reports/valuation` | Valuation |
| health | `GET` | `/health` | Health |
| orders | `GET` | `/orders` | List Orders |
| orders | `POST` | `/orders` | Create Order |
| orders | `DELETE` | `/orders/{order_id}` | Delete Order |
| orders | `GET` | `/orders/{order_id}` | Get Order |
| products | `GET` | `/products` | List Products |
| products | `POST` | `/products` | Create Product |
| products | `GET` | `/products/export` | Export Csv |
| products | `POST` | `/products/import` | Import Csv |
| products | `DELETE` | `/products/{product_id}` | Delete Product |
| products | `GET` | `/products/{product_id}` | Get Product |
| products | `PUT` | `/products/{product_id}` | Update Product |
| purchase-orders | `GET` | `/purchase-orders` | List Pos |
| purchase-orders | `POST` | `/purchase-orders` | Create Po |
| purchase-orders | `GET` | `/purchase-orders/{po_id}` | Get Po |
| purchase-orders | `POST` | `/purchase-orders/{po_id}/receive` | Receive Po |
| stock | `GET` | `/stock/levels` | Levels |
| stock | `GET` | `/stock/movements` | List Movements |
| stock | `POST` | `/stock/movements` | Create Movement |
