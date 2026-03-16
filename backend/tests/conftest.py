"""
Pytest configuration and fixtures.

This module provides shared fixtures for all tests.
"""
import asyncio
from typing import AsyncGenerator, Generator
from uuid import uuid4
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import event, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings
from app.models.user import User, UserRole
from app.core.security import get_password_hash


# Test database URL (use SQLite for tests with special handling for UUID)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


def _patch_postgres_types_for_sqlite():
    """Patch PostgreSQL-specific types to compile and work for SQLite."""
    from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
    from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
    
    # Patch UUID - store as VARCHAR(36)
    if not hasattr(SQLiteTypeCompiler, 'visit_UUID'):
        SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "VARCHAR(36)"
    
    # Patch ARRAY - store as TEXT (JSON serialized)
    if not hasattr(SQLiteTypeCompiler, 'visit_ARRAY'):
        SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"
    
    # Patch JSONB - store as TEXT
    if not hasattr(SQLiteTypeCompiler, 'visit_JSONB'):
        SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"
    
    # Patch UUID bind processor for SQLite to handle Python UUID objects
    original_bind_processor = PostgresUUID.bind_processor
    
    def patched_bind_processor(self, dialect):
        if dialect.name == "sqlite":
            def process(value):
                if value is not None:
                    if isinstance(value, uuid.UUID):
                        return str(value)
                    return str(value)
                return value
            return process
        return original_bind_processor(self, dialect)
    
    PostgresUUID.bind_processor = patched_bind_processor
    
    # Patch UUID result processor for SQLite to return proper UUID objects
    original_result_processor = PostgresUUID.result_processor
    
    def patched_result_processor(self, dialect, coltype):
        if dialect.name == "sqlite":
            def process(value):
                if value is not None and self.as_uuid:
                    if isinstance(value, uuid.UUID):
                        return value
                    return uuid.UUID(value)
                return value
            return process
        return original_result_processor(self, dialect, coltype)
    
    PostgresUUID.result_processor = patched_result_processor


# Apply the patches immediately when conftest is loaded
_patch_postgres_types_for_sqlite()


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create async engine for tests."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with overridden database dependency."""
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        id=uuid4(),
        email="testuser@example.com",
        password_hash=get_password_hash("password123"),
        full_name="Test User",
        role=UserRole.PATIENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_patient_user(db_session: AsyncSession) -> User:
    """Create a test patient user."""
    user = User(
        id=uuid4(),
        email="patient@example.com",
        password_hash=get_password_hash("password123"),
        full_name="Test Patient",
        role=UserRole.PATIENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_doctor_user(db_session: AsyncSession) -> User:
    """Create a test doctor user."""
    user = User(
        id=uuid4(),
        email="doctor@example.com",
        password_hash=get_password_hash("password123"),
        full_name="Dr. Test Doctor",
        role=UserRole.DOCTOR_DAYCARE,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_nurse_user(db_session: AsyncSession) -> User:
    """Create a test nurse user."""
    user = User(
        id=uuid4(),
        email="nurse@example.com",
        password_hash=get_password_hash("password123"),
        full_name="Test Nurse",
        role=UserRole.NURSE,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_user: User) -> dict:
    """Get authentication headers for a test user."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "password123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def patient_auth_headers(client: AsyncClient, test_patient_user: User) -> dict:
    """Get authentication headers for a patient user."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "patient@example.com", "password": "password123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def doctor_auth_headers(client: AsyncClient, test_doctor_user: User) -> dict:
    """Get authentication headers for a doctor user."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "doctor@example.com", "password": "password123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def nurse_auth_headers(client: AsyncClient, test_nurse_user: User) -> dict:
    """Get authentication headers for a nurse user."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nurse@example.com", "password": "password123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
