import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def verify_sanitization_fix():
    try:
        from backbone.core.config import BackboneConfig
        from fastapi import FastAPI
        from backbone.core.settings import Settings
        from backbone.core.repository import BeanieRepository
        from backbone.core.models import Attachment
        from schemas.shop import Category
        from beanie import init_beanie
        from motor.motor_asyncio import AsyncIOMotorClient
        
        print("--- Testing Sanitization Root Protection ---")
        
        # Mocking an Attachment document
        att_doc = {
            "id": "69da1d9c8735bb316ceb1f9e",
            "file_path": "/media/images/photo.jpg",
            "filename": "photo.jpg",
            "content_type": "image/jpeg"
        }
        
        # Test 1: Sanitize as ROOT (Documents in a list)
        sanitized_root = BeanieRepository._sanitize(att_doc, is_root=True)
        print(f"\nSanitizing Attachment as ROOT:")
        print(f"Type: {type(sanitized_root)}")
        if isinstance(sanitized_root, dict):
            print("SUCCESS: Root attachment preserved as dictionary.")
        else:
            print(f"FAILURE: Root attachment flattened into {type(sanitized_root)}")

        # Test 2: Sanitize as NESTED (Field in a document)
        cat_doc = {
            "id": "cat123",
            "name": "Woolen",
            "img": att_doc
        }
        sanitized_nested = BeanieRepository._sanitize(cat_doc, is_root=True)
        print(f"\nSanitizing Category (Nested Attachment):")
        img_val = sanitized_nested.get("img")
        print(f"Nested 'img' type: {type(img_val)}")
        print(f"Nested 'img' value: {img_val}")
        
        if isinstance(img_val, str) and img_val.startswith("http"):
             print("SUCCESS: Nested attachment flattened to URL string.")
        else:
             print("FAILURE: Nested attachment NOT flattened correctly.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_sanitization_fix())
