import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()


def get_database_url():
    return os.environ.get("DATABASE_URL", "sqlite:///octane.db")


def create_engine_from_env():
    return create_engine(get_database_url(), future=True)


engine = create_engine_from_env()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db():
    Base.metadata.create_all(bind=engine)
