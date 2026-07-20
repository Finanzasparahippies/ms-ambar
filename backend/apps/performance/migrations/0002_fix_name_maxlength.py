# Nectar Labs — Fix: PerformanceMetric.name was varchar(10) from old choices field.
# Next.js emits metric names like 'Next.js-hydration' (16 chars) and
# 'Next.js-route-change-to-render' (30 chars) which exceed the original limit.
# This migration expands the column to match the model's max_length=50.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('performance', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancemetric',
            name='name',
            field=models.CharField(max_length=50),
        ),
    ]
