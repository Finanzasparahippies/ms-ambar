from PIL import Image
import os
import shutil

# Configuración
logo_file = "/home/saul/Documentos/Proyectos/ms-ambar/frontend/public/logos/ms_ambar_monograma_b.png"
output_dir = "icons_b"
public_dir = "/home/saul/Documentos/Proyectos/ms-ambar/frontend/public"

# Crear carpeta de salida si no existe
os.makedirs(output_dir, exist_ok=True)

# Cargar imagen de origen
print(f"Abriendo archivo de origen: {logo_file}")
try:
    img = Image.open(logo_file)
except Exception as e:
    print(f"Error al abrir la imagen {logo_file}: {e}")
    exit(1)

# 1️⃣ Generar favicon.ico con múltiples tamaños
ico_sizes = [16, 32, 48, 64]
ico_path = os.path.join(output_dir, "favicon.ico")

# Crear versiones redimensionadas para cada tamaño
ico_imgs = []
for size in ico_sizes:
    ico_imgs.append(img.resize((size, size), Image.Resampling.LANCZOS))

# Guardar como ICO
ico_imgs[0].save(ico_path, format="ICO", append_images=ico_imgs[1:])
print(f"Favicon generado en scripts/icons: {ico_path}")

# 2️⃣ Generar PNGs para móviles y pantallas retina
png_sizes = [192, 256, 512]
for size in png_sizes:
    png_path = os.path.join(output_dir, f"icon-{size}x{size}.png")
    resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
    resized_img.save(png_path)
    print(f"PNG generado en scripts/icons: {png_path}")

# 3️⃣ Copiar los íconos generados a frontend/public/
shutil.copy(ico_path, os.path.join(public_dir, "favicon.ico"))
for size in png_sizes:
    shutil.copy(
        os.path.join(output_dir, f"icon-{size}x{size}.png"),
        os.path.join(public_dir, f"icon-{size}x{size}.png")
    )
print("Todos los íconos generados y copiados a frontend/public con éxito.")

