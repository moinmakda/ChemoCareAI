"""
API dependencies for authentication and authorization.
"""
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_token, TokenPayload
from app.models import User, UserRole

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if payload.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    result = await db.execute(select(User).where(User.id == payload.sub))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return current_user


class RoleChecker:
    """Role-based access control dependency."""
    
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user


# Pre-defined role checkers
allow_patients = RoleChecker([UserRole.PATIENT])
allow_doctors = RoleChecker([UserRole.DOCTOR_OPD, UserRole.DOCTOR_DAYCARE])
allow_opd_doctors = RoleChecker([UserRole.DOCTOR_OPD])
allow_daycare_doctors = RoleChecker([UserRole.DOCTOR_DAYCARE])
allow_nurses = RoleChecker([UserRole.NURSE])
allow_medical_staff = RoleChecker([UserRole.DOCTOR_OPD, UserRole.DOCTOR_DAYCARE, UserRole.NURSE])
allow_all_staff = RoleChecker([UserRole.DOCTOR_OPD, UserRole.DOCTOR_DAYCARE, UserRole.NURSE, UserRole.ADMIN])
allow_admin = RoleChecker([UserRole.ADMIN])
allow_all = RoleChecker([UserRole.PATIENT, UserRole.DOCTOR_OPD, UserRole.DOCTOR_DAYCARE, UserRole.NURSE, UserRole.ADMIN])
