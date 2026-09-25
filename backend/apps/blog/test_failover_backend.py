from django.test import SimpleTestCase, override_settings
from django.core.mail import EmailMessage, get_connection
from unittest.mock import patch, MagicMock
from config.email_backends import FailoverEmailBackend

class FailoverEmailBackendTests(SimpleTestCase):
    
    @patch('config.email_backends.get_connection')
    def test_failover_sequence_all_successful(self, mock_get_connection):
        """
        Verify that if Brevo is configured, it gets tried first, and if successful,
        we do not proceed to SES or Zoho.
        """
        # Mock connection behaviour
        mock_conn = MagicMock()
        mock_conn.send_messages.return_value = 1
        mock_get_connection.return_value = mock_conn

        backend = FailoverEmailBackend(fail_silently=False)
        msg = EmailMessage(
            subject='Test Subject',
            body='Test Body',
            from_email='original@example.com',
            to=['recipient@example.com']
        )

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password',
            BREVO_DEFAULT_FROM_EMAIL='Ms Ambar <hola@msambar.com>',
            SES_DEFAULT_FROM_EMAIL='Ms Ambar <hola@msambar.com>'
        ):
            sent_count = backend.send_messages([msg])
            
            self.assertEqual(sent_count, 1)
            # Should have called get_connection exactly once for Brevo
            mock_get_connection.assert_called_once()
            called_kwargs = mock_get_connection.call_args[1]
            self.assertEqual(called_kwargs['username'], 'brevo_user')
            
            # Verify from_email was updated to Brevo default sender
            self.assertEqual(msg.from_email, 'Ms Ambar <hola@msambar.com>')

    @patch('config.email_backends.get_connection')
    def test_failover_brevo_fails_ses_succeeds(self, mock_get_connection):
        """
        Verify that if Brevo fails, it moves to Amazon SES.
        """
        mock_brevo_conn = MagicMock()
        mock_brevo_conn.send_messages.side_effect = Exception("Brevo limit reached")
        
        mock_ses_conn = MagicMock()
        mock_ses_conn.send_messages.return_value = 1
        
        # Side effect returns Brevo connection first, then SES connection
        mock_get_connection.side_effect = [mock_brevo_conn, mock_ses_conn]

        backend = FailoverEmailBackend(fail_silently=False)
        msg = EmailMessage(
            subject='Test Subject',
            body='Test Body',
            from_email='original@example.com',
            to=['recipient@example.com']
        )

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password',
            BREVO_DEFAULT_FROM_EMAIL='Ms Ambar <hola@msambar.com>',
            SES_DEFAULT_FROM_EMAIL='Ms Ambar <hola@msambar.com>'
        ):
            sent_count = backend.send_messages([msg])
            
            self.assertEqual(sent_count, 1)
            self.assertEqual(mock_get_connection.call_count, 2)
            
            # First call was Brevo, second was SES
            first_args = mock_get_connection.call_args_list[0][1]
            second_args = mock_get_connection.call_args_list[1][1]
            self.assertEqual(first_args['username'], 'brevo_user')
            self.assertEqual(second_args['username'], 'ses_user')
            
            # Verify from_email was updated to SES sender
            self.assertEqual(msg.from_email, 'Ms Ambar <hola@msambar.com>')

    @patch('config.email_backends.get_connection')
    def test_failover_all_fail(self, mock_get_connection):
        """
        Verify that if all providers fail, the last exception is raised.
        """
        mock_brevo_conn = MagicMock()
        mock_brevo_conn.send_messages.side_effect = Exception("Brevo error")
        
        mock_ses_conn = MagicMock()
        mock_ses_conn.send_messages.side_effect = Exception("SES error")
        
        mock_zoho_conn = MagicMock()
        mock_zoho_conn.send_messages.side_effect = Exception("Zoho error")
        
        mock_get_connection.side_effect = [mock_brevo_conn, mock_ses_conn, mock_zoho_conn]

        backend = FailoverEmailBackend(fail_silently=False)
        msg = EmailMessage(
            subject='Test Subject',
            body='Test Body',
            from_email='original@example.com',
            to=['recipient@example.com']
        )

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password',
            EMAIL_HOST_USER='zoho_user',
            EMAIL_HOST_PASSWORD='zoho_password'
        ):
            with self.assertRaises(Exception) as context:
                backend.send_messages([msg])
            
            self.assertIn("Zoho error", str(context.exception))
            self.assertEqual(mock_get_connection.call_count, 3)

    @patch('config.email_backends.get_brevo_sent_count', return_value=300)
    @patch('config.email_backends.get_connection')
    def test_failover_brevo_quota_exhausted_skips_directly_to_ses(self, mock_get_connection, mock_sent_count):
        """
        Si la cuota de Brevo >= 300 (Circuit Breaker activo), se omite Brevo
        y se despacha directamente a Amazon SES sin abrir socket a Brevo.
        """
        mock_ses_conn = MagicMock()
        mock_ses_conn.send_messages.return_value = 1
        mock_get_connection.return_value = mock_ses_conn

        backend = FailoverEmailBackend(fail_silently=False)
        msg = EmailMessage(
            subject='Circuit Breaker Test',
            body='Test Body',
            from_email='original@example.com',
            to=['recipient@example.com']
        )

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password',
            SES_DEFAULT_FROM_EMAIL='Ms Ambar <hola@msambar.com>'
        ):
            sent = backend.send_messages([msg])
            self.assertEqual(sent, 1)
            # Solo se llamó una vez a get_connection (para SES, omitiendo Brevo)
            mock_get_connection.assert_called_once()
            called_kwargs = mock_get_connection.call_args[1]
            self.assertEqual(called_kwargs['username'], 'ses_user')

    @patch('config.email_backends.boto3')
    @patch('config.email_backends.get_brevo_sent_count', return_value=300)
    def test_sesv2_raw_mime_serialization(self, mock_sent_count, mock_boto3):
        """
        Verifica que al usar boto3 sesv2, el mensaje se serialice a Raw MIME RFC 822
        preservando el payload completo (Content={'Raw': {'Data': raw_bytes}}).
        """
        mock_ses_client = MagicMock()
        mock_boto3.client.return_value = mock_ses_client

        backend = FailoverEmailBackend(fail_silently=False)
        msg = EmailMessage(
            subject='Raw MIME Test',
            body='Body with binary payload',
            from_email='original@example.com',
            to=['recipient@example.com'],
            cc=['cc@example.com']
        )
        msg.attach('test.txt', b'Hello world attachment', 'text/plain')

        with override_settings(
            TESTING=False,
            AWS_ACCESS_KEY_ID='fake_key',
            AWS_SECRET_ACCESS_KEY='fake_secret',
            AWS_REGION_NAME='us-east-1',
            SES_DEFAULT_FROM_EMAIL='Ms Ambar <hola@msambar.com>'
        ):
            sent = backend.send_messages([msg])
            self.assertEqual(sent, 1)
            mock_ses_client.send_email.assert_called_once()
            call_kwargs = mock_ses_client.send_email.call_args[1]

            self.assertEqual(call_kwargs['FromEmailAddress'], 'Ms Ambar <hola@msambar.com>')
            self.assertIn('Raw', call_kwargs['Content'])
            raw_data = call_kwargs['Content']['Raw']['Data']
            self.assertIsInstance(raw_data, bytes)
            self.assertIn(b'Hello world attachment', raw_data)

    def test_webhook_idempotency_deduplication(self):
        """
        Verifica que is_brevo_webhook_event_duplicate descarte eventos duplicados
        utilizando Redis SETNX (retorna False en el primer intento, True en el segundo).
        """
        from config.email_waterfall import is_brevo_webhook_event_duplicate
        import uuid
        test_event_id = f"test_evt_{uuid.uuid4().hex}"

        # Primer intento: nuevo
        first_call = is_brevo_webhook_event_duplicate(test_event_id, ttl_seconds=60)
        self.assertFalse(first_call)

        # Segundo intento con el mismo event_id: duplicado detectado
        second_call = is_brevo_webhook_event_duplicate(test_event_id, ttl_seconds=60)
        self.assertTrue(second_call)

    def test_brevo_utc_date_strict_alignment(self):
        """
        Verifica que get_today_utc_date() y get_brevo_utc_date_str() respeten
        el corte de medianoche 00:00:00 UTC.
        """
        from config.email_waterfall import get_today_utc_date, get_brevo_utc_date_str
        from datetime import datetime, timezone

        expected_date = datetime.now(timezone.utc).date()
        expected_str = expected_date.strftime('%Y-%m-%d')

        self.assertEqual(get_today_utc_date(), expected_date)
        self.assertEqual(get_brevo_utc_date_str(), expected_str)

