from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from db import Base


class Car(Base):
    __tablename__ = "cars"

    id = Column(Integer, primary_key=True)
    year = Column(Integer)
    make = Column(String(100))
    model = Column(String(150))
    query_key = Column(String(300), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    images = relationship("CarImage", back_populates="car", cascade="all, delete-orphan")
    load_events = relationship("LoadEvent", back_populates="car", cascade="all, delete-orphan")


class CarImage(Base):
    __tablename__ = "car_images"
    __table_args__ = (UniqueConstraint("car_id", name="uq_car_images_car_id"),)

    id = Column(Integer, primary_key=True)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    image_url = Column(Text)
    source = Column(String(50))
    error = Column(String(50))
    fetched_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime, server_default=func.now(), nullable=False)

    car = relationship("Car", back_populates="images")


class LoadEvent(Base):
    __tablename__ = "load_events"

    id = Column(Integer, primary_key=True)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    units = Column(String(20))
    altitude_m = Column(Float)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    car = relationship("Car", back_populates="load_events")
    calculations = relationship("Calculation", back_populates="load_event", cascade="all, delete-orphan")


class Calculation(Base):
    __tablename__ = "calculations"

    id = Column(Integer, primary_key=True)
    load_event_id = Column(Integer, ForeignKey("load_events.id"), nullable=False)
    aspiration = Column(String(20))
    maintenance_state = Column(String(20))
    compression = Column(Float)
    boost_bar = Column(Float)
    iat_rise_c = Column(Float)
    base_octane_aki = Column(Float)
    mileage_miles = Column(Float)
    octane_center = Column(Float)
    ambient_center_c = Column(Float)
    ambient_center_display = Column(Float)
    units = Column(String(20))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    load_event = relationship("LoadEvent", back_populates="calculations")
