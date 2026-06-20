from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product, StockMovement, Supplier
from app.services import stock as stock_svc

READ_TOOLS = {"search_products", "get_stock_level", "get_low_stock", "get_sales_trend",
              "inventory_value"}
WRITE_TOOLS = {"adjust_stock", "create_purchase_order"}

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "search_products",
        "description": "Search products by name or SKU. Returns matches with on-hand stock.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "Name or SKU fragment"}},
            "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "get_stock_level",
        "description": "Get on-hand stock and reorder point for one product by SKU.",
        "parameters": {"type": "object", "properties": {
            "sku": {"type": "string"}}, "required": ["sku"]}}},
    {"type": "function", "function": {
        "name": "get_low_stock",
        "description": "List products at or below their reorder point.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "get_sales_trend",
        "description": "Recent sales quantities (oldest first) for a product by SKU.",
        "parameters": {"type": "object", "properties": {
            "sku": {"type": "string"}}, "required": ["sku"]}}},
    {"type": "function", "function": {
        "name": "inventory_value",
        "description": "Total inventory value (on_hand * cost_price), optionally by category name.",
        "parameters": {"type": "object", "properties": {
            "category": {"type": "string", "description": "Optional category name filter"}}}}},
    {"type": "function", "function": {
        "name": "adjust_stock",
        "description": "Adjust stock for a product by SKU (positive or negative). WRITE: needs confirmation.",
        "parameters": {"type": "object", "properties": {
            "sku": {"type": "string"},
            "qty_delta": {"type": "integer"},
            "reason": {"type": "string"}},
            "required": ["sku", "qty_delta"]}}},
    {"type": "function", "function": {
        "name": "create_purchase_order",
        "description": "Create a purchase order. WRITE: needs confirmation.",
        "parameters": {"type": "object", "properties": {
            "supplier_id": {"type": "integer"},
            "items": {"type": "array", "items": {"type": "object", "properties": {
                "sku": {"type": "string"}, "qty": {"type": "integer"}},
                "required": ["sku", "qty"]}}},
            "required": ["supplier_id", "items"]}}},
]


async def _product_by_sku(db: AsyncSession, sku: str) -> Product | None:
    return (await db.execute(select(Product).where(Product.sku == sku))).scalar_one_or_none()


async def execute_read(db: AsyncSession, name: str, args: dict) -> dict:
    if name == "search_products":
        like = f"%{args.get('query', '')}%"
        prods = (await db.execute(
            select(Product).where(Product.name.ilike(like) | Product.sku.ilike(like)).limit(20)
        )).scalars().all()
        levels = await stock_svc.on_hand_map(db, [p.id for p in prods])
        return {"results": [
            {"sku": p.sku, "name": p.name, "on_hand": levels.get(p.id, 0),
             "unit_price": p.unit_price, "reorder_point": p.reorder_point} for p in prods]}

    if name == "get_stock_level":
        p = await _product_by_sku(db, args.get("sku", ""))
        if not p:
            return {"error": f"No product with SKU {args.get('sku')}"}
        return {"sku": p.sku, "name": p.name, "on_hand": await stock_svc.on_hand(db, p.id),
                "reorder_point": p.reorder_point}

    if name == "get_low_stock":
        return {"low_stock": await stock_svc.low_stock(db)}

    if name == "get_sales_trend":
        p = await _product_by_sku(db, args.get("sku", ""))
        if not p:
            return {"error": f"No product with SKU {args.get('sku')}"}
        movements = (await db.execute(
            select(StockMovement).where(
                StockMovement.product_id == p.id, StockMovement.type == "sale"
            ).order_by(StockMovement.created_at)
        )).scalars().all()
        return {"sku": p.sku, "history": [abs(m.qty_delta) for m in movements]}

    if name == "inventory_value":
        prods = (await db.execute(select(Product))).scalars().all()
        cat = (args.get("category") or "").strip().lower()
        if cat:
            prods = [p for p in prods if p.category and p.category.name.lower() == cat]
        levels = await stock_svc.on_hand_map(db, [p.id for p in prods])
        value = sum(levels.get(p.id, 0) * p.cost_price for p in prods)
        return {"category": args.get("category"), "value": round(value, 2), "skus": len(prods)}

    return {"error": f"Unknown read tool {name}"}


async def execute_write(db: AsyncSession, name: str, args: dict, *, user_id: int | None,
                        actor: str) -> dict:
    if name == "adjust_stock":
        p = await _product_by_sku(db, args.get("sku", ""))
        if not p:
            return {"error": f"No product with SKU {args.get('sku')}"}
        try:
            await stock_svc.apply_movement(
                db, product_id=p.id, qty_delta=int(args["qty_delta"]), type_="adjustment",
                reason=args.get("reason") or "AI agent adjustment", user_id=user_id, actor=actor,
            )
        except ValueError as e:
            return {"error": str(e)}
        return {"ok": True, "sku": p.sku, "new_on_hand": await stock_svc.on_hand(db, p.id)}

    if name == "create_purchase_order":
        from app.models import PurchaseOrder, PurchaseOrderLine
        supplier = await db.get(Supplier, int(args["supplier_id"]))
        if not supplier:
            return {"error": f"No supplier with id {args.get('supplier_id')}"}
        lines = []
        for item in args.get("items", []):
            p = await _product_by_sku(db, item.get("sku", ""))
            if not p:
                return {"error": f"No product with SKU {item.get('sku')}"}
            lines.append(PurchaseOrderLine(product_id=p.id, qty=int(item["qty"]),
                                           unit_cost=p.cost_price))
        po = PurchaseOrder(supplier_id=supplier.id, status="ordered", created_by=user_id, lines=lines)
        db.add(po)
        await db.commit()
        await db.refresh(po)
        return {"ok": True, "po_id": po.id, "lines": len(lines)}

    return {"error": f"Unknown write tool {name}"}
