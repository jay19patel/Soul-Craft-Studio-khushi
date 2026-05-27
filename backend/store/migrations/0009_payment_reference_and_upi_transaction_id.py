from django.db import migrations, models


def populate_payment_fields(apps, schema_editor):
    Order = apps.get_model("store", "Order")
    Payment = apps.get_model("store", "Payment")

    for order in Order.objects.all().iterator():
        reference = f"PAY-SCS-{order.pk:06d}"
        Order.objects.filter(pk=order.pk).update(payment_reference=reference)
        Payment.objects.filter(order_id=order.pk).update(
            payment_reference=reference,
            upi_transaction_id=order.upi_transaction_id,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0008_normalize_order_status_values"),
    ]

    operations = [
        migrations.RenameField(
            model_name="order",
            old_name="payment_id",
            new_name="upi_transaction_id",
        ),
        migrations.AddField(
            model_name="order",
            name="payment_reference",
            field=models.CharField(blank=True, editable=False, max_length=40, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="payment_reference",
            field=models.CharField(blank=True, max_length=40, null=True),
        ),
        migrations.AddField(
            model_name="payment",
            name="upi_transaction_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RunPython(populate_payment_fields, migrations.RunPython.noop),
    ]
