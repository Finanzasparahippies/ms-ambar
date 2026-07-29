import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

def fix_color_column():
    with connection.cursor() as cursor:
        cursor.execute("ALTER TABLE tickets_seat ADD COLUMN IF NOT EXISTS color varchar(50) DEFAULT '';")
        cursor.execute("DELETE FROM django_migrations WHERE app='tickets' AND name='0021_remove_seat_color';")
    print("✅ Columna 'color' restablecida en la tabla tickets_seat de PostgreSQL.")

if __name__ == '__main__':
    fix_color_column()
