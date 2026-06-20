from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Customer
from app.schemas import CustomerIn, CustomerOut

router = APIRouter(prefix="/customers", tags=["customers"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[CustomerOut])
async def list_customers(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Customer).order_by(Customer.full_name))).scalars().all()


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerIn, db: AsyncSession = Depends(get_db)):
    existing = (
        await db.execute(select(Customer).where(Customer.email == body.email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Email {body.email} already registered")
    cust = Customer(full_name=body.full_name, email=body.email, phone=body.phone)
    db.add(cust)
    await db.commit()
    await db.refresh(cust)
    return cust


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    cust = await db.get(Customer, customer_id)
    if not cust:
        raise HTTPException(404, "Customer not found")
    return cust


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    cust = await db.get(Customer, customer_id)
    if cust:
        await db.delete(cust)
        await db.commit()
