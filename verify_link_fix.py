import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def verify_link_detection():
    try:
        from backbone.core.config import BackboneConfig
        from fastapi import FastAPI
        from backbone.core.settings import Settings
        from backbone.core.repository import BeanieRepository
        from backbone.core.models import User, Attachment
        from schemas.shop import Category, Product
        from beanie import init_beanie
        from motor.motor_asyncio import AsyncIOMotorClient
        
        print("--- Testing Link Detection with Forward References ---")
        
        # Test Category (uses Thumbnail which is Link["Attachment"])
        print(f"\nAnalyzing Category model fields...")
        cat_links = BeanieRepository.detect_populate_fields(Category)
        print(f"Detected links in Category: {list(cat_links.keys())}")
        
        if "img" in cat_links:
            print(f"SUCCESS: 'img' detected as link to '{cat_links['img']['collection']}'")
        else:
            print(f"FAILURE: 'img' NOT detected as link.")

        # Test User (uses Thumbnail for profile_image)
        print(f"\nAnalyzing User model fields...")
        user_links = BeanieRepository.detect_populate_fields(User)
        print(f"Detected links in User: {list(user_links.keys())}")
        
        if "profile_image" in user_links:
            print(f"SUCCESS: 'profile_image' detected as link to '{user_links['profile_image']['collection']}'")
        else:
            print(f"FAILURE: 'profile_image' NOT detected as link.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_link_detection())
