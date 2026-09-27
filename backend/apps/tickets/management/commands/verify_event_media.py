"""
Comando de Management: verify_event_media
==========================================
Audita y valida la existencia de medios físicos (flyer, imagen) en Cloudinary
para eventos en ms-ambar. Diagnostica 404s, identifica public_ids reales y
ofrece auto-reparación (--fix) en la base de datos.

Uso:
    python manage.py verify_event_media
    python manage.py verify_event_media --all
    python manage.py verify_event_media --fix
"""

import os
import re
from typing import List, Optional, Tuple, Dict, Any
from django.core.management.base import BaseCommand
from django.conf import settings
from apps.tickets.models import Event
import cloudinary
import cloudinary.api
import cloudinary.utils
import cloudinary.exceptions


class Command(BaseCommand):
    help = "Inspecciona eventos y valida la existencia física de sus flyers e imágenes en Cloudinary."

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Inspecciona todos los eventos (por defecto solo eventos con is_active=True).',
        )
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Si el recurso existe en Cloudinary con otro public_id o extensión, repara el registro en la BD.',
        )
        parser.add_argument(
            '--cloud-name',
            type=str,
            default='',
            help='Sobrescribe CLOUDINARY_CLOUD_NAME para esta ejecución.',
        )
        parser.add_argument(
            '--api-key',
            type=str,
            default='',
            help='Sobrescribe CLOUDINARY_API_KEY para esta ejecución.',
        )
        parser.add_argument(
            '--api-secret',
            type=str,
            default='',
            help='Sobrescribe CLOUDINARY_API_SECRET para esta ejecución.',
        )

    def handle(self, *args, **options):
        check_all = options.get('all', False)
        auto_fix = options.get('fix', False)

        self.stdout.write(self.style.MIGRATE_HEADING("═════════════════════════════════════════════════════════════════════════"))
        self.stdout.write(self.style.MIGRATE_HEADING("  NÉCTAR LABS • AUDITORÍA DE MEDIOS CLOUDINARY (MS-AMBAR)"))
        self.stdout.write(self.style.MIGRATE_HEADING("═════════════════════════════════════════════════════════════════════════\n"))

        # 1. Validar configuración de Cloudinary
        cld_config = getattr(settings, 'CLOUDINARY_STORAGE', {})
        cloud_name = options.get('cloud_name') or cld_config.get('CLOUD_NAME', '')
        api_key = options.get('api_key') or cld_config.get('API_KEY', '')
        api_secret = options.get('api_secret') or cld_config.get('API_SECRET', '')
        env_prefix = cld_config.get('PREFIX', '')

        has_cld_api = bool(cloud_name and api_key and api_secret and cloud_name != 'your_cloudinary_name')

        if has_cld_api:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True
            )

        self.stdout.write(f"[*] Cloud Name: {cloud_name or 'NO CONFIGURADO'}")
        self.stdout.write(f"[*] Entorno Prefix: {env_prefix or '(vacío)'}")
        self.stdout.write(f"[*] Conexión API Cloudinary: {'ACTIVA' if has_cld_api else 'OFFLINE (Solo inspección local de BD)'}")
        self.stdout.write(f"[*] Modo Auto-Fix: {'HABILITADO' if auto_fix else 'DESHABILITADO'}\n")

        if not has_cld_api:
            self.stdout.write(self.style.WARNING(
                "[!] Advertencia: Credenciales remotas de Cloudinary no configuradas en este entorno.\n"
                "    Se auditarán las rutas guardadas en BD y candidatos de URL, pero no se consultará la API remota.\n"
            ))

        # 2. Consultar eventos
        qs = Event.objects.all().order_by('-is_active', '-date')
        if not check_all:
            qs = qs.filter(is_active=True)

        events_count = qs.count()
        if events_count == 0:
            self.stdout.write(self.style.WARNING("[-] No se encontraron eventos para inspeccionar."))
            return

        self.stdout.write(f"[*] Inspeccionando {events_count} evento(s)...\n")

        total_inspected = 0
        total_ok = 0
        total_missing = 0
        total_fixed = 0

        for event in qs:
            total_inspected += 1
            status_tag = "[ACTIVO]" if event.is_active else "[INACTIVO]"
            self.stdout.write(self.style.SUCCESS(f"\n▶ Evento #{event.id}: {event.title} {status_tag}"))
            self.stdout.write(f"  Fecha: {event.date} | Tipo: {event.event_type}")

            # Inspeccionar Flyer
            flyer_val = getattr(event.flyer, 'name', None) or str(event.flyer or '')
            self.stdout.write(f"  • Campo 'flyer' en BD: '{flyer_val}'")

            if not flyer_val:
                self.stdout.write(self.style.WARNING("    ⚠ El evento no tiene flyer asignado."))
            else:
                ok, found_id, resource_info, candidate_tried = self._check_asset_in_cloudinary(
                    flyer_val, env_prefix, folder_hint="event_flyers", has_cld_api=has_cld_api
                )

                if not has_cld_api:
                    self.stdout.write(self.style.NOTICE("    ℹ Candidatos generados para resolución de URL:"))
                    for c in candidate_tried:
                        self.stdout.write(f"        - {c}")
                elif ok and resource_info:
                    total_ok += 1
                    secure_url = resource_info.get('secure_url', '')
                    fmt = resource_info.get('format', 'unknown')
                    bytes_size = resource_info.get('bytes', 0)
                    w = resource_info.get('width', 0)
                    h = resource_info.get('height', 0)
                    self.stdout.write(self.style.SUCCESS(
                        f"    ✔ CLOUDINARY 200 OK: public_id='{found_id}' [{w}x{h} px, {fmt.upper()}, {bytes_size} bytes]"
                    ))
                    self.stdout.write(f"      URL Segura: {secure_url}")

                    # Si el public_id encontrado difiere del string en BD y --fix está activo
                    if auto_fix and found_id and found_id != flyer_val:
                        event.flyer = found_id
                        event.save(update_fields=['flyer'])
                        total_fixed += 1
                        self.stdout.write(self.style.NOTICE(f"      [AUTO-FIX] BD actualizada con public_id='{found_id}'"))
                else:
                    total_missing += 1
                    self.stdout.write(self.style.ERROR(
                        f"    ✖ HTTP 404 NOT FOUND: No se localizó en Cloudinary bajo los candidatos:"
                    ))
                    for c in candidate_tried:
                        self.stdout.write(f"        - {c}")

                    # Búsqueda difusa en la carpeta de flyers de Cloudinary
                    suggestions = self._search_folder_assets(env_prefix, "event_flyers")
                    if suggestions:
                        self.stdout.write(self.style.NOTICE("    🔍 Assets existentes en la carpeta de Cloudinary:"))
                        for s in suggestions[:10]:
                            self.stdout.write(f"        * public_id: {s.get('public_id')} ({s.get('format')}, {s.get('bytes')} B)")

                        # Si hay coincidencia evidente y --fix
                        if auto_fix and suggestions:
                            matched = self._find_best_match(flyer_val, suggestions)
                            if matched:
                                best_id = matched['public_id']
                                event.flyer = best_id
                                event.save(update_fields=['flyer'])
                                total_fixed += 1
                                self.stdout.write(self.style.SUCCESS(
                                    f"      [AUTO-FIX HEAL] Coincidencia encontrada y aplicada: '{best_id}'"
                                ))

            # Inspeccionar Imagen secundaria (si tiene)
            img_val = getattr(event.image, 'name', None) or str(event.image or '')
            if img_val:
                self.stdout.write(f"  • Campo 'image' en BD: '{img_val}'")
                img_ok, img_found_id, img_info, _ = self._check_asset_in_cloudinary(
                    img_val, env_prefix, folder_hint="events"
                )
                if img_ok and img_info:
                    self.stdout.write(self.style.SUCCESS(
                        f"    ✔ Imagen 200 OK: public_id='{img_found_id}'"
                    ))
                else:
                    self.stdout.write(self.style.WARNING(
                        f"    ✖ Imagen 404 en Cloudinary para '{img_val}'"
                    ))

        # 3. Resumen final
        self.stdout.write(self.style.MIGRATE_HEADING("\n═════════════════════════════════════════════════════════════════════════"))
        self.stdout.write(self.style.MIGRATE_HEADING("  RESUMEN DE AUDITORÍA"))
        self.stdout.write(self.style.MIGRATE_HEADING("═════════════════════════════════════════════════════════════════════════"))
        self.stdout.write(f"  • Eventos inspeccionados: {total_inspected}")
        self.stdout.write(self.style.SUCCESS(f"  • Flyers verificados en Cloudinary: {total_ok}"))
        if total_missing > 0:
            self.stdout.write(self.style.ERROR(f"  • Flyers 404 / Desaparecidos: {total_missing}"))
        if total_fixed > 0:
            self.stdout.write(self.style.NOTICE(f"  • Registros reparados (--fix): {total_fixed}"))
        self.stdout.write("═════════════════════════════════════════════════════════════════════════\n")

    def _generate_candidate_public_ids(self, raw_val: str, prefix: str, folder_hint: str) -> List[str]:
        candidates = []
        cleaned = raw_val.strip()

        # Si ya es una URL completa, extraer el public_id
        if 'https://res.cloudinary.com' in cleaned or 'http://res.cloudinary.com' in cleaned:
            # extraer todo después de /upload/(v\d+/)?
            m = re.search(r'/upload/(?:v\d+/)?(.+)$', cleaned)
            if m:
                extracted = m.group(1)
                candidates.append(extracted)
                base, _ = os.path.splitext(extracted)
                candidates.append(base)

        # Candidato directo tal como está en BD
        candidates.append(cleaned)

        # Sin extensión
        base_no_ext, ext = os.path.splitext(cleaned)
        if ext:
            candidates.append(base_no_ext)

        # Con prefijo de entorno si no lo tiene
        if prefix:
            clean_prefix = prefix.rstrip('/')
            if not cleaned.startswith(clean_prefix):
                candidates.append(f"{clean_prefix}/{cleaned.lstrip('/')}")
                if ext:
                    candidates.append(f"{clean_prefix}/{base_no_ext.lstrip('/')}")

        # Con folder hint
        if folder_hint and folder_hint not in cleaned:
            if prefix:
                candidates.append(f"{prefix.rstrip('/')}/{folder_hint}/{os.path.basename(cleaned)}")
                if ext:
                    candidates.append(f"{prefix.rstrip('/')}/{folder_hint}/{os.path.basename(base_no_ext)}")

        # Deduplicar preservando orden
        seen = set()
        deduped = []
        for c in candidates:
            c_norm = c.strip('/')
            if c_norm and c_norm not in seen:
                seen.add(c_norm)
                deduped.append(c_norm)

        return deduped

    def _check_asset_in_cloudinary(
        self, raw_val: str, prefix: str, folder_hint: str, has_cld_api: bool = True
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]], List[str]]:
        candidates = self._generate_candidate_public_ids(raw_val, prefix, folder_hint)
        if not has_cld_api:
            return False, None, None, candidates

        for candidate in candidates:
            try:
                res = cloudinary.api.resource(candidate, resource_type="image")
                if res and res.get('public_id'):
                    return True, res['public_id'], res, candidates
            except cloudinary.exceptions.NotFound:
                continue
            except Exception as e:
                # Si hay error de red o timeout, seguir intentando
                continue

        return False, None, None, candidates

    def _search_folder_assets(self, prefix: str, folder: str) -> List[Dict[str, Any]]:
        folder_path = f"{prefix.rstrip('/')}/{folder}" if prefix else folder
        try:
            res = cloudinary.api.resources(
                type="upload",
                prefix=folder_path,
                max_results=30
            )
            return res.get('resources', [])
        except Exception:
            return []

    def _find_best_match(self, raw_val: str, resources: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        filename = os.path.basename(raw_val).lower()
        base_name, _ = os.path.splitext(filename)
        # Extraer palabras clave de búsqueda
        keywords = [k for k in re.split(r'[-_\s]+', base_name) if len(k) > 2]

        for r in resources:
            pid = r.get('public_id', '').lower()
            if all(k in pid for k in keywords):
                return r
            if base_name in pid:
                return r

        return None
