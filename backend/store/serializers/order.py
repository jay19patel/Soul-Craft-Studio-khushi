from rest_framework import serializers
from ..models import Order, OrderItem
from .product import ProductVariantSerializer, SimpleProductSerializer


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
            'id', 'user', 'status', 'payment_status', 'total_amount',
            'shipping_address', 'customer_name', 'customer_email', 'customer_phone',
            'city', 'state', 'pincode', 'payment_reference', 'upi_transaction_id', 'screenshot_id',
            'items', 'created_at', 'updated_at',
            'payment_verified_at', 'processing_at', 'shipped_at', 'delivered_at', 'cancelled_at',
        ]
        read_only_fields = ['user', 'total_amount', 'payment_reference']
