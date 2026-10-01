import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def clean(doc):
    """Strip Mongo internal _id so documents are JSON serializable."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


async def log_audit(user, action, module, obj=None, before=None, after=None, request=None):
    ip = None
    if request is not None:
        ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
    entry = {
        "id": new_id(),
        "user_id": (user or {}).get("id"),
        "user_email": (user or {}).get("email"),
        "user_name": (user or {}).get("name"),
        "action": action,
        "module": module,
        "object": obj,
        "before": before,
        "after": after,
        "ip": ip,
        "timestamp": now_iso(),
    }
    await db.audit_logs.insert_one(dict(entry))
    clean(entry)
    return entry
