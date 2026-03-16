#!/usr/bin/env python3
"""
Add missing columns to the database.
This is a one-time migration script.
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine


async def add_missing_columns():
    """Add avatar and push_token columns if they don't exist."""
    async with engine.begin() as conn:
        # Check existing columns
        result = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users'
        """))
        existing_cols = [row[0] for row in result.fetchall()]
        print(f"Existing columns in users table: {existing_cols}")
        
        # Add missing columns
        if 'avatar' not in existing_cols:
            await conn.execute(text('ALTER TABLE users ADD COLUMN avatar VARCHAR(500)'))
            print('✓ Added avatar column')
        else:
            print('✓ avatar column already exists')
            
        if 'push_token' not in existing_cols:
            await conn.execute(text('ALTER TABLE users ADD COLUMN push_token VARCHAR(255)'))
            print('✓ Added push_token column')
        else:
            print('✓ push_token column already exists')
    
    print("\n✅ Database schema updated successfully!")


if __name__ == "__main__":
    asyncio.run(add_missing_columns())
