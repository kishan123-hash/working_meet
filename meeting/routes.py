from flask import (
    Blueprint,
    render_template,
    redirect,
    url_for,
    request,
    flash,
    session,
    jsonify
)

from functools import wraps

import uuid
import random
import smtplib
import os
import time

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from extensions import db


# =========================================================
# MEETING BLUEPRINT
# =========================================================

meeting_bp = Blueprint(
    "meeting",
    __name__,
    url_prefix="/meeting"
)


# =========================================================
# LOGIN REQUIRED DECORATOR
# =========================================================

def login_required(function):

    @wraps(function)
    def decorated_function(*args, **kwargs):

        if "user_id" not in session:

            flash(
                "Please login first.",
                "error"
            )

            return redirect(
                url_for("meeting.login")
            )

        return function(
            *args,
            **kwargs
        )

    return decorated_function


# =========================================================
# REGISTER
# =========================================================

@meeting_bp.route(
    "/register",
    methods=["GET", "POST"]
)
def register():

    # -----------------------------------------------------
    # SHOW REGISTER PAGE
    # -----------------------------------------------------

    if request.method == "GET":

        return render_template(
            "auth/register.html"
        )

    # -----------------------------------------------------
    # USER MODEL
    # -----------------------------------------------------

    from models.user import User

    # -----------------------------------------------------
    # FORM DATA
    # -----------------------------------------------------

    name = request.form.get(
        "name",
        ""
    ).strip()

    email = request.form.get(
        "email",
        ""
    ).strip().lower()

    password = request.form.get(
        "password",
        ""
    )

    confirm_password = request.form.get(
        "confirm_password",
        ""
    )

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    if not name:

        flash(
            "Please enter your name.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.register"
            )
        )

    if not email:

        flash(
            "Please enter your email.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.register"
            )
        )

    if len(password) < 6:

        flash(
            "Password must contain at least 6 characters.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.register"
            )
        )

    if password != confirm_password:

        flash(
            "Passwords do not match.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.register"
            )
        )

    # -----------------------------------------------------
    # CHECK EXISTING USER
    # -----------------------------------------------------

    try:

        existing_user = User.query.filter_by(
            email=email
        ).first()

    except Exception as e:

        db.session.rollback()

        print()
        print("=" * 70)
        print("REGISTRATION DATABASE ERROR")
        print("=" * 70)
        print(str(e))
        print("=" * 70)
        print()

        flash(
            "Database error while checking your account.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.register"
            )
        )

    # -----------------------------------------------------
    # USER ALREADY EXISTS
    # -----------------------------------------------------

    if existing_user:

        flash(
            "An account with this email already exists.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.register"
            )
        )

    # -----------------------------------------------------
    # CREATE USER
    # -----------------------------------------------------
    #
    # Registration OTP has been removed.
    #
    # Your current User model contains:
    #
    # id
    # name
    # email
    # password_hash
    # created_at
    #
    # Therefore we only use the fields supported
    # by the current User model.
    #
    # -----------------------------------------------------

    user = User(
        name=name,
        email=email
    )

    # -----------------------------------------------------
    # HASH PASSWORD
    # -----------------------------------------------------

    user.set_password(
        password
    )

    # -----------------------------------------------------
    # SAVE USER
    # -----------------------------------------------------

    try:

        db.session.add(
            user
        )

        db.session.commit()

    except Exception as e:

        db.session.rollback()

        print()
        print("=" * 70)
        print("REGISTRATION SAVE ERROR")
        print("=" * 70)
        print(str(e))
        print("=" * 70)
        print()

        flash(
            "Registration failed. Please try again.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.register"
            )
        )

    # -----------------------------------------------------
    # CLEAR ANY OLD REGISTRATION OTP SESSION DATA
    # -----------------------------------------------------

    session.pop(
        "registration_otp",
        None
    )

    session.pop(
        "registration_email",
        None
    )

    session.pop(
        "registration_otp_time",
        None
    )

    # -----------------------------------------------------
    # SUCCESS
    # -----------------------------------------------------

    flash(
        "Registration successful. Please login.",
        "success"
    )

    return redirect(
        url_for(
            "meeting.login"
        )
    )


