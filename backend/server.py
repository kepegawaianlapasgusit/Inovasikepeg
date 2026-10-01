from dotenv import load_dotenv
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.db import client
from app.seed import seed
from app.routers import auth, rbac, master, employees, attendance, modules, dashboard

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("lagusit")

app = FastAPI(title="INFORMASI KEPEGAWAIAN LAGUSIT")


@app.get("/api/")
async def root():
    return {"message": "LAGUSIT API", "status": "ok"}


app.include_router(auth.router)
app.include_router(rbac.router)
app.include_router(master.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(modules.router)
app.include_router(dashboard.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
        logger.info("Seed & indexes ready")
    except Exception as e:
        logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
