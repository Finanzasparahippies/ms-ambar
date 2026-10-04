import io
import json
import zipfile
import hashlib
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.tickets.models import Event, Theater, Seat, Ticket
from apps.tickets.services.apple_wallet import AppleWalletService


class AppleWalletPassKitTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.theater = Theater.objects.create(
            name="London Pub",
            location="Hermosillo, Sonora, México",
            layout={"seats": [], "map_elements": []}
        )
        self.event = Event.objects.create(
            title="Ms. Ambar - Tour Íntimo 2026",
            artist="Ms. Ambar",
            date=timezone.now() + timedelta(days=10),
            event_type="concert",
            theater=self.theater,
            venue_name="London Pub",
            venue_address="Blvd. Hidalgo #45, Hermosillo, Sonora",
            is_active=True,
            mg_price=1500.00,
            mg_limit=20,
            price_multiplier=1.0,
            allow_numbered_tickets=True
        )
        self.seat = Seat.objects.create(
            theater=self.theater,
            section="Preferente A",
            row="B",
            number=12,
            base_price=1200.00,
            status="available"
        )
        self.ticket = Ticket.objects.create(
            event=self.event,
            seat=self.seat,
            user_email="fan@nectarlabs.test",
            status="paid",
            has_mg=False
        )

    def test_build_pass_json_specification(self):
        """Valida que la estructura del pass.json cumpla rigurosamente con Apple EventTicket."""
        service = AppleWalletService()
        pass_data = service._build_pass_json(self.ticket)

        self.assertEqual(pass_data["formatVersion"], 1)
        self.assertEqual(pass_data["passTypeIdentifier"], service.pass_type_id)
        self.assertEqual(pass_data["serialNumber"], str(self.ticket.token))
        self.assertEqual(pass_data["teamIdentifier"], service.team_id)
        self.assertEqual(pass_data["organizationName"], "Ms. Ambar")
        self.assertEqual(pass_data["backgroundColor"], "rgb(12, 14, 20)")
        self.assertEqual(pass_data["labelColor"], "rgb(229, 169, 59)")

        # Estructura eventTicket
        self.assertIn("eventTicket", pass_data)
        event_ticket = pass_data["eventTicket"]
        self.assertIn("primaryFields", event_ticket)
        self.assertEqual(event_ticket["primaryFields"][0]["value"], self.event.title)

        self.assertIn("secondaryFields", event_ticket)
        secondary_keys = [f["key"] for f in event_ticket["secondaryFields"]]
        self.assertIn("event_date", secondary_keys)
        self.assertIn("doors_open", secondary_keys)

        self.assertIn("auxiliaryFields", event_ticket)
        aux_keys = [f["key"] for f in event_ticket["auxiliaryFields"]]
        self.assertIn("seat_section", aux_keys)
        self.assertIn("seat_row", aux_keys)
        self.assertIn("seat_number", aux_keys)
        self.assertIn("attendee_email", aux_keys)

        self.assertIn("backFields", event_ticket)
        back_keys = [f["key"] for f in event_ticket["backFields"]]
        self.assertIn("ticket_folio", back_keys)
        self.assertIn("terms_and_conditions", back_keys)
        self.assertIn("box_office_policy", back_keys)

        # Barcode QR con HMAC
        self.assertEqual(pass_data["barcode"]["format"], "PKBarcodeFormatQR")
        self.assertTrue(len(pass_data["barcode"]["message"]) > 20)

    def test_generate_pkpass_archive_and_manifest(self):
        """Valida que el archivo .pkpass generado sea un ZIP válido y contenga manifest y firma."""
        service = AppleWalletService()
        pkpass_bytes = service.generate_pass(self.ticket)

        self.assertIsInstance(pkpass_bytes, bytes)
        self.assertTrue(len(pkpass_bytes) > 1000)

        # Verificar archivo ZIP y contenido
        zip_buf = io.BytesIO(pkpass_bytes)
        with zipfile.ZipFile(zip_buf, 'r') as zf:
            file_list = zf.namelist()
            self.assertIn("pass.json", file_list)
            self.assertIn("manifest.json", file_list)
            self.assertIn("signature", file_list)
            self.assertIn("icon.png", file_list)
            self.assertIn("icon@2x.png", file_list)
            self.assertIn("logo.png", file_list)
            self.assertIn("strip.png", file_list)

            # Verificar integridad de checksums en manifest.json
            manifest_data = json.loads(zf.read("manifest.json").decode('utf-8'))
            for fname, expected_hash in manifest_data.items():
                actual_file_bytes = zf.read(fname)
                actual_hash = hashlib.sha1(actual_file_bytes).hexdigest()
                self.assertEqual(actual_hash, expected_hash, f"Hash mismatch en {fname}")

    def test_drf_apple_pass_endpoint_headers(self):
        """Valida endpoint GET /api/tickets/{token}/apple-pass/ con MIME type y encabezados correctos."""
        url = f"/api/tickets/{self.ticket.token}/apple-pass/"
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/vnd.apple.pkpass')
        self.assertIn(f"attachment; filename=\"ms-ambar-ticket-{self.ticket.id}.pkpass\"", res['Content-Disposition'])
        self.assertIn('no-cache', res['Cache-Control'])
        self.assertTrue(len(res.content) > 1000)

    def test_cancelled_ticket_rejected(self):
        """Un boleto cancelado no debe emitir pases de Apple Wallet."""
        self.ticket.status = 'cancelled'
        self.ticket.save(update_fields=['status'])

        url = f"/api/tickets/{self.ticket.token}/apple-pass/"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 400)
        self.assertIn('cancelado', res.data.get('error', '').lower())