# =========================================================
# LOGIN
# =========================================================

@meeting_bp.route(
    "/login",
    methods=["GET", "POST"]
)
def login():

    # -----------------------------------------------------
    # ALREADY LOGGED IN
    # -----------------------------------------------------

    if "user_id" in session:

        return redirect(
            url_for(
                "meeting.meeting_home"
            )
        )

    # -----------------------------------------------------
    # SHOW LOGIN PAGE
    # -----------------------------------------------------

    if request.method == "GET":

        return render_template(
            "auth/login.html"
        )

    # -----------------------------------------------------
    # USER MODEL
    # -----------------------------------------------------

    from models.user import User

    # -----------------------------------------------------
    # FORM DATA
    # -----------------------------------------------------

    email = request.form.get(
        "email",
        ""
    ).strip().lower()

    password = request.form.get(
        "password",
        ""
    )

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    if not email or not password:

        flash(
            "Please enter email and password.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.login"
            )
        )

    # -----------------------------------------------------
    # FIND USER
    # -----------------------------------------------------

    try:

        user = User.query.filter_by(
            email=email
        ).first()

    except Exception as e:

        db.session.rollback()

        print()
        print("LOGIN DATABASE ERROR")
        print(str(e))
        print()

        flash(
            "Database error. Please try again.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.login"
            )
        )

    # -----------------------------------------------------
    # USER NOT FOUND
    # -----------------------------------------------------

    if user is None:

        flash(
            "Invalid email or password.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.login"
            )
        )

    # -----------------------------------------------------
    # CHECK PASSWORD
    # -----------------------------------------------------

    if not user.check_password(
        password
    ):

        flash(
            "Invalid email or password.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.login"
            )
        )

    # -----------------------------------------------------
    # LOGIN
    # -----------------------------------------------------

    session.clear()

    session["user_id"] = user.id

    session["user_name"] = user.name

    session["user_email"] = user.email

    flash(
        f"Welcome back, {user.name}!",
        "success"
    )

    return redirect(
        url_for(
            "meeting.meeting_home"
        )
    )


# =========================================================
# LOGOUT
# =========================================================

@meeting_bp.route(
    "/logout"
)
def logout():

    session.clear()

    flash(
        "You have been logged out.",
        "success"
    )

    return redirect(
        url_for(
            "meeting.login"
        )
    )


# =========================================================
# FORGOT PASSWORD
# =========================================================

