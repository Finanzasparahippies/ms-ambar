import os
import hashlib
import json
import logging
import argparse
from datetime import datetime
from PIL import Image, ImageOps

# -------- CONFIG & ARGUMENTS --------
parser = argparse.ArgumentParser(description="Ms Ambar Premium Image Optimizer")
parser.add_argument("--input", required=True, help="Directory containing images to optimize")
parser.add_argument("--output", default=None, help="Directory to save optimized images (defaults to input dir if --inplace is set)")
parser.add_argument("--quality", type=int, default=75, help="JPEG/WebP quality (1-100, default 75)")
parser.add_argument("--max-size", type=int, default=1920, help="Maximum width or height in pixels (default 1920)")
parser.add_argument("--inplace", action="store_true", help="Optimize images in-place (overwrites original files)")
parser.add_argument("--to-webp", action="store_true", help="Convert images to WebP format")
parser.add_argument("--log-dir", default="logs", help="Directory to store optimization logs")

args = parser.parse_args()

# Set up logging and folders
os.makedirs(args.log_dir, exist_ok=True)
log_filename = datetime.now().strftime("optimize_%Y%m%d_%H%M%S.log")
log_path = os.path.join(args.log_dir, log_filename)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_path),
        logging.StreamHandler()
    ]
)

# Determine output directory
if args.inplace:
    output_dir = args.input
elif args.output:
    output_dir = args.output
    os.makedirs(output_dir, exist_ok=True)
else:
    # Default behavior if neither output nor inplace is specified
    output_dir = "optimizadas"
    os.makedirs(output_dir, exist_ok=True)

# Manifest configuration
MANIFEST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".optimized_manifest.json")

def load_manifest():
    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logging.warning(f"Could not load manifest: {e}. Starting fresh.")
    return {}

def save_manifest(manifest_data):
    try:
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logging.error(f"Could not save manifest: {e}")

def get_file_hash(filepath):
    hasher = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception as e:
        logging.error(f"Error hashing file {filepath}: {e}")
        return None

# Load manifest
manifest = load_manifest()

logging.info("🚀 Starting Ms Ambar Image Optimization Process")
logging.info(f"Input Directory:  {args.input}")
logging.info(f"Output Directory: {output_dir}")
logging.info(f"In-place mode:    {args.inplace}")
logging.info(f"Convert to WebP:  {args.to_webp}")
logging.info(f"Quality target:   {args.quality}")
logging.info(f"Max dimension:    {args.max_size}px")

total_original = 0
total_optimized = 0
skipped_count = 0
optimized_count = 0

# -------- IMAGE PROCESSING LOOP --------
for root, dirs, files in os.walk(args.input):
    relative_root = os.path.relpath(root, args.input)
    
    # Calculate corresponding output folder
    current_output_dir = output_dir if relative_root == "." else os.path.join(output_dir, relative_root)
    os.makedirs(current_output_dir, exist_ok=True)

    for filename in files:
        # Check extensions
        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            continue

        input_path = os.path.join(root, filename)
        
        # Determine output filename and extension
        if args.to_webp:
            output_filename = os.path.splitext(filename)[0] + ".webp"
        else:
            output_filename = filename
            
        output_path = os.path.join(current_output_dir, output_filename)
        
        # Manifest Key: relative path from input directory
        manifest_key = os.path.join(relative_root, filename) if relative_root != "." else filename
        
        # Check if file has already been optimized
        if os.path.exists(output_path):
            output_hash = get_file_hash(output_path)
            if output_hash and manifest.get(manifest_key) == output_hash:
                logging.info(f"⏭️ Skipped (already optimized): {manifest_key}")
                total_original += os.path.getsize(input_path)
                total_optimized += os.path.getsize(output_path)
                skipped_count += 1
                continue

        try:
            original_size = os.path.getsize(input_path)
            total_original += original_size
            
            # Load image using Pillow
            logging.info(f"⚙️ Optimizing: {manifest_key} ({original_size / 1024 / 1024:.2f} MB)")
            img = Image.open(input_path)
            
            # Maintain correct EXIF orientation
            img = ImageOps.exif_transpose(img)
            
            # Resize if dimensions exceed threshold
            width, height = img.size
            if max(width, height) > args.max_size:
                img.thumbnail((args.max_size, args.max_size), Image.Resampling.LANCZOS)
                logging.info(f"   Resized from {width}x{height} to {img.width}x{img.height}")

            # Save image
            save_format = "WEBP" if args.to_webp else img.format
            if save_format == "JPEG" or (save_format is None and ext in [".jpg", ".jpeg"]):
                img.save(output_path, "JPEG", quality=args.quality, optimize=True)
            elif save_format == "PNG" or (save_format is None and ext == ".png"):
                # Optimize PNG palette if converting to 8-bit or standard compression
                img.save(output_path, "PNG", optimize=True)
            elif save_format == "WEBP" or (save_format is None and ext == ".webp"):
                img.save(output_path, "WEBP", quality=args.quality, method=6)
            else:
                # General fallback saving
                img.save(output_path, quality=args.quality, optimize=True)

            optimized_size = os.path.getsize(output_path)
            total_optimized += optimized_size
            optimized_count += 1
            
            # Compute new hash and update manifest
            new_hash = get_file_hash(output_path)
            if new_hash:
                manifest[manifest_key] = new_hash
                save_manifest(manifest)
                
            saved_bytes = original_size - optimized_size
            logging.info(f"   Saved: {original_size/1024:.1f}KB → {optimized_size/1024:.1f}KB (-{saved_bytes/1024:.1f}KB / -{saved_bytes/original_size*100:.1f}%)")

        except Exception as e:
            logging.error(f"💥 Failed to optimize {input_path}: {e}", exc_info=True)

# -------- FINAL REPORT --------
logging.info("📊 ===== IMAGE OPTIMIZATION REPORT =====")
mb_original = total_original / (1024 * 1024)
mb_optimized = total_optimized / (1024 * 1024)
mb_saved = mb_original - mb_optimized
reduction_percent = (1 - total_optimized / total_original) * 100 if total_original > 0 else 0

logging.info(f"Files Processed:   {optimized_count}")
logging.info(f"Files Skipped:     {skipped_count}")
logging.info(f"Original Size:     {mb_original:.2f} MB")
logging.info(f"Optimized Size:    {mb_optimized:.2f} MB")
logging.info(f"Disk Space Saved:  {mb_saved:.2f} MB ({reduction_percent:.1f}% reduction)")
logging.info(f"Log saved at:      {log_path}")
logging.info(f"Manifest updated:  {MANIFEST_PATH}")