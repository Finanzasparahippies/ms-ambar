from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'phone', 'password', 'password_confirm')
        extra_kwargs = {
            'phone': {'required': False, 'allow_null': True, 'allow_blank': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        user = User.objects.create(
            email=validated_data['email'],
            username=validated_data['username'],
            phone=validated_data.get('phone', '')
        )
        user.set_password(password)
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    token = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden."})
        return attrs


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_staff'] = user.is_staff
        token['email'] = user.email
        token['username'] = user.username
        return token


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'phone', 'first_name', 'last_name')
        read_only_fields = ('id', 'email')
