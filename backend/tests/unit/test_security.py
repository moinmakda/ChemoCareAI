"""
Unit Tests for Security Module
"""
import pytest

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
)


class TestPasswordHashing:
    """Tests for password hashing functions."""
    
    def test_hash_password(self):
        """Test password hashing."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert len(hashed) > 0
    
    def test_verify_correct_password(self):
        """Test verifying correct password."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_wrong_password(self):
        """Test verifying wrong password."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        assert verify_password("wrongpassword", hashed) is False
    
    def test_different_hashes_for_same_password(self):
        """Test that same password produces different hashes (salting)."""
        password = "testpassword123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        assert hash1 != hash2
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestTokenCreation:
    """Tests for JWT token creation."""
    
    def test_create_access_token(self):
        """Test access token creation."""
        user_id = "user-123"
        role = "PATIENT"
        token = create_access_token(user_id, role)
        
        assert token is not None
        assert len(token) > 0
        assert "." in token  # JWT format
    
    def test_create_access_token_includes_role(self):
        """Test access token includes role claim."""
        user_id = "user-123"
        role = "DOCTOR_DAYCARE"
        token = create_access_token(user_id, role)
        
        # Decode without verification to check claims
        from jose import jwt
        from app.core.config import settings
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        assert payload["sub"] == user_id
        assert payload["role"] == role
        assert payload["type"] == "access"
    
    def test_create_refresh_token(self):
        """Test refresh token creation."""
        user_id = "user-123"
        token = create_refresh_token(user_id)
        
        assert token is not None
        assert len(token) > 0
