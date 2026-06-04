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
            SES_EMAIL_HOST_PASSWORD='ses_password'
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
            SES_EMAIL_HOST_PASSWORD='ses_password'
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