@meeting_bp.route(
    "/forgot-password",
    methods=["GET", "POST"]
)
def forgot_password():

    # -----------------------------------------------------
    # SHOW FORGOT PASSWORD PAGE
    # -----------------------------------------------------

    if request.method == "GET":

        return render_template(
            "auth/forgot_password.html"
        )

    # -----------------------------------------------------
    # GET EMAIL
    # -----------------------------------------------------

    email = request.form.get(
        "email",
        ""
    ).strip().lower()

    if not email:

        flash(
            "Please enter your email address.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.forgot_password"
            )
        )

    # -----------------------------------------------------
    # USER MODEL
    # -----------------------------------------------------

    from models.user import User

    # -----------------------------------------------------
    # FIND USER
    # -----------------------------------------------------

    try:

        user = User.query.filter_by(
            email=email
        ).first()

    except Exception as e:

        db.session.rollback()

        print(
            "FORGOT PASSWORD DATABASE ERROR:",
            e
        )

        flash(
            "Database error. Please try again.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.forgot_password"
            )
        )

    # -----------------------------------------------------
    # USER NOT FOUND
    # -----------------------------------------------------

    if not user:

        flash(
            "No account was found with this email address.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.forgot_password"
            )
        )

    # -----------------------------------------------------
    # MAIL CONFIG
    # -----------------------------------------------------

    sender_email = os.getenv(
        "MAIL_USERNAME"
    )

    sender_password = os.getenv(
        "MAIL_PASSWORD"
    )

    if not sender_email or not sender_password:

        flash(
            "Email configuration is missing in .env",
            "error"
        )

        return redirect(
            url_for(
                "meeting.forgot_password"
            )
        )

    # -----------------------------------------------------
    # GENERATE OTP
    # -----------------------------------------------------

    otp = str(
        random.randint(
            100000,
            999999
        )
    )

    # -----------------------------------------------------
    # EMAIL MESSAGE
    # -----------------------------------------------------

    message = MIMEMultipart()

    message["From"] = sender_email

    message["To"] = email

    message["Subject"] = (
        "MeetSpace Password Reset OTP"
    )

    body = f"""
Hello,

Your MeetSpace password reset OTP is:

{otp}

This OTP is valid for 5 minutes.

If you did not request this password reset, please ignore this email.

Regards,
MeetSpace Team
"""

    message.attach(
        MIMEText(
            body,
            "plain"
        )
    )

    # -----------------------------------------------------
    # SEND PASSWORD RESET OTP
    # -----------------------------------------------------

    try:

        with smtplib.SMTP(
            "smtp.gmail.com",
            587,
            timeout=30
        ) as server:

            server.ehlo()

            server.starttls()

            server.ehlo()

            server.login(
                sender_email,
                sender_password
            )

            server.sendmail(
                sender_email,
                email,
                message.as_string()
            )

        # -------------------------------------------------
        # SAVE OTP IN SESSION
        # -------------------------------------------------

        session[
            "forgot_password_otp"
        ] = otp

        session[
            "forgot_password_email"
        ] = email

        session[
            "forgot_password_otp_time"
        ] = time.time()

        session.modified = True

        print()
        print("=" * 60)
        print("PASSWORD RESET OTP SENT")
        print("=" * 60)
        print("Email :", email)
        print("OTP   :", otp)
        print("=" * 60)
        print()

        flash(
            "OTP sent successfully to your email.",
            "success"
        )

        return redirect(
            url_for(
                "meeting.reset_password"
            )
        )

    except Exception as e:

        print()
        print("=" * 60)
        print("PASSWORD RESET EMAIL ERROR")
        print("=" * 60)
        print(str(e))
        print("=" * 60)
        print()

        flash(
            "Could not send OTP. Please check your email configuration.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.forgot_password"
            )
        )


# =========================================================
# RESET PASSWORD
# =========================================================

