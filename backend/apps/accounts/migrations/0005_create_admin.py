from django.db import migrations

def create_admin(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    if not User.objects.filter(username="admin").exists():
        User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="StrongPassword123"
        )

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_auto_20260325_1703'),
    ]

    operations = [
        migrations.RunPython(create_admin),
    ]