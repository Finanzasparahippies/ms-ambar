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

    # Delete 0021 migration file if present in container
    mig_path = os.path.join(os.path.dirname(__file__), 'apps', 'tickets', 'migrations', '0021_remove_seat_color.py')
    if os.path.exists(mig_path):
        os.remove(mig_path)
        print(f"🗑️ Archivo de migración {mig_path} eliminado correctamente.")

if __name__ == '__main__':
    fix_color_column()