@meeting_bp.route(
    "/reset-password",
    methods=["GET", "POST"]
)
def reset_password():

    # -----------------------------------------------------
    # GET SAVED OTP
    # -----------------------------------------------------

    saved_otp = session.get(
        "forgot_password_otp"
    )

    email = session.get(
        "forgot_password_email"
    )

    otp_time = session.get(
        "forgot_password_otp_time"
    )

    # -----------------------------------------------------
    # CHECK OTP SESSION
    # -----------------------------------------------------

    if not saved_otp or not email:

        flash(
            "Please request a password reset OTP first.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.forgot_password"
            )
        )

    # -----------------------------------------------------
    # CHECK OTP EXPIRY
    # -----------------------------------------------------

    if otp_time:

        if time.time() - otp_time > 300:

            session.pop(
                "forgot_password_otp",
                None
            )

            session.pop(
                "forgot_password_email",
                None
            )

            session.pop(
                "forgot_password_otp_time",
                None
            )

            flash(
                "OTP has expired. Please request a new OTP.",
                "error"
            )

            return redirect(
                url_for(
                    "meeting.forgot_password"
                )
            )

    # -----------------------------------------------------
    # SHOW RESET PAGE
    # -----------------------------------------------------

    if request.method == "GET":

        return render_template(
            "auth/reset_password.html",
            email=email
        )

    # -----------------------------------------------------
    # FORM DATA
    # -----------------------------------------------------

    otp = request.form.get(
        "otp",
        ""
    ).strip()

    password = request.form.get(
        "password",
        ""
    )

    confirm_password = request.form.get(
        "confirm_password",
        ""
    )

    # -----------------------------------------------------
    # CHECK OTP
    # -----------------------------------------------------

    if otp != saved_otp:

        flash(
            "Invalid OTP.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.reset_password"
            )
        )

    # -----------------------------------------------------
    # PASSWORD VALIDATION
    # -----------------------------------------------------

    if len(password) < 6:

        flash(
            "Password must contain at least 6 characters.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.reset_password"
            )
        )

    if password != confirm_password:

        flash(
            "Passwords do not match.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.reset_password"
            )
        )

    # -----------------------------------------------------
    # USER MODEL
    # -----------------------------------------------------

    from models.user import User

    # -----------------------------------------------------
    # UPDATE PASSWORD
    # -----------------------------------------------------

    try:

        user = User.query.filter_by(
            email=email
        ).first()

        if not user:

            flash(
                "User account was not found.",
                "error"
            )

            return redirect(
                url_for(
                    "meeting.forgot_password"
                )
            )

        user.set_password(
            password
        )

        db.session.commit()

    except Exception as e:

        db.session.rollback()

        print()
        print("=" * 60)
        print("PASSWORD RESET DATABASE ERROR")
        print("=" * 60)
        print(str(e))
        print("=" * 60)
        print()

        flash(
            "Could not reset password. Please try again.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.reset_password"
            )
        )

    # -----------------------------------------------------
    # CLEAR RESET SESSION
    # -----------------------------------------------------

    session.pop(
        "forgot_password_otp",
        None
    )

    session.pop(
        "forgot_password_email",
        None
    )

    session.pop(
        "forgot_password_otp_time",
        None
    )

    # -----------------------------------------------------
    # SUCCESS
    # -----------------------------------------------------

    flash(
        "Password reset successfully. Please login.",
        "success"
    )

    return redirect(
        url_for(
            "meeting.login"
        )
    )


# =========================================================
# MEETING HOME
# =========================================================

@meeting_bp.route("/")
def meeting_home():

    return render_template(
        "meeting/home.html"
    )


# =========================================================
# CREATE MEETING
# =========================================================

@meeting_bp.route(
    "/create",
    methods=["GET", "POST"]
)
@login_required
def create_meeting():

    # -----------------------------------------------------
    # SHOW CREATE MEETING PAGE
    # -----------------------------------------------------

    if request.method == "GET":

        return render_template(
            "meeting/create_meeting.html"
        )

    # -----------------------------------------------------
    # FORM DATA
    # -----------------------------------------------------

    title = request.form.get(
        "title",
        ""
    ).strip()

    meeting_type = request.form.get(
        "meeting_type",
        "meeting"
    ).strip()

    # -----------------------------------------------------
    # VALIDATE TITLE
    # -----------------------------------------------------

    if not title:

        flash(
            "Please enter a meeting title.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.create_meeting"
            )
        )

    if not meeting_type:

        meeting_type = "meeting"

    # -----------------------------------------------------
    # GENERATE UNIQUE MEETING ID
    # -----------------------------------------------------

    meeting_id = uuid.uuid4().hex[
        :8
    ].upper()

    # -----------------------------------------------------
    # MEETING MODEL
    # -----------------------------------------------------

    from models.meeting import Meeting

    # -----------------------------------------------------
    # CREATE MEETING OBJECT
    # -----------------------------------------------------

    meeting = Meeting(
        meeting_id=meeting_id,
        title=title,
        meeting_type=meeting_type,
        created_by=session.get(
            "user_id"
        )
    )

    # -----------------------------------------------------
    # SAVE TO DATABASE
    # -----------------------------------------------------

    try:

        db.session.add(
            meeting
        )

        db.session.commit()

        print()
        print("=" * 70)
        print("✅ NEW MEETING CREATED")
        print("=" * 70)
        print(
            "Meeting ID   :",
            meeting_id
        )
        print(
            "Title        :",
            title
        )
        print(
            "Meeting Type :",
            meeting_type
        )
        print(
            "Created By   :",
            session.get(
                "user_name"
            )
        )
        print("=" * 70)
        print()

    except Exception as e:

        db.session.rollback()

        # IMPORTANT:
        # Print complete database traceback/error.

        import traceback

        print()
        print("=" * 70)
        print("❌ MEETING CREATION ERROR")
        print("=" * 70)

        traceback.print_exc()

        print("=" * 70)
        print()

        flash(
            f"Could not create meeting: {str(e)}",
            "error"
        )

        return redirect(
            url_for(
                "meeting.create_meeting"
            )
        )

    # -----------------------------------------------------
    # OPEN MEETING ROOM
    # -----------------------------------------------------

    return redirect(
        url_for(
            "meeting.meeting_room",
            meeting_id=meeting_id
        )
    )


