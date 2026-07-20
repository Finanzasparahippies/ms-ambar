import os
import shutil

base_dir = "/home/saul/Documentos/Proyectos/ms-ambar/frontend/public"
target_dirs = ["logos", "Images"]

for target_dir in target_dirs:
    dir_path = os.path.join(base_dir, target_dir)
    if not os.path.exists(dir_path):
        continue
    
    print(f"Refreshing files in: {dir_path}")
    for filename in os.listdir(dir_path):
        # Only refresh standard files
        src_path = os.path.join(dir_path, filename)
        if os.path.isfile(src_path) and not filename.endswith(".tmp") and not filename.startswith("."):
            temp_path = src_path + ".tmp"
            try:
                # Copy to temp
                shutil.copy2(src_path, temp_path)
                # Remove original
                os.remove(src_path)
                # Copy back (creating a new file with the inherited container SELinux context)
                shutil.copy(temp_path, src_path)
                # Remove temp
                os.remove(temp_path)
                # Set permissions to read-only for others
                os.chmod(src_path, 0o644)
                print(f"  Successfully refreshed context for: {filename}")
            except Exception as e:
                print(f"  Error refreshing {filename}: {e}")
