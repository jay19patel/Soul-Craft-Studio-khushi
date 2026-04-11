import asyncio
from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

class Base(Document):
    pass

class Sub(Base):
    pass

async def test_lookup():
    print(f"Subclasses of Document: {[c.__name__ for c in Document.__subclasses__()]}")
    # Beanie doesn't seem to have a simple public registry of all models by name, 
    # but we can usually find them via subclasses if they've been imported.

if __name__ == "__main__":
    asyncio.run(test_lookup())
