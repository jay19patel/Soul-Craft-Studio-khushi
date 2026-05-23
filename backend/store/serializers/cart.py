from rest_framework import serializers
from ..models import Cart, CartItem, ProductVariant
from .product import ProductVariantSerializer, SimpleProductSerializer


class CartItemSerializer(serializers.ModelSerializer):
    variant    = ProductVariantSerializer(read_only=True)
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
