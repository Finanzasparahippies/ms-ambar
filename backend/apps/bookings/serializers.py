from rest_framework import serializers
from .models import BookingInquiry, BookingContract

class BookingInquirySerializer(serializers.ModelSerializer):
    contract_id = serializers.ReadOnlyField(source='contract.id')
    class Meta:
        model = BookingInquiry
        fields = ['id', 'name', 'email', 'phone', 'company', 'date', 'venue_type', 'message', 'created_at', 'is_reviewed', 'contract_id']

class BookingContractSerializer(serializers.ModelSerializer):
    inquiry_detail = BookingInquirySerializer(source='inquiry', read_only=True)
    class Meta:
        model = BookingContract
        fields = '__all__'

