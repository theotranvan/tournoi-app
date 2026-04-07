from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0004_fix_license_default_inactive"),
    ]

    operations = [
        migrations.CreateModel(
            name="StripeEvent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "event_id",
                    models.CharField(
                        db_index=True, max_length=255, unique=True
                    ),
                ),
                ("event_type", models.CharField(max_length=100)),
                ("processed_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "subscriptions_stripe_event",
            },
        ),
    ]
