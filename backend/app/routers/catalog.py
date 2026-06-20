from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Category, Supplier
from app.schemas import CategoryIn, CategoryOut, SupplierIn, SupplierOut

router = APIRouter(tags=["catalog"], dependencies=[Depends(get_current_user)])


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Category).order_by(Category.name))).scalars().all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(body: CategoryIn, db: AsyncSession = Depends(get_db)):
    cat = Category(**body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.put("/categories/{cat_id}", response_model=CategoryOut)
async def update_category(cat_id: int, body: CategoryIn, db: AsyncSession = Depends(get_db)):
    cat = await db.get(Category, cat_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(cat_id: int, db: AsyncSession = Depends(get_db)):
    cat = await db.get(Category, cat_id)
    if cat:
        await db.delete(cat)
        await db.commit()


@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Supplier).order_by(Supplier.name))).scalars().all()


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
async def create_supplier(body: SupplierIn, db: AsyncSession = Depends(get_db)):
    sup = Supplier(**body.model_dump())
    db.add(sup)
    await db.commit()
    await db.refresh(sup)
    return sup


@router.put("/suppliers/{sup_id}", response_model=SupplierOut)
async def update_supplier(sup_id: int, body: SupplierIn, db: AsyncSession = Depends(get_db)):
    sup = await db.get(Supplier, sup_id)
    if not sup:
        raise HTTPException(404, "Supplier not found")
    for k, v in body.model_dump().items():
        setattr(sup, k, v)
    await db.commit()
    await db.refresh(sup)
    return sup


@router.delete("/suppliers/{sup_id}", status_code=204)
async def delete_supplier(sup_id: int, db: AsyncSession = Depends(get_db)):
    sup = await db.get(Supplier, sup_id)
    if sup:
        await db.delete(sup)
        await db.commit()
