import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Product
from app.schemas import ProductIn, ProductList, ProductOut, ProductUpdate
from app.services import stock

router = APIRouter(prefix="/products", tags=["products"], dependencies=[Depends(get_current_user)])

SORT_FIELDS = {"name": Product.name, "sku": Product.sku, "unit_price": Product.unit_price,
               "created_at": Product.created_at}


def _to_out(p: Product, on_hand_val: int) -> ProductOut:
    return ProductOut(
        id=p.id, sku=p.sku, name=p.name, description=p.description,
        category_id=p.category_id, supplier_id=p.supplier_id,
        unit_price=p.unit_price, cost_price=p.cost_price,
        reorder_point=p.reorder_point, reorder_qty=p.reorder_qty,
        on_hand=on_hand_val,
        category_name=p.category.name if p.category else None,
        supplier_name=p.supplier.name if p.supplier else None,
    )


@router.get("", response_model=ProductList)
async def list_products(
    db: AsyncSession = Depends(get_db),
    q: str | None = None,
    category_id: int | None = None,
    sort: str = "name",
    order: str = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
):
    stmt = select(Product)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

    col = SORT_FIELDS.get(sort, Product.name)
    stmt = stmt.order_by(col.desc() if order == "desc" else col.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    products = (await db.execute(stmt)).scalars().all()
    levels = await stock.on_hand_map(db, [p.id for p in products])
    items = [_to_out(p, levels.get(p.id, 0)) for p in products]
    return ProductList(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(body: ProductIn, db: AsyncSession = Depends(get_db)):
    if (await db.execute(select(Product).where(Product.sku == body.sku))).scalar_one_or_none():
        raise HTTPException(409, f"SKU {body.sku} already exists")
    p = Product(**body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _to_out(p, 0)


@router.get("/export")
async def export_csv(db: AsyncSession = Depends(get_db)):
    products = (await db.execute(select(Product))).scalars().all()
    levels = await stock.on_hand_map(db, [p.id for p in products])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["sku", "name", "unit_price", "cost_price", "reorder_point", "reorder_qty", "on_hand"])
    for p in products:
        w.writerow([p.sku, p.name, p.unit_price, p.cost_price, p.reorder_point,
                    p.reorder_qty, levels.get(p.id, 0)])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"},
    )


@router.post("/import")
async def import_csv(file: UploadFile, db: AsyncSession = Depends(get_db)):
    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    errors: list[dict] = []
    staged: list[dict] = []
    seen_skus: set[str] = set()

    for i, row in enumerate(reader, start=2):
        sku = (row.get("sku") or "").strip()
        name = (row.get("name") or "").strip()
        if not sku:
            errors.append({"row": i, "error": "missing sku"})
            continue
        if not name:
            errors.append({"row": i, "error": "missing name"})
            continue
        if sku in seen_skus:
            errors.append({"row": i, "error": f"duplicate sku in file: {sku}"})
            continue
        try:
            staged.append({
                "sku": sku, "name": name,
                "unit_price": float(row.get("unit_price") or 0),
                "cost_price": float(row.get("cost_price") or 0),
                "reorder_point": int(float(row.get("reorder_point") or 10)),
                "reorder_qty": int(float(row.get("reorder_qty") or 50)),
            })
            seen_skus.add(sku)
        except ValueError as e:
            errors.append({"row": i, "error": f"invalid number: {e}"})

    if errors:
        raise HTTPException(status_code=422, detail={"imported": 0, "errors": errors})

    existing = {
        s for (s,) in (await db.execute(select(Product.sku).where(Product.sku.in_(seen_skus)))).all()
    }
    created = 0
    for r in staged:
        if r["sku"] in existing:
            continue
        db.add(Product(**r))
        created += 1
    await db.commit()
    return {"imported": created, "skipped_existing": len(staged) - created, "errors": []}


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return _to_out(p, await stock.on_hand(db, product_id))


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(product_id: int, body: ProductUpdate, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return _to_out(p, await stock.on_hand(db, product_id))


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if p:
        await db.delete(p)
        await db.commit()