# =========================================================
# START MEETING
# =========================================================

@meeting_bp.route(
    "/start",
    methods=["GET", "POST"]
)
@login_required
def start_meeting():

    meeting_id = uuid.uuid4().hex[
        :8
    ].upper()

    return redirect(
        url_for(
            "meeting.meeting_room",
            meeting_id=meeting_id
        )
    )


# =========================================================
# JOIN MEETING
# =========================================================

@meeting_bp.route(
    "/join",
    methods=["GET", "POST"]
)
@login_required
def join_meeting():

    # -----------------------------------------------------
    # SHOW JOIN PAGE
    # -----------------------------------------------------

    if request.method == "GET":

        return render_template(
            "meeting/join_meeting.html"
        )

    # -----------------------------------------------------
    # GET MEETING CODE
    # -----------------------------------------------------

    meeting_code = request.form.get(
        "meeting_code",
        ""
    ).strip().upper()

    # -----------------------------------------------------
    # REMOVE SPACES AND HYPHENS
    # -----------------------------------------------------

    meeting_code = (
        meeting_code
        .replace(
            " ",
            ""
        )
        .replace(
            "-",
            ""
        )
    )

    # -----------------------------------------------------
    # VALIDATE CODE
    # -----------------------------------------------------

    if not meeting_code:

        flash(
            "Please enter a meeting code.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.join_meeting"
            )
        )

    if len(meeting_code) < 4:

        flash(
            "Please enter a valid meeting code.",
            "error"
        )

        return redirect(
            url_for(
                "meeting.join_meeting"
            )
        )

    # -----------------------------------------------------
    # PRINT JOIN INFORMATION
    # -----------------------------------------------------

    print()
    print("=" * 55)
    print("JOIN MEETING")
    print("=" * 55)
    print(
        "Meeting ID :",
        meeting_code
    )
    print(
        "User       :",
        session.get(
            "user_name"
        )
    )
    print("=" * 55)
    print()

    # -----------------------------------------------------
    # OPEN MEETING ROOM
    # -----------------------------------------------------

    return redirect(
        url_for(
            "meeting.meeting_room",
            meeting_id=meeting_code
        )
    )


# =========================================================
# DIRECT JOIN
# =========================================================

@meeting_bp.route(
    "/join/<meeting_id>"
)
@login_required
def direct_join(
    meeting_id
):

    meeting_id = (
        meeting_id
        .strip()
        .upper()
    )

    return redirect(
        url_for(
            "meeting.meeting_room",
            meeting_id=meeting_id
        )
    )


# =========================================================
# MEETING ROOM
# =========================================================

@meeting_bp.route(
    "/room/<meeting_id>"
)
@login_required
def meeting_room(
    meeting_id
):

    meeting_id = (
        meeting_id
        .strip()
        .upper()
    )

    return render_template(
        "meeting/meeting_room.html",
        meeting_id=meeting_id,
        user_name=session.get(
            "user_name",
            "Guest"
        ),
        user_id=session.get(
            "user_id"
        )
    )


# =========================================================
# LEAVE MEETING
# =========================================================

@meeting_bp.route(
    "/leave"
)
@login_required
def leave_meeting():

    return redirect(
        url_for(
            "meeting.meeting_home"
        )
    )