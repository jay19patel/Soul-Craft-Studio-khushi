import os
import django
from decimal import Decimal

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ecommerce.settings")
django.setup()

from store.models import Category, Product, ProductVariant, ProductImage

def seed_data():
    print("Clearing existing catalog data...")
    ProductImage.objects.all().delete()
    ProductVariant.objects.all().delete()
    Product.objects.all().delete()
    Category.objects.all().delete()

    print("Creating Categories...")
    # Category 1: Resin Art
    cat_resin = Category.objects.create(
        name="Resin Art",
        slug="resin-art",
        description="Handcrafted exquisite resin masterpieces.",
        image_url="https://images.unsplash.com/photo-1544965850-6f81e35a1130?auto=format&fit=crop&w=800&q=80"
    )

    # Category 2: Handcrafted Soaps
    cat_soaps = Category.objects.create(
        name="Aesthetic Soaps",
        slug="aesthetic-soaps",
        description="Organic, beautifully scented handmade soaps.",
        image_url="https://images.unsplash.com/photo-1600857062241-98e5dba7f214?auto=format&fit=crop&w=800&q=80"
    )

    # Category 3: Home Decor
    cat_decor = Category.objects.create(
        name="Home Decor",
        slug="home-decor",
        description="Elevate your living space with our unique pieces.",
        image_url="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80"
    )

    print("Creating Products...")
    
    # --- Product 1 ---
    prod1 = Product.objects.create(
        category=cat_resin,
        name="Ocean Wave Resin Wall Clock",
        slug="ocean-wave-resin-clock",
        description="A mesmerizing wall clock featuring deep ocean blues and crashing white waves, handcrafted using premium epoxy resin.",
        base_price=Decimal("2499.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod1,
        image_url="https://images.unsplash.com/photo-1584285461230-1c71dddb2554?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod1, sku="RES-CLK-OCN-12", size="12 Inch", color="Ocean Blue", stock=15
    )
    ProductVariant.objects.create(
        product=prod1, sku="RES-CLK-OCN-16", size="16 Inch", color="Ocean Blue", price_override=Decimal("3499.00"), stock=5
    )

    # --- Product 2 ---
    prod2 = Product.objects.create(
        category=cat_resin,
        name="Emerald Geode Serving Tray",
        slug="emerald-geode-tray",
        description="Serve your guests in style with this stunning emerald green geode-inspired tray, accented with gold leaf.",
        base_price=Decimal("1850.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod2,
        image_url="https://images.unsplash.com/photo-1576088235332-9ecb5bc08b5e?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod2, sku="RES-TRY-EMD", size="Standard", color="Emerald Green", stock=20
    )

    # --- Product 3 ---
    prod3 = Product.objects.create(
        category=cat_soaps,
        name="Lavender & Clay Artisan Soap",
        slug="lavender-clay-soap",
        description="Calming lavender essential oil blended with French pink clay. Gentle on the skin and a treat for the senses.",
        base_price=Decimal("350.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod3,
        image_url="https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod3, sku="SOP-LAV-CLY", size="120g", color="Pink/Purple", stock=50
    )

    # --- Product 4 ---
    prod4 = Product.objects.create(
        category=cat_soaps,
        name="Charcoal Citrus Detox Bar",
        slug="charcoal-citrus-soap",
        description="Activated charcoal for deep cleansing, infused with uplifting sweet orange and lemon oils.",
        base_price=Decimal("300.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod4,
        image_url="https://images.unsplash.com/photo-1610484826967-09c5720778c7?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod4, sku="SOP-CHR-CTR", size="120g", color="Charcoal Black", stock=40
    )

    # --- Product 5 ---
    prod5 = Product.objects.create(
        category=cat_decor,
        name="Minimalist Ceramic Vase",
        slug="minimalist-ceramic-vase",
        description="A sleek, modern ceramic vase with a matte finish. Perfect for dried pampas grass or fresh blooms.",
        base_price=Decimal("1299.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod5,
        image_url="https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod5, sku="DCR-VAS-WHT", size="Medium", color="Matte White", stock=25
    )

    # --- Product 6 ---
    prod6 = Product.objects.create(
        category=cat_decor,
        name="Macrame Wall Hanging",
        slug="macrame-wall-hanging",
        description="Boho-chic woven wall art made from 100% natural cotton cord, featuring intricate knot patterns.",
        base_price=Decimal("1599.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod6,
        image_url="https://images.unsplash.com/photo-1515546200212-07a8fc5d4ec3?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod6, sku="DCR-MAC-WHL", size="Large", color="Natural Beige", stock=10
    )

    # --- Product 7 ---
    prod7 = Product.objects.create(
        category=cat_resin,
        name="Amethyst Coaster Set (4 pcs)",
        slug="amethyst-coaster-set",
        description="Set of 4 luxury coasters with amethyst purple hues and a striking gold painted rim.",
        base_price=Decimal("1100.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod7,
        image_url="https://images.unsplash.com/photo-1620063640032-474be6ab000a?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod7, sku="RES-CST-AMY-4", size="4-Piece Set", color="Purple/Gold", stock=30
    )

    # --- Product 8 ---
    prod8 = Product.objects.create(
        category=cat_soaps,
        name="Himalayan Salt Scrub Bar",
        slug="himalayan-salt-scrub",
        description="Exfoliating bar packed with pink Himalayan salt and moisturizing shea butter.",
        base_price=Decimal("400.00"),
        is_active=True
    )
    ProductImage.objects.create(
        product=prod8,
        image_url="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
        is_primary=True
    )
    ProductVariant.objects.create(
        product=prod8, sku="SOP-HIM-SCR", size="130g", color="Pink", stock=45
    )

    print("Successfully seeded catalog data!")

if __name__ == '__main__':
    seed_data()
