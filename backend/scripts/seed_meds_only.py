import asyncio
import sys
from datetime import date, datetime, timedelta
from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.treatment import TreatmentCycle, DrugAdministration, CycleStatus, AdminStatus

# Ensure sys path
sys.path.append("/Users/moinmakda/chemo-daycare/backend")

async def seed_meds():
    async with async_session_maker() as db:
        print("Seeding medications for today's cycle...")
        
        today = date.today()
        
        # 1. Find today's active cycle
        stmt = select(TreatmentCycle).where(
            TreatmentCycle.scheduled_date == today
        )
        result = await db.execute(stmt)
        cycles = result.scalars().all()
        
        if not cycles:
            print("No cycles found for today!")
            return
            
        cycle = cycles[0]
        print(f"Found active cycle: {cycle.id}")
        
        # 2. Check if drugs already exist (just in case)
        stmt_drugs = select(DrugAdministration).where(DrugAdministration.cycle_id == cycle.id)
        d_res = await db.execute(stmt_drugs)
        existing_drugs = d_res.scalars().all()
        
        if existing_drugs:
            print(f"Cycle already has {len(existing_drugs)} drugs.")
        else:
            print("Adding drugs...")
            # Add 2 dummy drugs
            
            # Drug 1: Paclitaxel
            d1 = DrugAdministration(
                cycle_id=cycle.id,
                drug_name="Paclitaxel",
                planned_dose=175,
                unit="mg/m2",
                route="IV Infusion",
                status=AdminStatus.PENDING,
                planned_duration_mins=180,
                scheduled_time=(datetime.now() + timedelta(hours=1)).time()
            )
            
            # Drug 2: Carboplatin
            d2 = DrugAdministration(
                cycle_id=cycle.id,
                drug_name="Carboplatin",
                planned_dose=5, # AUC
                unit="AUC",
                route="IV Infusion",
                status=AdminStatus.PENDING,
                planned_duration_mins=60,
                scheduled_time=(datetime.now() + timedelta(hours=4)).time()
            )
            
            db.add(d1)
            db.add(d2)
            await db.commit()
            print("Added 2 drugs successfully.")

if __name__ == "__main__":
    asyncio.run(seed_meds())
