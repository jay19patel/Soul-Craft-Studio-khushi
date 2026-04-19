"""
* scripts/fix_ecommerce_data.py
? Fixes corrupted data in MongoDB:
  1. Status typos: "complated" -> "verified"
  2. Literal "None" strings -> null
"""

import asyncio
import logging
from typing import Any

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from backbone.config import settings
from backbone.domain.models import User, Attachment, Session, LogEntry, Store, Task, Email
from ecommerce.models import Order, Product, Category, Cart, CartItem, OrderItem, Payment, FAQ, Testimonial, Contact

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fix_data")

async def fix_data():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client.get_database(settings.DATABASE_NAME)
    
    # ? All models registered so init_beanie works
    all_models = [
        User, Session, LogEntry, Attachment, Store, Task, Email,
        Order, Product, Category, Cart, CartItem, OrderItem, Payment, 
        FAQ, Testimonial, Contact
    ]
    
    await init_beanie(database=db, document_models=all_models)
    
    logger.info("Starting data fix...")

    # 1. Fix Payment status "complated"
    payments_to_fix = await Payment.find({"status": "complated"}).to_list()
    logger.info(f"Found {len(payments_to_fix)} payments with 'complated' status.")
    for p in payments_to_fix:
        p.status = "verified"
        await p.save()
        logger.info(f"Fixed payment {p.id}")

    # 2. Fix literal "None" in Payment date fields
    # ? We check manually because find() might miss them if they are strings vs missing
    async for p in Payment.all():
        changed = False
        for field in ["received_at", "confirmed_at", "submitted_at"]:
            val = getattr(p, field, None)
            if isinstance(val, str) and val.strip().lower() == "none":
                setattr(p, field, None)
                changed = True
        if changed:
            await p.save()
            logger.info(f"Fixed 'None' dates in payment {p.id}")

    # 3. Fix literal "None" in Order fields
    async for o in Order.all():
        changed = False
        # ? payment_id, notes, customer_email, etc.
        for field in ["payment_id", "notes", "customer_email", "customer_phone", "payment_status"]:
            val = getattr(o, field, None)
            if isinstance(val, str) and val.strip().lower() == "none":
                setattr(o, field, None)
                changed = True
            elif field == "payment_status" and val == "complated":
                o.payment_status = "verified"
                changed = True
        if changed:
            await o.save()
            logger.info(f"Fixed corrupted fields in order {o.id}")

    logger.info("Data fix complete.")

if __name__ == "__main__":
    asyncio.run(fix_data())
