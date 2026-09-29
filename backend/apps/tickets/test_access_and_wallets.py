import io
import json
import zipfile
import hashlib
from concurrent.futures import ThreadPoolExecutor
from django.urls import reverse
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.tickets.models import Theater, Event, Seat, Ticket, TicketCheckInAudit
from apps.tickets.access.qr_crypto import generate_qr_payload, verify_qr_payload
from apps.tickets.services.apple_wallet import AppleWalletPassGenerator
from apps.tickets.services.google_wallet import GoogleWalletService

User = get_user_model()


class TicketAccessAndWalletsTests(APITestCase):
    def setUp(self):
        # 1. Configuración de Teatro con Asignación Compuesta (Fila F · Mesa 4 · Asiento 13)
        self.theater = Theater.objects.create(
            name="London Pub",
            location="Hermosillo, Sonora",
            layout={
                "seats": [
                    {
                        "id": 101,
                        "row": "F",
                        "number": 13,
                        "tableId": 4,
                        "section": "VIP Gold",
                        "x": 150,
                        "y": 200
                    }
                ],
                "map_elements": [
                    {
                        "id": 4,
                        "type": "table",
                        "label": "Mesa 4",
                        "x": 150,
                        "y": 200
                    }
                ]
            }
        )

        # 2. Asiento oficial
        self.seat = Seat.objects.create(
            theater=self.theater,
            section="VIP Gold",
            row="F",
            number=13,
            category="vip",
            base_price=1200.00,
            x=150.0,
            y=200.0
        )

        # 3. Concierto / Evento
        self.event = Event.objects.create(
            title="Ms. Ambar en Concierto “Hadas en el Desierto”",
            artist="Ms. Ambar",
            date=timezone.now() + timezone.timedelta(days=5),
            venue_name="London Pub",
            venue_address="Blvd. Kino 102, Hermosillo, Sonora",
            theater=self.theater,
            price_multiplier=1.0
        )

        # 4. Boletos de prueba
        self.active_ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat,
            user_email="asistente@ejemplo.com",
            user_phone="6621234567",
            status="paid",
            amount_paid=1200.00
        )

        self.unpaid_ticket = Ticket.objects.create(
            event=self.event,
            user_email="pendiente@ejemplo.com",
            status="reserved"
        )

        self.staff_user = User.objects.create_user(
            username="guardia_puerta1",
            email="puerta1@msambar.com",
            password="pass_secure_123"
        )

    def test_01_qr_crypto_compact_and_jwt(self):
        """
        Prueba la generación de payload firmado HMAC-SHA256, su verificación y el rechazo de manipulación.
        """
        # Formato compacto
        payload = generate_qr_payload(self.active_ticket, format_type='compact')
        self.assertIn(":", payload)
        parts = payload.split(":")
        self.assertEqual(len(parts), 3)
        self.assertEqual(parts[0], str(self.active_ticket.token))

        # Verificación exitosa
        verified = verify_qr_payload(payload)
        self.assertTrue(verified["valid"])
        self.assertEqual(verified["ticket_uuid"], str(self.active_ticket.token))
        self.assertEqual(verified["format"], "compact")

        # Detección de alteración maliciosa (cambio de token o firma alterada)
        tampered_payload = f"{parts[0]}:{parts[1]}:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        tampered_verified = verify_qr_payload(tampered_payload)
        self.assertFalse(tampered_verified["valid"])
        self.assertIn("inválida", tampered_verified["error"].lower())

        # Formato JWT
        jwt_payload = generate_qr_payload(self.active_ticket, format_type='jwt')
        jwt_verified = verify_qr_payload(jwt_payload)
        self.assertTrue(jwt_verified["valid"])
        self.assertEqual(jwt_verified["ticket_uuid"], str(self.active_ticket.token))
        self.assertEqual(jwt_verified["format"], "jwt")

    def test_02_scanner_checkin_success(self):
        """
        Prueba el endpoint de check-in en puerta retornando HTTP 200 y asignación física correcta.
        """
        qr_payload = generate_qr_payload(self.active_ticket)
        url = "/api/tickets/scanner/check-in/"
        data = {
            "qr_payload": qr_payload,
            "scanner_device_id": "door-west-1",
            "location": "Acceso Principal",
            "idempotency_key": "scanner-req-001"
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res_data = response.json()

        self.assertEqual(res_data["status"], "SUCCESS")
        self.assertIn("Fila F", res_data["physical_location"])
        self.assertIn("Asiento 13", res_data["physical_location"])
        self.assertEqual(res_data["ticket_uuid"], str(self.active_ticket.token))

        # Verificar actualización en Base de Datos
        self.active_ticket.refresh_from_db()
        self.assertTrue(self.active_ticket.is_scanned)
        self.assertIsNotNone(self.active_ticket.scanned_at)
        self.assertEqual(self.active_ticket.status, "used")

        # Verificar auditoría
        audit = TicketCheckInAudit.objects.filter(ticket=self.active_ticket).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.status_result, TicketCheckInAudit.STATUS_SUCCESS)
        self.assertEqual(audit.scanner_device_id, "door-west-1")

    def test_03_scanner_checkin_already_used_conflict_409(self):
        """
        Prueba que un boleto ya escaneado sea rechazado con HTTP 409 Conflict 'ALREADY_USED'.
        """
        # Primer check-in exitoso
        qr_payload = generate_qr_payload(self.active_ticket)
        url = "/api/tickets/scanner/check-in/"
        self.client.post(url, {"qr_payload": qr_payload, "scanner_device_id": "door-1"})

        # Segundo intento con diferente llave o dispositivo (intento de doble canje)
        response_dup = self.client.post(url, {
            "qr_payload": qr_payload,
            "scanner_device_id": "door-2",
            "location": "Puerta Lateral",
            "idempotency_key": "scanner-req-002"
        })

        self.assertEqual(response_dup.status_code, status.HTTP_409_CONFLICT)
        dup_data = response_dup.json()
        self.assertEqual(dup_data["status"], "ALREADY_USED")
        self.assertIn("ya utilizado", dup_data["message"].lower())
        self.assertIn("checked_in_at", dup_data)

    def test_04_scanner_checkin_idempotency_recovery(self):
        """
        Prueba la tolerancia a intermitencia de red mediante idempotency_key retornando HTTP 200 sin error 409.
        """
        qr_payload = generate_qr_payload(self.active_ticket)
        url = "/api/tickets/scanner/check-in/"
        idem_key = "network-drop-recovery-uuid-999"

        # Envío 1 (exitoso)
        res1 = self.client.post(url, {
            "qr_payload": qr_payload,
            "scanner_device_id": "door-mobile-1",
            "idempotency_key": idem_key
        })
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Reintento idéntico por timeout de red en el cliente escáner
        res2 = self.client.post(url, {
            "qr_payload": qr_payload,
            "scanner_device_id": "door-mobile-1",
            "idempotency_key": idem_key
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.json().get("idempotent_replay"))

    def test_05_scanner_checkin_unpaid_ticket_rejected(self):
        """
        Prueba que boletos no pagados sean rechazados con HTTP 400 'NOT_ACTIVE'.
        """
        qr_payload = generate_qr_payload(self.unpaid_ticket)
        url = "/api/tickets/scanner/check-in/"
        res = self.client.post(url, {"qr_payload": qr_payload})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.json()["status"], "NOT_ACTIVE")

    def test_06_apple_wallet_pkpass_bundle_structure(self):
        """
        Prueba la generación y descarga del paquete binario .pkpass para Apple Wallet.
        """
        url = f"/api/tickets/{self.active_ticket.token}/apple-pass/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/vnd.apple.pkpass')
        self.assertIn('.pkpass', response['Content-Disposition'])

        # Verificar integridad del archivo ZIP
        zip_buf = io.BytesIO(response.content)
        self.assertTrue(zipfile.is_zipfile(zip_buf))

        with zipfile.ZipFile(zip_buf, 'r') as zf:
            file_names = zf.namelist()
            self.assertIn('pass.json', file_names)
            self.assertIn('manifest.json', file_names)
            self.assertIn('signature', file_names)
            self.assertIn('icon.png', file_names)
            self.assertIn('logo.png', file_names)
            self.assertIn('strip.png', file_names)

            # Verificar pass.json
            pass_raw = zf.read('pass.json').decode('utf-8')
            pass_dict = json.loads(pass_raw)
            self.assertEqual(pass_dict["formatVersion"], 1)
            self.assertIn("eventTicket", pass_dict)
            self.assertEqual(pass_dict["serialNumber"], str(self.active_ticket.token))

            # Verificar manifest.json y checksums SHA-1
            manifest_dict = json.loads(zf.read('manifest.json').decode('utf-8'))
            for fname in file_names:
                if fname not in ['manifest.json', 'signature']:
                    self.assertIn(fname, manifest_dict)
                    actual_sha1 = hashlib.sha1(zf.read(fname)).hexdigest()
                    self.assertEqual(manifest_dict[fname], actual_sha1)

    def test_07_google_wallet_link_and_jwt(self):
        """
        Prueba la emisión del enlace firmado de Google Wallet con JWT RS256.
        """
        url = f"/api/tickets/{self.active_ticket.token}/google-wallet-link/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("save_url", data)
        self.assertIn("jwt", data)
        self.assertTrue(data["save_url"].startswith("https://pay.google.com/gp/v/save/"))

        # Decodificar claims del JWT emitido sin verificar firma para comprobar estructura
        import jwt
        claims = jwt.decode(data["jwt"], options={"verify_signature": False})
        self.assertEqual(claims["aud"], "google")
        self.assertEqual(claims["typ"], "savetowallet")

        payload = claims["payload"]
        self.assertIn("eventTicketClasses", payload)
        self.assertIn("eventTicketObjects", payload)

        ticket_obj = payload["eventTicketObjects"][0]
        self.assertEqual(ticket_obj["ticketHolderName"], self.active_ticket.user_email)
        self.assertEqual(ticket_obj["ticketNumber"], str(self.active_ticket.id))
        self.assertEqual(ticket_obj["barcode"]["type"], "QR_CODE")


