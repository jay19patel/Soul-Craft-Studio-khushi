"""
* scripts/seed_khushi.py
? Seed script to populate the database with categories and products for Soul Craft Studio (Khushi).
  Downloads high-quality images from GitHub and saves them as local attachments.
"""

import asyncio
import logging
from datetime import UTC, datetime

from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from backbone.config import settings
from backbone.core.database import init_database
from backbone.domain.models import Attachment, Email, LogEntry, Session, Store, Task, User
from backbone.web.routers.admin.helpers import download_https_url_and_save_as_attachment, build_beanie_link_from_object_id_string
from ecommerce.models import (
    FAQ,
    Cart,
    CartItem,
    Category,
    Contact,
    Order,
    OrderItem,
    Payment,
    Product,
    Testimonial,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_khushi")

IMAGE_BASE_URL = "https://raw.githubusercontent.com/jay19patel/Soul-Craft-Studio-khushi/0032fb44f3083c5e06770865cf9290a623e1bdb7/backend/tests/images/"

CATEGORIES_DATA = [
    {
        "name": "Woolen Fashion",
        "image_filename": "cat_fashion.png",
        "description": "Hand-knitted caps, scarves, and fashion accessories made with love.",
        "color": "#FFC0CB" 
    },
    {
        "name": "Creative Keychains",
        "image_filename": "cat_accessories.png",
        "description": "Unique, handmade keychains and charms to personalize your style.",
        "color": "#87CEEB"
    },
    {
        "name": "Handmade Decor",
        "image_filename": "cat_decor.png",
        "description": "Beautiful handcrafted pieces to bring warmth to your home.",
        "color": "#98FB98"
    }
]

PRODUCTS_DATA = [
    {
        "name": "Soulful Tote",
        "category_name": "Woolen Fashion",
        "price": "₹850",
        "price_value": 850.0,
        "tag": "Featured",
        "primary_image": "1.jpeg",
        "gallery_images": ["4.jpeg", "6.jpeg"],
        "description": "A spacious and stylish hand-knitted tote bag, perfect for daily use and fashion statements."
    },
    {
        "name": "Knitted Charm",
        "category_name": "Creative Keychains",
        "price": "₹150",
        "price_value": 150.0,
        "tag": "Best Seller",
        "primary_image": "2.jpeg",
        "gallery_images": ["3.jpeg"],
        "description": "Adorable mini-knitted keychain that adds a touch of personality to your keys or bags."
    },
    {
        "name": "Warm Heart Scarf",
        "category_name": "Woolen Fashion",
        "price": "₹450",
        "price_value": 450.0,
        "tag": "New",
        "primary_image": "5.jpeg",
        "gallery_images": ["7.jpeg"],
        "description": "Ultra-soft woolen scarf designed to keep you cozy during chilly winters while looking chic."
    },
    {
        "name": "Crafty Pouch",
        "category_name": "Handmade Decor",
        "price": "₹280",
        "price_value": 280.0,
        "tag": None,
        "primary_image": "8.jpeg",
        "gallery_images": [],
        "description": "Handcrafted decorative pouch for storing your small treasures or gifting to loved ones."
    },
    {
        "name": "Azure Beanie",
        "category_name": "Woolen Fashion",
        "price": "₹350",
        "price_value": 350.0,
        "tag": "Classic",
        "primary_image": "cat_fashion.png",
        "gallery_images": [],
        "description": "A timeless sky-blue beanie, hand-knitted with premium quality wool for maximum comfort."
    },
    {
        "name": "Handcrafted Keychain",
        "category_name": "Creative Keychains",
        "price": "₹120",
        "price_value": 120.0,
        "tag": None,
        "primary_image": "2.jpeg",
        "gallery_images": [],
        "description": "A simple yet elegant handcrafted keychain, perfect for personal use or as a small gift."
    },
    {
        "name": "Cozy Winter Scarf",
        "category_name": "Woolen Fashion",
        "price": "₹400",
        "price_value": 400.0,
        "tag": "Winter Special",
        "primary_image": "5.jpeg",
        "gallery_images": [],
        "description": "A thick, warm scarf knitted with high-quality yarn to protect you from the winter chill."
    },
    {
        "name": "Flower Bag Charm",
        "category_name": "Creative Keychains",
        "price": "₹180",
        "price_value": 180.0,
        "tag": "Handcrafted",
        "primary_image": "3.jpeg",
        "gallery_images": [],
        "description": "A beautiful flower-shaped accessory to brighten up any handbag or set of keys."
    },
    {
        "name": "Tiny Treasure Pouch",
        "category_name": "Handmade Decor",
        "price": "₹220",
        "price_value": 220.0,
        "tag": "Limited",
        "primary_image": "8.jpeg",
        "gallery_images": [],
        "description": "A small, delicate pouch designed for storing your most precious jewelry or small mementos."
    },
    {
        "name": "Heartfelt Charm",
        "category_name": "Creative Keychains",
        "price": "₹130",
        "price_value": 130.0,
        "tag": "Love",
        "primary_image": "2.jpeg",
        "gallery_images": [],
        "description": "A heart-shaped knitted charm that makes a perfect token of affection for someone special."
    }
]

async def seed():
    logger.info("Initializing database for seeding...")
    models = [
        User, Session, LogEntry, Attachment, Store, Task, Email,
        Category, Product, CartItem, Cart, OrderItem, Order, Payment, FAQ, Testimonial, Contact
    ]
    await init_database(models)

    logger.info("Wiping existing products and categories...")
    await Product.find_all().delete()
    await Category.find_all().delete()
    # Note: We don't wipe attachments to avoid deleting actual files, 
    # but we will create new ones for these seeds.

    # 1. Create Categories
    category_map = {}
    for cat in CATEGORIES_DATA:
        image_url = f"{IMAGE_BASE_URL}{cat['image_filename']}"
        logger.info("Creating category: %s", cat['name'])
        
        # We store the external URL in image_url field as requested
        new_cat = Category(
            name=cat['name'],
            image_url=image_url,
            color=cat['color'],
            description=cat['description']
        )
        await new_cat.insert()
        category_map[cat['name']] = str(new_cat.id)

    # 2. Create Products
    for prod in PRODUCTS_DATA:
        logger.info("Creating product: %s", prod['name'])
        
        # Download and Save Primary Image as Attachment
        primary_link = None
        try:
            primary_url = f"{IMAGE_BASE_URL}{prod['primary_image']}"
            attachment_id = await download_https_url_and_save_as_attachment(primary_url)
            primary_link = build_beanie_link_from_object_id_string(Attachment, attachment_id)
        except Exception as e:
            logger.error("Failed to download primary image for %s: %s", prod['name'], e)

        # Download and Save Gallery Images
        gallery_links = []
        for g_img in prod['gallery_images']:
            try:
                g_url = f"{IMAGE_BASE_URL}{g_img}"
                g_attachment_id = await download_https_url_and_save_as_attachment(g_url)
                gallery_links.append(build_beanie_link_from_object_id_string(Attachment, g_attachment_id))
            except Exception as e:
                logger.error("Failed to download gallery image %s for %s: %s", g_img, prod['name'], e)

        new_prod = Product(
            name=prod['name'],
            price=prod['price'],
            price_value=prod['price_value'],
            tag=prod['tag'],
            description=prod['description'],
            category_id=category_map.get(prod['category_name']),
            primary_image=primary_link,
            gallery_images=gallery_links,
            is_published=True,
            stock=20
        )
        await new_prod.insert()

    logger.info("Seeding complete! Successfully added %d categories and %d products.", len(CATEGORIES_DATA), len(PRODUCTS_DATA))

if __name__ == "__main__":
    asyncio.run(seed())
