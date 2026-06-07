from decimal import Decimal

from django.core.management.base import BaseCommand

from store.models import Category, Product, ProductImage, ProductVariant, Testimonial


CATEGORIES = [
    {
        "name": "Resin Art",
        "slug": "resin-art",
        "description": "Handcrafted resin pieces with ocean, geode, and floral finishes.",
        "image_url": "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "name": "Aesthetic Soaps",
        "slug": "aesthetic-soaps",
        "description": "Small-batch soaps made for gifting, decor, and daily self-care.",
        "image_url": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "name": "Home Decor",
        "slug": "home-decor",
        "description": "Warm, handmade pieces for shelves, tables, and cozy corners.",
        "image_url": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "name": "Accessories",
        "slug": "accessories",
        "description": "Wearable and giftable handmade accessories.",
        "image_url": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80",
    },
]


PRODUCTS = [
    {
        "category": "resin-art",
        "name": "Ocean Wave Resin Wall Clock",
        "slug": "ocean-wave-resin-wall-clock",
        "description": "A deep blue ocean-inspired wall clock with hand-poured white wave details.",
        "base_price": "2499.00",
        "image_url": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "RES-CLK-OCN-12", "size": "12 Inch", "color": "Ocean Blue", "stock": 15},
            {"sku": "RES-CLK-OCN-16", "size": "16 Inch", "color": "Ocean Blue", "stock": 6, "price_override": "3499.00"},
        ],
    },
    {
        "category": "resin-art",
        "name": "Emerald Geode Serving Tray",
        "slug": "emerald-geode-serving-tray",
        "description": "A glossy emerald green tray accented with gold edges for festive hosting.",
        "base_price": "1850.00",
        "image_url": "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "RES-TRY-EMD-STD", "size": "Standard", "color": "Emerald Green", "stock": 18},
        ],
    },
    {
        "category": "resin-art",
        "name": "Amethyst Coaster Set",
        "slug": "amethyst-coaster-set",
        "description": "A four-piece coaster set with purple geode tones and a gold painted rim.",
        "base_price": "1100.00",
        "image_url": "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "RES-CST-AMY-4", "size": "4 Piece Set", "color": "Purple Gold", "stock": 30},
        ],
    },
    {
        "category": "resin-art",
        "name": "Pressed Flower Resin Bookmark",
        "slug": "pressed-flower-resin-bookmark",
        "description": "A delicate bookmark with preserved botanicals and a soft tassel finish.",
        "base_price": "299.00",
        "image_url": "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "RES-BKM-FLR", "size": "Standard", "color": "Assorted Florals", "stock": 45},
        ],
    },
    {
        "category": "aesthetic-soaps",
        "name": "Lavender Clay Artisan Soap",
        "slug": "lavender-clay-artisan-soap",
        "description": "A calming lavender bar blended with pink clay for a gentle daily cleanse.",
        "base_price": "350.00",
        "image_url": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "SOAP-LAV-120", "size": "120g", "color": "Lavender Pink", "stock": 50},
        ],
    },
    {
        "category": "aesthetic-soaps",
        "name": "Charcoal Citrus Detox Bar",
        "slug": "charcoal-citrus-detox-bar",
        "description": "Activated charcoal with bright citrus notes for a clean, fresh bathing ritual.",
        "base_price": "300.00",
        "image_url": "https://images.unsplash.com/photo-1607006483224-93463de8e717?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "SOAP-CHR-120", "size": "120g", "color": "Charcoal Black", "stock": 42},
        ],
    },
    {
        "category": "aesthetic-soaps",
        "name": "Himalayan Rose Scrub Bar",
        "slug": "himalayan-rose-scrub-bar",
        "description": "A textured scrub bar with rose fragrance and mineral-rich pink salt.",
        "base_price": "400.00",
        "image_url": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "SOAP-HIM-130", "size": "130g", "color": "Rose Pink", "stock": 38},
        ],
    },
    {
        "category": "home-decor",
        "name": "Minimalist Ceramic Vase",
        "slug": "minimalist-ceramic-vase",
        "description": "A matte ceramic vase for dried flowers, pampas, or a clean shelf styling moment.",
        "base_price": "1299.00",
        "image_url": "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "DEC-VAS-WHT-M", "size": "Medium", "color": "Matte White", "stock": 25},
        ],
    },
    {
        "category": "home-decor",
        "name": "Macrame Wall Hanging",
        "slug": "macrame-wall-hanging",
        "description": "A boho wall hanging made with natural cotton cord and layered knotwork.",
        "base_price": "1599.00",
        "image_url": "https://images.unsplash.com/photo-1515546200212-07a8fc5d4ec3?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "DEC-MAC-LRG", "size": "Large", "color": "Natural Beige", "stock": 10},
        ],
    },
    {
        "category": "accessories",
        "name": "Floral Resin Pendant",
        "slug": "floral-resin-pendant",
        "description": "A lightweight pendant with tiny preserved flowers sealed in crystal-clear resin.",
        "base_price": "699.00",
        "image_url": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80",
        "variants": [
            {"sku": "ACC-PND-FLR", "size": "Adjustable Chain", "color": "Clear Floral", "stock": 22},
        ],
    },
]


TESTIMONIALS = [
    {
        "name": "Priya Shah",
        "role": "Repeat Customer",
        "content": "The resin tray looked even better in person. Packaging was neat and gifting-ready.",
        "rating": 5,
        "image_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    },
    {
        "name": "Aarav Mehta",
        "role": "Home Decor Buyer",
        "content": "The clock became the highlight of our living room. Beautiful color work and finish.",
        "rating": 5,
        "image_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    },
    {
        "name": "Nisha Patel",
        "role": "Soap Lover",
        "content": "The soaps smell lovely and feel gentle. I ordered extra for festive hampers.",
        "rating": 5,
        "image_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80",
    },
    {
        "name": "Rohan Desai",
        "role": "Gift Buyer",
        "content": "Fast response, careful packing, and the handmade detailing feels premium.",
        "rating": 4,
        "image_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    },
]


class Command(BaseCommand):
    help = "Seed starter categories, products, variants, images, and testimonials."

    def handle(self, *args, **options):
        categories = {}
        for item in CATEGORIES:
            category, _ = Category.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "name": item["name"],
                    "description": item["description"],
                    "image_url": item["image_url"],
                },
            )
            categories[item["slug"]] = category

        for item in PRODUCTS:
            product, _ = Product.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "category": categories[item["category"]],
                    "name": item["name"],
                    "description": item["description"],
                    "base_price": Decimal(item["base_price"]),
                    "is_active": True,
                },
            )
            ProductImage.objects.update_or_create(
                product=product,
                is_primary=True,
                defaults={"image_url": item["image_url"]},
            )
            for variant_item in item["variants"]:
                price_override = variant_item.get("price_override")
                ProductVariant.objects.update_or_create(
                    sku=variant_item["sku"],
                    defaults={
                        "product": product,
                        "size": variant_item["size"],
                        "color": variant_item["color"],
                        "stock": variant_item["stock"],
                        "price_override": Decimal(price_override) if price_override else None,
                    },
                )

        for item in TESTIMONIALS:
            Testimonial.objects.update_or_create(
                name=item["name"],
                defaults={
                    "role": item["role"],
                    "content": item["content"],
                    "rating": item["rating"],
                    "image_url": item["image_url"],
                    "is_active": True,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(CATEGORIES)} categories, {len(PRODUCTS)} products, "
                f"and {len(TESTIMONIALS)} testimonials."
            )
        )
