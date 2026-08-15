from datetime import datetime

from extensions import db


# =========================================================
# MEETING MODEL
# =========================================================

class Meeting(db.Model):

    __tablename__ = "meetings"


    # =====================================================
    # PRIMARY KEY
    # =====================================================

    id = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )


    # =====================================================
    # UNIQUE MEETING ID
    # Example: 131B847C
    # =====================================================

    meeting_id = db.Column(
        db.String(20),
        unique=True,
        nullable=False,
        index=True
    )


    # =====================================================
    # MEETING TITLE
    # =====================================================

    title = db.Column(
        db.String(200),
        nullable=False
    )


    # =====================================================
    # MEETING TYPE
    # =====================================================

    meeting_type = db.Column(
        db.String(50),
        nullable=False,
        default="meeting"
    )


    # =====================================================
    # MEETING CREATOR
    # =====================================================

    created_by = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id"
        ),
        nullable=True
    )


    # =====================================================
    # RELATIONSHIP WITH USER
    # =====================================================

    creator = db.relationship(
        "User",
        backref="meetings",
        foreign_keys=[created_by]
    )


    # =====================================================
    # CREATED TIME
    # =====================================================

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )


    # =====================================================
    # MEETING STATUS
    # =====================================================

    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )


    # =====================================================
    # STRING REPRESENTATION
    # =====================================================

    def __repr__(self):

        return (
            f"<Meeting "
            f"{self.meeting_id} "
            f"{self.title}>"
        )