from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.blog.models import Category, Post, NewsletterSubscriber, EmailCampaign
from unittest.mock import patch

User = get_user_model()

class BlogAppTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            password='adminpassword'
        )
        self.regular_user = User.objects.create_user(
            email='regular@example.com',
            username='regular',
            password='regularpassword'
        )

        self.category = Category.objects.create(name='Acústica')
        self.published_post = Post.objects.create(
            title='Resonancia en Teatros',
            content='Contenido sobre acústica en teatros modulares...',
            category=self.category,
            is_published=True
        )
        self.draft_post = Post.objects.create(
            title='Borrador Secreto',
            content='Contenido confidencial...',
            category=self.category,
            is_published=False
        )

    def test_category_list_public(self):
        """Verify anyone can fetch blog categories."""
        url = reverse('category-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_category_create_permission_denied_for_regular_user(self):
        """Verify non-admin users cannot create categories."""
        url = reverse('category-list')
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.post(url, {'name': 'Visuales'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_category_create_success_for_admin(self):
        """Verify admins can create categories."""
        url = reverse('category-list')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(url, {'name': 'Visuales'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Category.objects.count(), 2)

    def test_post_list_filters_unpublished_for_anonymous(self):
        """Verify that anonymous users only see published posts."""
        url = reverse('post-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see the published post
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Resonancia en Teatros')

    def test_post_list_shows_all_for_admin(self):
        """Verify that admin/staff see all posts including drafts."""
        url = reverse('post-list')
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    @patch('apps.blog.views.send_newsletter_email')
    def test_create_published_post_triggers_newsletter(self, mock_send_newsletter):
        """Verify that creating a published post triggers the newsletter dispatch."""
        url = reverse('post-list')
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'title': 'Gira 2026 Confirmada',
            'content': 'Detalles de la gira oficial de MS AMBAR...',
            'category': self.category.id,
            'is_published': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        post = Post.objects.get(title='Gira 2026 Confirmada')
        self.assertTrue(post.is_notified)
        mock_send_newsletter.assert_called_once_with(post)

    @patch('apps.blog.views.send_welcome_email')
    def test_newsletter_subscription_flow(self, mock_welcome):
        """Verify public newsletter registration triggers a welcome email."""
        url = reverse('subscriber-list')
        data = {'email': 'fan@example.com'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        sub = NewsletterSubscriber.objects.get(email='fan@example.com')
        self.assertTrue(sub.is_active)
        mock_welcome.assert_called_once_with(sub)

    def test_newsletter_unsubscribe(self):
        """Verify users can unsubscribe from newsletters."""
        sub = NewsletterSubscriber.objects.create(email='unsub@example.com', is_active=True)
        url = reverse('subscriber-unsubscribe')
        response = self.client.post(url, {'email': 'unsub@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        sub.refresh_from_db()
        self.assertFalse(sub.is_active)

    @patch('apps.blog.utils.get_connection')
    def test_email_failover_flow(self, mock_get_connection):
        """Verify the email failover sequence: Brevo -> SES -> Default."""
        from django.test import override_settings
        from apps.blog.utils import send_failover_email

        # Mock SMTP connection backend instances
        mock_brevo_conn = mock_get_connection.return_value
        mock_ses_conn = mock_get_connection.return_value

        # Mock connection behavior: Brevo fails, SES succeeds
        class FakeConnection:
            def __init__(self, should_fail=False):
                self.should_fail = should_fail
            def send_messages(self, messages):
                if self.should_fail:
                    raise Exception("SMTP Connection Timeout")
                return len(messages)

        # Set up a side_effect where the first connection (Brevo) fails, and the second (SES) succeeds
        mock_get_connection.side_effect = [
            FakeConnection(should_fail=True),
            FakeConnection(should_fail=False)
        ]

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password'
        ):
            # Attempt to send email
            result = send_failover_email(
                subject="Test Failover",
                html_content="<p>Test</p>",
                text_content="Test",
                recipient_list=["recipient@example.com"]
            )
            # Result should be 'Amazon SES' because Brevo failed and SES succeeded
            self.assertEqual(result, "Amazon SES")
            # Verify get_connection was called twice
            self.assertEqual(mock_get_connection.call_count, 2)

    @patch('apps.blog.utils.EmailMultiAlternatives.send')
    @patch('apps.blog.utils.get_connection')
    def test_email_failover_all_failed(self, mock_get_connection, mock_send):
        """Verify that if all providers fail, an exception is raised."""
        from django.test import override_settings
        from apps.blog.utils import send_failover_email

        # Mock connections to succeed during instantiation
        mock_get_connection.return_value = "dummy_conn"
        
        # Mock send to always raise SMTP exception
        mock_send.side_effect = Exception("SMTP Auth Refused")

        with override_settings(
            BREVO_EMAIL_HOST_USER='brevo_user',
            BREVO_EMAIL_HOST_PASSWORD='brevo_password',
            SES_EMAIL_HOST_USER='ses_user',
            SES_EMAIL_HOST_PASSWORD='ses_password'
        ):
            with self.assertRaises(Exception) as context:
                send_failover_email(
                    subject="Test Failover Fail",
                    html_content="<p>Test</p>",
                    text_content="Test",
                    recipient_list=["recipient@example.com"]
                )
            self.assertIn("SMTP Auth Refused", str(context.exception))

    @patch('apps.blog.views.requests.get')
    def test_ses_webhook_subscription_confirmation(self, mock_get):
        """Verify that receiving a SubscriptionConfirmation requests the subscription URL."""
        url = reverse('ses-verification-webhook')
        payload = {
            "Type": "SubscriptionConfirmation",
            "SubscribeURL": "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription"
        }
        response = self.client.post(
            url,
            payload,
            format='json',
            HTTP_X_AMZ_SNS_MESSAGE_TYPE='SubscriptionConfirmation'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, "Subscribed")
        mock_get.assert_called_once_with("https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription")

    def test_ses_webhook_bounce_and_complaint(self):
        """Verify that receiving Bounce/Complaint notifications deactivates subscribers."""
        import json
        # Create subscribers to bounce/complain
        sub_bounce = NewsletterSubscriber.objects.create(email="bounced@example.com", is_active=True)
        sub_complaint = NewsletterSubscriber.objects.create(email="complained@example.com", is_active=True)
        
        url = reverse('ses-verification-webhook')
        
        # 1. Simulate Bounce notification
        bounce_payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "notificationType": "Bounce",
                "bounce": {
                    "bounceType": "Permanent",
                    "bouncedRecipients": [{"emailAddress": "bounced@example.com"}]
                }
            })
        }
        response = self.client.post(
            url,
            bounce_payload,
            format='json',
            HTTP_X_AMZ_SNS_MESSAGE_TYPE='Notification'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sub_bounce.refresh_from_db()
        self.assertFalse(sub_bounce.is_active)

        # 2. Simulate Complaint notification
        complaint_payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "notificationType": "Complaint",
                "complaint": {
                    "complainedRecipients": [{"emailAddress": "complained@example.com"}]
                }
            })
        }
        response = self.client.post(
            url,
            complaint_payload,
            format='json',
            HTTP_X_AMZ_SNS_MESSAGE_TYPE='Notification'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sub_complaint.refresh_from_db()
        self.assertFalse(sub_complaint.is_active)

    # --- New Tests for CSV Import, Campaigns and Templates ---

    def test_import_csv_success(self):
        """Verify successful CSV import with custom headers and formats."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.admin_user)
        
        csv_content = (
            "subscriber_id,api_subscription_id,email,tags,status,premium?,created_at\n"
            "sub_123,api_999,new_fan@example.com,concierto;vip,active,true,2026-05-20 14:30:00\n"
            "sub_124,api_1000,another_fan@example.com,tour,inactive,false,2026-05-21 15:00:00\n"
        ).encode('utf-8')
        
        uploaded_file = SimpleUploadedFile('subscribers.csv', csv_content, content_type='text/csv')
        url = reverse('subscriber-import-csv')
        response = self.client.post(url, {'file': uploaded_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Se procesaron 2 suscriptores con éxito", response.data['message'])
        
        sub1 = NewsletterSubscriber.objects.get(email='new_fan@example.com')
        self.assertEqual(sub1.subscriber_id, 'sub_123')
        self.assertEqual(sub1.api_subscription_id, 'api_999')
        self.assertEqual(sub1.tags, 'concierto;vip')
        self.assertTrue(sub1.is_premium)
        self.assertTrue(sub1.is_active)
        from django.utils import timezone
        import datetime
        expected_dt = timezone.make_aware(datetime.datetime.strptime('2026-05-20 14:30:00', '%Y-%m-%d %H:%M:%S'))
        self.assertEqual(sub1.created_at, expected_dt)
        
        sub2 = NewsletterSubscriber.objects.get(email='another_fan@example.com')
        self.assertEqual(sub2.subscriber_id, 'sub_124')
        self.assertEqual(sub2.api_subscription_id, 'api_1000')
        self.assertEqual(sub2.tags, 'tour')
        self.assertFalse(sub2.is_premium)
        self.assertFalse(sub2.is_active)

    def test_import_csv_alternative_delimiters_and_bom(self):
        """Verify support for semicolon and tab delimiters, and UTF-8 BOM encoding."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.admin_user)
        
        csv_content = (
            b"\xef\xbb\xbfsubscriber_id;api_subscription_id;email;tags;status;premium?;created_at\n"
            b"sub_777;api_888;semicolon@example.com;tag1;active;yes;2026-05-22\n"
        )
        
        uploaded_file = SimpleUploadedFile('subscribers.csv', csv_content, content_type='text/csv')
        url = reverse('subscriber-import-csv')
        response = self.client.post(url, {'file': uploaded_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        sub = NewsletterSubscriber.objects.get(email='semicolon@example.com')
        self.assertEqual(sub.subscriber_id, 'sub_777')
        self.assertTrue(sub.is_premium)
        
        csv_tab_content = (
            "subscriber_id\tapi_subscription_id\temail\ttags\tstatus\tpremium?\tcreated_at\n"
            "sub_111\tapi_222\ttab@example.com\ttag2\tactive\t1\t2026-05-23T10:00:00Z\n"
        ).encode('utf-8')
        uploaded_tab_file = SimpleUploadedFile('subscribers.csv', csv_tab_content, content_type='text/csv')
        response = self.client.post(url, {'file': uploaded_tab_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        sub_tab = NewsletterSubscriber.objects.get(email='tab@example.com')
        self.assertEqual(sub_tab.subscriber_id, 'sub_111')
        self.assertTrue(sub_tab.is_premium)

    def test_import_csv_upsert_existing_subscriber(self):
        """Verify that importing an existing email merges fields and doesn't duplicate."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.admin_user)
        
        NewsletterSubscriber.objects.create(
            email='existing@example.com',
            name='Original Name',
            subscriber_id='old_sub',
            is_premium=False,
            is_active=False
        )
        
        csv_content = (
            "email,name,tags,premium?,status,subscriber_id\n"
            "existing@example.com,New Name,new_tag,true,active,new_sub_id\n"
        ).encode('utf-8')
        
        uploaded_file = SimpleUploadedFile('subscribers.csv', csv_content, content_type='text/csv')
        url = reverse('subscriber-import-csv')
        response = self.client.post(url, {'file': uploaded_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        sub = NewsletterSubscriber.objects.get(email='existing@example.com')
        self.assertEqual(sub.name, 'New Name')
        self.assertEqual(sub.subscriber_id, 'new_sub_id')
        self.assertEqual(sub.tags, 'new_tag')
        self.assertTrue(sub.is_premium)
        self.assertTrue(sub.is_active)
        self.assertEqual(NewsletterSubscriber.objects.filter(email='existing@example.com').count(), 1)

    def test_import_csv_missing_email_or_file(self):
        """Verify errors are handled for missing file or rows without email."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('subscriber-import-csv')
        
        response = self.client.post(url, {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        
        csv_content = (
            "subscriber_id,email,tags\n"
            "sub_no_email,,tag1\n"
        ).encode('utf-8')
        uploaded_file = SimpleUploadedFile('subscribers.csv', csv_content, content_type='text/csv')
        response = self.client.post(url, {'file': uploaded_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Se procesaron 0 suscriptores con éxito", response.data['message'])

    def test_campaign_create_by_admin(self):
        """Verify that admins can create an EmailCampaign with background and CTA properties."""
        url = reverse('campaign-list')
        self.client.force_authenticate(user=self.admin_user)
        
        data = {
            'subject': 'Poema de Otoño',
            'poem_text': 'Hojas que caen\nsilenciosamente...',
            'template_type': 'moss',
            'bg_opacity': 0.8,
            'bg_saturation': 120,
            'bg_position': 'top',
            'cta_text': 'Escuchar Set',
            'cta_link': 'https://soundcloud.com/ms-ambar'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        campaign = EmailCampaign.objects.get(subject='Poema de Otoño')
        self.assertEqual(campaign.template_type, 'moss')
        self.assertEqual(campaign.bg_opacity, 0.8)
        self.assertEqual(campaign.bg_saturation, 120)
        self.assertEqual(campaign.bg_position, 'top')
        self.assertEqual(campaign.cta_text, 'Escuchar Set')
        self.assertEqual(campaign.cta_link, 'https://soundcloud.com/ms-ambar')
        self.assertFalse(campaign.is_sent)

    def test_campaign_permissions_denied_for_regular_user(self):
        """Verify that regular/non-staff users cannot create or list campaigns."""
        url = reverse('campaign-list')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_campaign_template_rendering_styles(self):
        """Verify get_campaign_html_template applies correct styles based on choices."""
        from apps.blog.views import get_campaign_html_template
        
        campaign = EmailCampaign.objects.create(
            subject='Noche Cósmica',
            poem_text='Estrellas fugaces\nen el infinito...',
            template_type='cosmic'
        )
        
        html = get_campaign_html_template(campaign, 'fan@example.com')
        self.assertIn('#0c0a1a', html)
        self.assertIn('#c084fc', html)
        self.assertIn('Noche Cósmica', html)

    def test_campaign_template_rendering_with_bg_and_cta(self):
        """Verify background gradient blend styles and CTA button are generated when configured."""
        from apps.blog.views import get_campaign_html_template
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        bg_image = SimpleUploadedFile('bg.jpg', b'dummy_img_data', content_type='image/jpeg')
        campaign = EmailCampaign.objects.create(
            subject='Glow Poem',
            poem_text='Bajo la luz del ámbar...',
            template_type='glow',
            bg_image=bg_image,
            bg_opacity=0.6,
            bg_saturation=150,
            bg_position='bottom',
            cta_text='Comprar Boletos',
            cta_link='https://msambar.com/tickets'
        )
        
        html = get_campaign_html_template(campaign, 'fan@example.com')
        self.assertIn('linear-gradient(rgba(26, 19, 12, 0.4), rgba(26, 19, 12, 0.4))', html)
        self.assertIn('filter: saturate(150%)', html)
        self.assertIn('background-position: bottom', html)
        self.assertIn('href="https://msambar.com/tickets"', html)
        self.assertIn('Comprar Boletos', html)

    def test_campaign_template_rendering_custom_typography(self):
        """Verify custom typography choice injects Google Font imports and updates font family."""
        from apps.blog.views import get_campaign_html_template
        
        campaign = EmailCampaign.objects.create(
            subject='Poema Caligráfico',
            poem_text='Tinta en la arena...',
            template_type='minimalist',
            font_family='pinyon'
        )
        
        html = get_campaign_html_template(campaign, 'fan@example.com')
        # Should import Pinyon Script font
        self.assertIn("@import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap');", html)
        # Should apply the custom font stack to the body
        self.assertIn("font-family: 'Pinyon Script', cursive;", html)

    def test_campaign_responsive_rendering(self):
        """Verify get_campaign_html_template applies responsive styling (media queries and classes)."""
        from apps.blog.views import get_campaign_html_template
        
        custom_styles = {
            'card_max_width_desktop': '760px',
            'card_padding_desktop': '48px',
            'card_padding_tablet': '32px',
            'card_padding_mobile': '20px',
            'title_font_size_desktop': '30px',
            'title_font_size_tablet': '24px',
            'title_font_size_mobile': '20px',
            'body_font_size_desktop': '18px',
            'body_font_size_tablet': '16px',
            'body_font_size_mobile': '15px',
            'body_alignment_desktop': 'justify',
            'body_alignment_tablet': 'left',
            'body_alignment_mobile': 'center',
            'image_width_tablet': '80%',
            'image_width_mobile': '100%',
            'image_align_tablet': 'left',
            'image_align_mobile': 'center',
            'cta_alignment_tablet': 'left',
            'cta_alignment_mobile': 'center'
        }
        
        campaign = EmailCampaign.objects.create(
            subject='Responsive Test',
            poem_text='Línea de poema...',
            template_type='minimalist',
            custom_styles=custom_styles
        )
        
        html = get_campaign_html_template(campaign, 'fan@example.com')
        
        # Verify desktop inline styles
        self.assertIn('max-width: 760px', html)
        self.assertIn('padding: 48px', html)
        self.assertIn('font-size: 30px', html)
        self.assertIn('font-size: 18px', html)
        self.assertIn('text-align: justify', html)
        
        # Verify Tablet Media Query block
        self.assertIn('@media only screen and (max-width: 768px)', html)
        self.assertIn('.email-card {\n              padding: 32px !important;', html)
        self.assertIn('.email-title-h2 {\n              font-size: 24px !important;', html)
        self.assertIn('.email-poem-text {\n              font-size: 16px !important;\n              text-align: left !important;', html)
        self.assertIn('.email-cover-wrapper {\n              text-align: left !important;', html)
        self.assertIn('.email-cover-image {\n              width: 80% !important;', html)
        self.assertIn('.email-cta-box {\n              text-align: left !important;', html)
        
        # Verify Mobile Media Query block
        self.assertIn('@media only screen and (max-width: 480px)', html)
        self.assertIn('.email-card {\n              padding: 20px !important;', html)
        self.assertIn('.email-title-h2 {\n              font-size: 20px !important;', html)
        self.assertIn('.email-poem-text {\n              font-size: 15px !important;\n              text-align: center !important;', html)
        self.assertIn('.email-cover-wrapper {\n              text-align: center !important;', html)
        self.assertIn('.email-cover-image {\n              width: 100% !important;', html)
        self.assertIn('.email-cta-box {\n              text-align: center !important;', html)

    @patch('apps.blog.views.send_failover_email')
    def test_send_campaign_success(self, mock_send_email):
        """Verify sending a campaign triggers dispatch to active subscribers."""
        NewsletterSubscriber.objects.create(email='active1@example.com', is_active=True)
        NewsletterSubscriber.objects.create(email='active2@example.com', is_active=True)
        NewsletterSubscriber.objects.create(email='inactive@example.com', is_active=False)
        
        campaign = EmailCampaign.objects.create(
            subject='Campaña Especial',
            poem_text='Letras sonoras...',
            template_type='minimalist'
        )
        
        url = reverse('campaign-send-campaign', kwargs={'pk': campaign.pk})
        self.client.force_authenticate(user=self.admin_user)
        
        class FakeThread:
            def __init__(self, target, args=(), kwargs=None, daemon=True):
                self.target = target
                self.args = args
                self.kwargs = kwargs or {}
            def start(self):
                self.target(*self.args, **self.kwargs)

        with patch('apps.blog.views.threading.Thread', FakeThread):
            response = self.client.post(url)
            
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        campaign.refresh_from_db()
        self.assertTrue(campaign.is_sent)
        self.assertIsNotNone(campaign.sent_at)
        
        self.assertEqual(mock_send_email.call_count, 2)
        called_emails = [call[0][3][0] for call in mock_send_email.call_args_list]
        self.assertIn('active1@example.com', called_emails)
        self.assertIn('active2@example.com', called_emails)
        self.assertNotIn('inactive@example.com', called_emails)

    def test_send_campaign_already_sent_fails(self):
        """Verify that a campaign cannot be sent twice."""
        campaign = EmailCampaign.objects.create(
            subject='Campaña Antigua',
            poem_text='Ya enviado...',
            is_sent=True
        )
        
        url = reverse('campaign-send-campaign', kwargs={'pk': campaign.pk})
        self.client.force_authenticate(user=self.admin_user)
        
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Esta campaña ya ha sido enviada anteriormente.')

    def test_campaign_template_rendering_custom_sections_and_ctas(self):
        """Verify that get_campaign_html_template correctly renders custom section styles, multiple CTAs, and parses stanzas."""
        from apps.blog.views import get_campaign_html_template

        custom_styles = {
            'sender_name': 'Ms Ambar Especial',
            'title_color': '#ff0000',
            'title_bg_color': '#00ff00',
            'title_padding': '15px',
            'title_radius': '10px',
            'body_color': '#0000ff',
            'body_bg_color': '#f0f0f0',
            'body_padding': '25px',
            'body_radius': '15px',
            'footer_color': '#555555',
            'footer_bg_color': '#cccccc',
            'footer_padding': '10px',
            'footer_radius': '5px'
        }

        ctas = [
            {
                'text': 'CTA 1',
                'link': 'https://link1.com',
                'bg_color': '#ff0055',
                'text_color': '#ffffff',
                'radius': '6px',
                'border_width': '2px',
                'border_color': '#000000',
                'shadow_style': 'glow',
                'padding_size': 'large',
                'is_full_width': True
            },
            {
                'text': 'CTA 2',
                'link': 'https://link2.com',
                'bg_color': '#00ff55',
                'text_color': '#000000',
                'radius': '10px'
            }
        ]

        campaign = EmailCampaign.objects.create(
            subject='Poema de Prueba Estilos',
            poem_text='Estrofa uno linea uno\nEstrofa uno linea dos\n\nEstrofa dos linea uno\nEstrofa dos linea dos',
            template_type='minimalist',
            custom_styles=custom_styles,
            ctas=ctas
        )

        html = get_campaign_html_template(campaign, 'test@example.com')

        # Check sender name
        self.assertIn('Ms Ambar Especial', html)

        # Check section styling integration
        self.assertIn('#ff0000', html) # title_color
        self.assertIn('#00ff00', html) # title_bg_color
        self.assertIn('#0000ff', html) # body_color
        self.assertIn('#f0f0f0', html) # body_bg_color
        self.assertIn('#555555', html) # footer_color
        self.assertIn('#cccccc', html) # footer_bg_color

        # Check CTA rendering
        self.assertIn('href="https://link1.com"', html)
        self.assertIn('CTA 1', html)
        self.assertIn('background-color: #ff0055', html)
        self.assertIn('color: #ffffff', html)
        self.assertIn('border-radius: 6px', html)
        self.assertIn('border: 2px solid #000000', html)
        self.assertIn('display: block', html) # is_full_width: True

        self.assertIn('href="https://link2.com"', html)
        self.assertIn('CTA 2', html)
        self.assertIn('background-color: #00ff55', html)
        self.assertIn('color: #000000', html)
        self.assertIn('border-radius: 10px', html)

        # Check poetry stanza parser output
        self.assertIn("Estrofa uno linea uno<br/>Estrofa uno linea dos", html)
        self.assertIn("Estrofa dos linea uno<br/>Estrofa dos linea dos", html)



