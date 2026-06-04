from rest_framework import serializers
from .models import Category, Post, NewsletterSubscriber

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class PostSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    class Meta:
        model = Post
        fields = ['id', 'title', 'slug', 'content', 'image', 'category', 'category_name', 'created_at', 'is_published', 'is_notified']

class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = '__all__'

from .models import SESIdentityVerification, EmailCampaign, CampaignTemplateImage

class SESIdentityVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SESIdentityVerification
        fields = '__all__'

class CampaignTemplateImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignTemplateImage
        fields = '__all__'

class EmailCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailCampaign
        fields = '__all__'

    def to_internal_value(self, data):
        """Parse JSON fields that may arrive as stringified JSON (e.g., from FormData).
        Provide defaults if parsing fails.
        """
        import json
        mutable_data = data.copy() if hasattr(data, "copy") else data
        json_fields = ["ctas", "image_style", "custom_styles"]
        for field in json_fields:
            if field in mutable_data and isinstance(mutable_data[field], str):
                try:
                    mutable_data[field] = json.loads(mutable_data[field])
                except json.JSONDecodeError:
                    # Provide sensible defaults when parsing fails
                    mutable_data[field] = [] if field == "ctas" else {}
        # Handle clearing images
        if "bg_image" in mutable_data and mutable_data["bg_image"] in ("null", ""):
            mutable_data["bg_image"] = None
        if "image" in mutable_data and mutable_data["image"] in ("null", ""):
            mutable_data["image"] = None

        return super().to_internal_value(mutable_data)


