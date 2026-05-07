from rest_framework import serializers
from .models import BookingInquiry

class BookingInquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingInquiry
        fields = '__all__'
