import os
import shutil

logos_dir = "/home/saul/Documentos/Proyectos/ms-ambar/frontend/public/logos"
files = [
    "ms_ambar_logo_b.png",
    "ms_ambar_logo_n.png",
    "ms_ambar_monograma_b.png",
    "ms_ambar_monograma_n.png"
]

for filename in files:
    src_path = os.path.join(logos_dir, filename)
    if os.path.exists(src_path):
        temp_path = src_path + ".tmp"
        # Copy to temp
        shutil.copy2(src_path, temp_path)
        # Remove original
        os.remove(src_path)
        # Copy back (this creates a new file which inherits destination SELinux context!)
        shutil.copy(temp_path, src_path)
        # Remove temp
        os.remove(temp_path)
        # Set permissions
        os.chmod(src_path, 0o644)
        print(f"Refreshed SELinux context for: {filename}")
    else:
        print(f"File not found: {filename}")
