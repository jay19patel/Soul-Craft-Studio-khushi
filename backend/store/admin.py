from django.contrib import admin
from .models import (
    Category, Product, ProductVariant, ProductImage, Cart, CartItem, 
    Order, OrderItem, Address, Contact, Payment, Testimonial, ContactMessage,
    EmailLog
)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'parent', 'created_at']
    list_filter = ['parent']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'category', 'base_price', 'is_active', 'created_at']
    list_filter = ['is_active', 'category']
    search_fields = ['name', 'description', 'slug']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductImageInline, ProductVariantInline]

class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0

@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'session_id', 'created_at', 'updated_at']
    search_fields = ['session_id']
    inlines = [CartItemInline]

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'payment_reference', 'user', 'status', 'total_amount', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__username', 'shipping_address', 'payment_reference', 'upi_transaction_id']
    inlines = [OrderItemInline]

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'full_name', 'city', 'state', 'is_default']
    list_filter = ['is_default', 'state', 'city']
    search_fields = ['full_name', 'city', 'pincode']

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'phone_number', 'is_default', 'created_at']
    list_filter = ['is_default', 'created_at']
    search_fields = ['phone_number', 'user__username']

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'payment_reference', 'user', 'order', 'amount', 'status', 'submitted_at']
    list_filter = ['status', 'submitted_at']
    search_fields = ['user__username', 'order__id', 'payment_reference', 'upi_transaction_id']

@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'role', 'rating', 'is_active', 'created_at']
    list_filter = ['is_active', 'rating', 'created_at']
    search_fields = ['name', 'content']

@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'email', 'subject', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    search_fields = ['name', 'email', 'subject', 'message']

@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'email_type', 'to_email', 'subject', 'status', 'attempts', 'queued_at', 'sent_at']
    list_filter = ['status', 'email_type', 'queued_at', 'sent_at']
    search_fields = ['to_email', 'from_email', 'subject', 'error_message']
    readonly_fields = [
        'email_type', 'status', 'subject', 'from_email', 'to_email',
        'body_text', 'body_html', 'backend', 'user', 'order',
        'attachment_name', 'attachment_mimetype', 'attempts', 'error_message',
        'queued_at', 'sending_at', 'sent_at', 'failed_at',
    ]
    actions = ['retry_selected_emails']

    @admin.action(description='Retry selected non-sent emails')
    def retry_selected_emails(self, request, queryset):
        from .tasks import send_queued_email

        retryable = queryset.exclude(status=EmailLog.Status.SENT)
        count = 0
        for email_log in retryable:
            email_log.status = EmailLog.Status.QUEUED
            email_log.error_message = ''
            email_log.save(update_fields=['status', 'error_message'])
            send_queued_email.delay(email_log.pk)
            count += 1
        self.message_user(request, f'{count} email(s) queued for retry.')

# Custom admin site grouping
original_get_app_list = admin.site.get_app_list

def custom_get_app_list(self, request, app_label=None):
    app_dict = self._build_app_dict(request)
    
    # Define custom groups and their models
    groups = {
        'Customer Management': ['Users', 'Addresses', 'Contacts'],
        'Catalog': ['Categories', 'Products'],
        'Sales & Orders': ['Carts', 'Orders', 'Payments'],
        'Support & Feedback': ['Contact messages', 'Testimonials'],
        'Email Delivery': ['Email logs'],
    }
    
    new_app_list = []
    
    for group_name, model_names in groups.items():
        models_in_group = []
        for app in app_dict.values():
            for model in app['models']:
                if model['name'] in model_names:
                    models_in_group.append(model)
        
        if models_in_group:
            new_app_list.append({
                'name': group_name,
                'app_label': group_name.lower().replace(' & ', '_').replace(' ', '_'),
                'app_url': '',
                'has_module_perms': True,
                'models': models_in_group,
            })
            
    # Add any remaining models that weren't explicitly grouped
    grouped_model_names = [m for sublist in groups.values() for m in sublist]
    other_models = []
    
    for app in app_dict.values():
        for model in app['models']:
            if model['name'] not in grouped_model_names:
                other_models.append(model)
                
    if other_models:
        new_app_list.append({
            'name': 'Other Settings',
            'app_label': 'other_settings',
            'app_url': '',
            'has_module_perms': True,
            'models': other_models,
        })
        
    return new_app_list

admin.site.get_app_list = custom_get_app_list.__get__(admin.site, admin.site.__class__)
