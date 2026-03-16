"""
Authentication API Tests
"""
import pytest
from httpx import AsyncClient


class TestAuthLogin:
    """Tests for /auth/login endpoint."""
    
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user):
        """Test successful login with valid credentials."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "password123"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    @pytest.mark.asyncio
    async def test_login_invalid_email(self, client: AsyncClient):
        """Test login with non-existent email."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@example.com", "password": "password123"},
        )
        
        assert response.status_code == 401
        assert "Invalid" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        """Test login with wrong password."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "wrongpassword"},
        )
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_login_invalid_email_format(self, client: AsyncClient):
        """Test login with invalid email format."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "invalid-email", "password": "password123"},
        )
        
        assert response.status_code == 422


class TestAuthRegister:
    """Tests for /auth/register endpoint."""
    
    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient):
        """Test successful user registration."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "password123",
                "full_name": "New User",
                "role": "patient",
            },
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        # API returns user object directly
        assert data["email"] == "newuser@example.com"
        assert data["full_name"] == "New User"
    
    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, test_user):
        """Test registration with existing email."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "testuser@example.com",  # Already exists
                "password": "password123",
                "full_name": "Duplicate User",
                "role": "patient",
            },
        )
        
        assert response.status_code in [400, 409]
    
    @pytest.mark.asyncio
    async def test_register_weak_password(self, client: AsyncClient):
        """Test registration with weak password."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "weakpass@example.com",
                "password": "123",  # Too short
                "full_name": "Weak Password User",
                "role": "patient",
            },
        )
        
        assert response.status_code == 422


class TestAuthMe:
    """Tests for /auth/me endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, auth_headers):
        """Test getting current user info."""
        response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"
    
    @pytest.mark.asyncio
    async def test_get_current_user_no_auth(self, client: AsyncClient):
        """Test getting current user without authentication."""
        response = await client.get("/api/v1/auth/me")
        
        # API returns 403 Forbidden (no credentials) rather than 401 Unauthorized
        assert response.status_code in [401, 403]
    
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test getting current user with invalid token."""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        
        assert response.status_code == 401


class TestAuthRefresh:
    """Tests for /auth/refresh endpoint."""
    
    @pytest.mark.asyncio
    async def test_refresh_token(self, client: AsyncClient, test_user):
        """Test refreshing access token."""
        # First login to get tokens
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "password123"},
        )
        refresh_token = login_response.json()["refresh_token"]
        
        # Refresh the token
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
    
    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client: AsyncClient):
        """Test refreshing with invalid token."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-refresh-token"},
        )
        
        assert response.status_code == 401
