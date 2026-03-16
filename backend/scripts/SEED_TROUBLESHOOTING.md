# Seed Script Troubleshooting Guide

This document describes the errors encountered while running `seed_test_data.py` and their solutions.

## Quick Reference

| Error | Root Cause | Solution |
|-------|-----------|----------|
| `duplicate key value violates unique constraint "ix_users_email"` | FK constraints prevent TRUNCATE | Disable triggers during cleanup |
| `'phone' is an invalid keyword argument for Patient` | Model/seed mismatch | Remove field from seed |
| `'department' is an invalid keyword argument for Doctor` | Model/seed mismatch | Remove field from seed |
| `'heart_rate' is an invalid keyword argument for Vital` | Wrong field name | Use `pulse_bpm` |
| `column "notification_type" does not exist` | Model/DB schema mismatch | Use `type` column |
| `invalid input value for enum notificationtype` | Enum values mismatch | Match database enum values |

---

## Error 1: Foreign Key Constraint Prevents Cleanup

### Error Message
```
⚠ Skipped users: (sqlalchemy.dialects.postgresql.asyncpg.Error)
...
IntegrityError: duplicate key value violates unique constraint "ix_users_email"
DETAIL: Key (email)=(patient@test.com) already exists.
```

### Root Cause
The `TRUNCATE TABLE users CASCADE` command fails silently because:
- `patients`, `doctors`, and `nurses` tables have foreign keys referencing `users.id`
- PostgreSQL's async driver doesn't properly cascade the truncate
- Old users remain in the database, causing duplicate key errors on insert

### Solution
Disable foreign key triggers temporarily during cleanup:

```python
async def cleanup_database(session: AsyncSession):
    try:
        # Disable FK constraint checking
        await session.execute(text("SET session_replication_role = 'replica'"))
        
        # Truncate all tables
        for table in tables_to_truncate:
            await session.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        
        await session.commit()
    finally:
        # Re-enable FK constraint checking
        await session.execute(text("SET session_replication_role = 'origin'"))
        await session.commit()
```

---

## Error 2: Invalid Patient Model Fields

### Error Message
```
TypeError: 'phone' is an invalid keyword argument for Patient
```

### Root Cause
The seed data included fields that don't exist on the `Patient` model:
- `phone` - This field is on the `User` model, not `Patient`
- `bsa` - This is a computed `@property`, not a database column

### Actual Patient Model Fields
```python
class Patient(Base):
    id, user_id, first_name, last_name, date_of_birth, gender, blood_group,
    address, city, state, pincode, emergency_contact_name, emergency_contact_phone,
    emergency_contact_relation, height_cm, weight_kg, allergies, comorbidities,
    current_medications, cancer_type, cancer_stage, diagnosis_date,
    histopathology_details, insurance_provider, insurance_policy_number,
    insurance_validity, profile_photo_url, created_at, updated_at
    
    @property
    def bsa(self) -> float:  # Computed, not stored
        ...
```

### Solution
Remove `phone` and `bsa` from Patient seed data.

---

## Error 3: Invalid Doctor Model Fields

### Error Message
```
TypeError: 'department' is an invalid keyword argument for Doctor
```

### Root Cause
The seed data included a `department` field that doesn't exist on the `Doctor` model.

### Actual Doctor Model Fields
```python
class Doctor(Base):
    id, user_id, first_name, last_name, specialization, qualification,
    registration_number, experience_years, is_opd_doctor, is_daycare_doctor,
    profile_photo_url, signature_url, created_at, updated_at
```

### Solution
Remove `department` from Doctor seed data. Use `is_opd_doctor` and `is_daycare_doctor` booleans instead.

---

## Error 4: Invalid Nurse Model Fields

### Error Message
```
TypeError: 'department' is an invalid keyword argument for Nurse
TypeError: 'shift' is an invalid keyword argument for Nurse
```

### Root Cause
The seed data included fields that don't exist on the `Nurse` model.

### Actual Nurse Model Fields
```python
class Nurse(Base):
    id, user_id, first_name, last_name, qualification, registration_number,
    experience_years, chemo_certified, certification_date, profile_photo_url,
    created_at, updated_at
```

### Solution
Remove `department` and `shift` from Nurse seed data.

---

## Error 5: Invalid Vital Model Fields

