from datetime import datetime

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from extensions import db


# =========================================================
# USER MODEL
# =========================================================

class User(db.Model):

    __tablename__ = "users"


    # =====================================================
    # PRIMARY KEY
    # =====================================================

    id = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )


    # =====================================================
    # USER NAME
    # =====================================================
    # Python attribute:
    #     user.name
    #
    # MySQL column:
    #     full_name
    # =====================================================

    name = db.Column(
        "full_name",
        db.String(100),
        nullable=False
    )


    # =====================================================
    # EMAIL
    # =====================================================

    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False,
        index=True
    )


    # =====================================================
    # PASSWORD HASH
    # =====================================================

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )


    # =====================================================
    # EMAIL VERIFIED
    # =====================================================

    is_verified = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )


    # =====================================================
    # ACCOUNT ACTIVE
    # =====================================================

    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )


    # =====================================================
    # ACCOUNT CREATED TIME
    # =====================================================

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )


    # =====================================================
    # ACCOUNT UPDATED TIME
    # =====================================================

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=True
    )


    # =====================================================
    # SET PASSWORD
    # =====================================================

    def set_password(self, password):

        self.password_hash = generate_password_hash(
            password
        )


    # =====================================================
    # CHECK PASSWORD
    # =====================================================

    def check_password(self, password):

        return check_password_hash(
            self.password_hash,
            password
        )


    # =====================================================
    # STRING REPRESENTATION
    # =====================================================

    def __repr__(self):

        return (
            f"<User "
            f"id={self.id} "
            f"email={self.email}>"
        )