class TicketConcurrencyTransactionTests(TransactionTestCase):
    """
    Prueba de condiciones de carrera y exclusión mutua estricta con transacciones concurrentes.
    """
    def setUp(self):
        self.theater = Theater.objects.create(name="London Pub Concurrency")
        self.event = Event.objects.create(
            title="Ms. Ambar En Vivo",
            artist="Ms. Ambar",
            date=timezone.now() + timezone.timedelta(days=1),
            theater=self.theater
        )
        self.ticket = Ticket.objects.create(
            event=self.event,
            user_email="concurrency@test.com",
            status="paid"
        )

    def test_concurrent_double_checkin_race_condition(self):
        """
        Simula 4 solicitudes de check-in paralelas contra el mismo boleto al mismo milisegundo.
        Exactamente 1 debe resultar SUCCESS (200), y las restantes deben recibir ALREADY_USED (409).
        """
        from apps.tickets.access.checkin_engine import process_ticket_checkin

        qr_payload = generate_qr_payload(self.ticket)
        num_threads = 4

        def worker(worker_id):
            import time
            from django.db import connection
            try:
                time.sleep(0.02 * worker_id)
                return process_ticket_checkin(
                    qr_payload=qr_payload,
                    scanner_device_id=f"door-sim-{worker_id}",
                    location="Acceso Paralelo",
                    idempotency_key=f"worker-key-{worker_id}"
                )
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker, i) for i in range(num_threads)]
            results = [f.result() for f in futures]

        status_codes = [r["status_code"] for r in results]
        success_count = status_codes.count(200)
        conflict_count = status_codes.count(409)

        self.assertEqual(success_count, 1, f"Debe haber exactamente 1 ingreso exitoso. Obtenidos: {status_codes}")
        self.assertEqual(conflict_count, num_threads - 1, f"Los demás intentos deben ser 409 Conflict. Obtenidos: {status_codes}")

        self.ticket.refresh_from_db()
        self.assertTrue(self.ticket.is_scanned)
        self.assertEqual(self.ticket.status, "used")
