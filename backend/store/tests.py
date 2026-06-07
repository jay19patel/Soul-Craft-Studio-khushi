from django.test import TestCase
from django.contrib.auth.models import User
from django.core import mail
from django.test import override_settings
from rest_framework.test import APIClient

from .models import Category, EmailLog, Order, Product, ProductVariant
from .utils import send_order_status_email, send_payment_status_email, send_welcome_email


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class EmailQueueTests(TestCase):
    def test_welcome_email_is_logged_and_delivered_by_task(self):
        user = User.objects.create_user(
            username='new@example.com',
            email='new@example.com',
            password='secure-password',
        )

        with self.captureOnCommitCallbacks(execute=True):
            send_welcome_email(user)

        email_log = EmailLog.objects.get()
        self.assertEqual(email_log.email_type, EmailLog.EmailType.WELCOME)
        self.assertEqual(email_log.status, EmailLog.Status.SENT)
        self.assertEqual(email_log.to_email, 'new@example.com')
        self.assertEqual(email_log.attempts, 1)
        self.assertIsNotNone(email_log.sent_at)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['new@example.com'])

    def test_order_checkout_normalizes_status_and_attaches_pdf_invoice(self):
        user = User.objects.create_user(
            username='customer@example.com',
            email='customer@example.com',
            password='secure-password',
        )
        category = Category.objects.create(name='Home', slug='home')
        product = Product.objects.create(
            category=category,
            name='Artisan Soap',
            slug='artisan-soap',
            description='Handmade',
            base_price='249.00',
        )
        ProductVariant.objects.create(
            product=product,
            sku='SOAP-ONE',
            size='120g',
            stock=3,
        )
        client = APIClient()
        client.force_authenticate(user)

        with self.captureOnCommitCallbacks(execute=True):
            response = client.post('/api/orders/', {
                'customer_name': 'Customer',
                'customer_email': user.email,
                'shipping_address': 'Main Street',
                'total_amount': '249.00',
                'status': 'pending',
                'payment_status': 'received',
                'upi_transaction_id': 'UPI-TEST-249',
                'items': [{'product_id': product.pk, 'quantity': 1, 'price': '249.00'}],
            }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertEqual(response.data['payment_status'], 'RECEIVED')
        self.assertEqual(response.data['payment_reference'], f"PAY-SCS-{response.data['id']:06d}")
        self.assertEqual(response.data['upi_transaction_id'], 'UPI-TEST-249')
        email_log = EmailLog.objects.get(email_type=EmailLog.EmailType.ORDER_CONFIRMATION)
        self.assertEqual(email_log.status, EmailLog.Status.SENT)
        self.assertEqual(email_log.attachment_name, f"Soul-Craft-Studio-Invoice-{response.data['id']}.pdf")
        self.assertGreater(len(email_log.attachment_data), 100)

    def test_status_and_payment_notifications_do_not_attach_invoice(self):
        user = User.objects.create_user(
            username='updates@example.com',
            email='updates@example.com',
            password='secure-password',
        )
        order = Order.objects.create(
            user=user,
            customer_name='Updates Customer',
            customer_email=user.email,
            shipping_address='Main Street',
            total_amount='149.00',
            status='PROCESSING',
            payment_status='VERIFIED',
        )

        with self.captureOnCommitCallbacks(execute=True):
            send_order_status_email(order)
            send_payment_status_email(order)

        update_logs = EmailLog.objects.filter(
            email_type__in=[EmailLog.EmailType.ORDER_STATUS, EmailLog.EmailType.PAYMENT_STATUS]
        )
        self.assertEqual(update_logs.count(), 2)
        for email_log in update_logs:
            self.assertEqual(email_log.attachment_name, '')
            self.assertIsNone(email_log.attachment_data)
            self.assertEqual(email_log.attachment_mimetype, '')
