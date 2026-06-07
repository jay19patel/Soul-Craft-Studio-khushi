from django.db import migrations


def normalize_status_values(apps, schema_editor):
    Order = apps.get_model("store", "Order")
    for value in ("PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"):
        Order.objects.filter(status=value.lower()).update(status=value)
    for value in ("PENDING", "RECEIVED", "VERIFIED", "FAILED"):
        Order.objects.filter(payment_status=value.lower()).update(payment_status=value)


class Migration(migrations.Migration):

    dependencies = [
        ("store", "0007_alter_address_options_emaillog"),
    ]

    operations = [
        migrations.RunPython(normalize_status_values, migrations.RunPython.noop),
    ]
