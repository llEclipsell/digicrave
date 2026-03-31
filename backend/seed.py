import asyncio
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.restaurant import Restaurant, Table, RestaurantSettings
from app.models.menu import Category, MenuItem
from app.core.config import settings
from app.core.database import Base

async def seed_data():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Create Test Bistro
        r_id = uuid.uuid4()
        restaurant = Restaurant(
            id=r_id,
            name="Test Bistro",
            slug="test-bistro",
            address="123 Validation Way",
            gst_number="22AAAAA0000A1Z5"
        )
        session.add(restaurant)

        # Settings
        r_settings = RestaurantSettings(
            restaurant_id=r_id,
        )
        session.add(r_settings)

        # Create Table 1
        t_id = uuid.uuid4()
        table = Table(
            id=t_id,
            restaurant_id=r_id,
            table_number="1",
        )
        session.add(table)
        
        # Categories
        cat_mains_id = uuid.uuid4()
        cat_drinks_id = uuid.uuid4()
        cat_mains = Category(id=cat_mains_id, restaurant_id=r_id, name="Mains")
        cat_drinks = Category(id=cat_drinks_id, restaurant_id=r_id, name="Beverages")
        session.add_all([cat_mains, cat_drinks])

        # Menu Items
        item1 = MenuItem(
            restaurant_id=r_id,
            category_id=cat_mains_id,
            name="Signature Burger",
            description="Juicy beef patty with caramelized onions and house sauce.",
            price_offline=Decimal("250.00"),
            qr_discount_percent=Decimal("5.00"),
            image_url="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400&h=300"
        )
        item2 = MenuItem(
            restaurant_id=r_id,
            category_id=cat_mains_id,
            name="Margherita Pizza",
            description="Classic wood-fired pizza with fresh basil.",
            price_offline=Decimal("300.00"),
            qr_discount_percent=Decimal("10.00"),
            image_url="https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=400&h=300"
        )
        item3 = MenuItem(
            restaurant_id=r_id,
            category_id=cat_drinks_id,
            name="Fresh Lime Soda",
            description="Chilled and refreshing.",
            price_offline=Decimal("90.00"),
            qr_discount_percent=Decimal("0.00"),
            image_url="https://images.unsplash.com/photo-1575517111478-7f6afd0973db?auto=format&fit=crop&q=80&w=400&h=300"
        )
        session.add_all([item1, item2, item3])

        await session.commit()
        print(f"✅ Successfully seeded Test Bistro!")
        print(f"Slug: test-bistro | Table ID: {t_id}")

if __name__ == "__main__":
    asyncio.run(seed_data())
