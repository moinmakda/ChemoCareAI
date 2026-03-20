"""
SOPHIA Protocol Engine Integration

Deterministic chemotherapy protocol generation engine with 566+ NHS protocols.
Replaces AI-based protocol generation with rule-based dose calculations and safety checks.
"""

from app.services.sophia.sophia_service import (
    get_sophia_engine,
    list_protocols,
    search_protocols,
    get_protocol_detail,
    generate_protocol_from_clinical_data,
    get_protocol_categories,
)

__all__ = [
    "get_sophia_engine",
    "list_protocols",
    "search_protocols",
    "get_protocol_detail",
    "generate_protocol_from_clinical_data",
    "get_protocol_categories",
]
