"""add_composite_indexes

Revision ID: 721b3883fbc5
Revises: 5b7c70a2e9bf
Create Date: 2026-03-20 11:04:43.099174

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '721b3883fbc5'
down_revision: Union[str, Sequence[str], None] = '5b7c70a2e9bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None




def upgrade():
    # Blueprint Indexing Strategy
    op.create_index("ix_orders_restaurant_created",
        "orders", ["restaurant_id", "created_at"])
    op.create_index("ix_order_items_order",
        "order_items", ["order_id"])
    op.create_index("ix_menu_items_restaurant_category",
        "menu_items", ["restaurant_id", "category_id", "is_available"])
    op.create_index("ix_customers_phone",
        "customers", ["phone_encrypted"])
   

def downgrade():
    op.drop_index("ix_orders_restaurant_created")
    op.drop_index("ix_order_items_order")
    op.drop_index("ix_menu_items_restaurant_category")
    op.drop_index("ix_customers_phone")
    