### Error Message
```
TypeError: 'heart_rate' is an invalid keyword argument for Vital
```

### Root Cause
The seed data used wrong field names:
- `heart_rate` → should be `pulse_bpm`
- `temperature` → doesn't exist, only `temperature_f`

### Actual Vital Model Fields
```python
class Vital(Base):
    id, patient_id, cycle_id, recorded_at, recorded_by,
    temperature_f, pulse_bpm, blood_pressure_systolic, blood_pressure_diastolic,
    respiratory_rate, oxygen_saturation, pain_score, pain_location,
    blood_sugar, weight_kg, notes, timing, ai_alerts
```

### Solution
```python
# Wrong
heart_rate=74,
temperature=36.6,

# Correct
pulse_bpm=74,
temperature_f=97.9,
```

---

## Error 6: Notification Model/Database Schema Mismatch

### Error Message
```
ProgrammingError: column "notification_type" of relation "notifications" does not exist
```

### Root Cause
The SQLAlchemy model defined columns that don't match the actual database schema:

| Model Field | Database Column |
|-------------|-----------------|
| `notification_type` | `type` |
| `message` | `body` |
| `scheduled_for` | *(doesn't exist)* |

### Database Schema (actual)
```sql
-- Columns in notifications table:
id, user_id, type, title, body, data, is_read, read_at, created_at
```

### Solution
Update the model to match the database:

```python
class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)  # was notification_type
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)  # was message
    data = Column(JSONB, nullable=True)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # removed: scheduled_for
```

---

## Error 7: Invalid Enum Values

### Error Message
```
InvalidTextRepresentationError: invalid input value for enum notificationtype: "APPOINTMENT"
```

### Root Cause
The Python enum values don't match the PostgreSQL enum values:

| Python Enum (wrong) | Database Enum (correct) |
|---------------------|------------------------|
| `APPOINTMENT` | *(doesn't exist)* |
| `GENERAL` | *(doesn't exist)* |
| `TREATMENT` | *(doesn't exist)* |
| `appointment` | *(case mismatch)* |

### Database Enum Values (actual)
```sql
-- Values in notificationtype enum:
APPOINTMENT_REMINDER, LAB_REMINDER, APPROVAL_REQUEST, APPROVAL_RECEIVED,
CYCLE_COMPLETED, VITALS_ALERT, REACTION_ALERT, DOCUMENT_UPLOADED, MESSAGE, SYSTEM
```

### Solution
Update the Python enum to match exactly:

```python
class NotificationType(str, PyEnum):
    APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER"
    LAB_REMINDER = "LAB_REMINDER"
    APPROVAL_REQUEST = "APPROVAL_REQUEST"
    APPROVAL_RECEIVED = "APPROVAL_RECEIVED"
    CYCLE_COMPLETED = "CYCLE_COMPLETED"
    VITALS_ALERT = "VITALS_ALERT"
    REACTION_ALERT = "REACTION_ALERT"
    DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
    MESSAGE = "MESSAGE"
    SYSTEM = "SYSTEM"
```

---

## How to Verify Database Schema

Use these commands to check actual database structure:

### Check Table Columns
```python
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check_columns(table_name):
    async with engine.connect() as conn:
        result = await conn.execute(text(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        """))
        for row in result:
            print(f"{row[0]}: {row[1]}")

asyncio.run(check_columns('notifications'))
```

### Check Enum Values
```python
async def check_enum(enum_name):
    async with engine.connect() as conn:
        result = await conn.execute(text(f"SELECT unnest(enum_range(NULL::{enum_name}))"))
        for row in result:
            print(row[0])

asyncio.run(check_enum('notificationtype'))
```

---

## Prevention Strategies

1. **Always verify model matches database** before writing seed data
2. **Use `--dry-run` flag** (if available) to validate data before insert
3. **Check enum values** in database match Python enum exactly
4. **Test seed script** after any model changes
5. **Run database migrations** before seeding if models changed

---

## Files Modified to Fix These Issues

1. `backend/scripts/seed_test_data.py` - Fixed cleanup and seed data
2. `backend/app/models/clinical.py` - Fixed `Notification` model and `NotificationType` enum
3. `backend/app/api/v1/protocol_workflow.py` - Updated notification type references
4. `backend/app/services/scheduling.py` - Updated notification field and type references
