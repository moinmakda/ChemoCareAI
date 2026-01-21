#!/bin/bash
cd /Users/moinmakda/chemo-daycare/backend
/Users/moinmakda/chemo-daycare/venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
