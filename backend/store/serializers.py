from rest_framework import serializers
from .models import (
    Category, Product, ProductVariant, ProductImage, 
    Cart, CartItem, Order, OrderItem, Payment, Testimonial,
    Address, Contact, ContactMessage
)

class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'image_url', 'parent', 'children', 'created_at', 'updated_at']

    def get_children(self, obj):
        # Retrieve child categories
        children = obj.children.all()
        return CategorySerializer(children, many=True).data

class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ['user']

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'
        read_only_fields = ['user']

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image_url', 'is_primary']

class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ['id', 'sku', 'size', 'color', 'price_override', 'stock']

class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True
    )
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    price_value = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    price = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'description', 'base_price', 'price_value', 'price', 'is_active',
            'category', 'category_id', 'images', 'primary_image', 'variants', 'created_at', 'updated_at'
        ]

    def get_price(self, obj):
        return f"₹{obj.base_price}"
    
    def get_primary_image(self, obj):
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            return primary.image_url
        first = obj.images.first()
        if first:
            return first.image_url
        return None

class SimpleProductSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'primary_image']
    def get_primary_image(self, obj):
        primary = obj.images.filter(is_primary=True).first()
        return primary.image_url if primary else (obj.images.first().image_url if obj.images.first() else None)

class CartItemSerializer(serializers.ModelSerializer):
    variant = ProductVariantSerializer(read_only=True)
    variant_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductVariant.objects.all(), source='variant', write_only=True
    )
    product = SimpleProductSerializer(source='variant.product', read_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'variant', 'variant_id', 'product', 'quantity']

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ['id', 'user', 'session_id', 'items', 'created_at', 'updated_at']

class OrderItemSerializer(serializers.ModelSerializer):
    variant = ProductVariantSerializer(read_only=True)
    product = SimpleProductSerializer(source='variant.product', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'variant', 'product', 'quantity', 'price']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'status', 'payment_status', 'total_amount', 'shipping_address', 
            'customer_name', 'customer_email', 'customer_phone', 
            'city', 'state', 'pincode', 'payment_id', 'screenshot_id',
            'items', 'created_at', 'updated_at',
            'payment_verified_at', 'processing_at', 'shipped_at', 'delivered_at', 'cancelled_at'
        ]
        read_only_fields = ['user', 'total_amount']

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['user', 'submitted_at', 'received_at', 'confirmed_at', 'created_at']

class TestimonialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Testimonial
        fields = '__all__'

class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = '__all__'
