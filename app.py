import os
from urllib.parse import quote_plus

from flask import Flask, render_template
from dotenv import load_dotenv
from flask import send_from_directory

# =========================================================
# LOAD .ENV
# =========================================================

load_dotenv()


# =========================================================
# IMPORT SHARED EXTENSIONS
# =========================================================
# IMPORTANT:
# db and socketio are created in extensions.py
# so that the same instances are used everywhere.
# =========================================================

from extensions import db, socketio


# =========================================================
# CREATE FLASK APP
# =========================================================

app = Flask(__name__)


# =========================================================
# SECRET KEY
# =========================================================

app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "meetspace-secret-key"
)


# =========================================================
# MYSQL CONFIGURATION
# =========================================================

MYSQL_HOST = os.getenv(
    "MYSQL_HOST",
    "localhost"
)

MYSQL_PORT = os.getenv(
    "MYSQL_PORT",
    "3306"
)

MYSQL_USER = os.getenv(
    "MYSQL_USER",
    "root"
)

MYSQL_PASSWORD = os.getenv(
    "MYSQL_PASSWORD",
    ""
)

MYSQL_DATABASE = os.getenv(
    "MYSQL_DATABASE",
    "meeting_app"
)


# =========================================================
# ENCODE MYSQL PASSWORD
# =========================================================

encoded_password = quote_plus(
    MYSQL_PASSWORD
)


# =========================================================
# DATABASE URL
# =========================================================

DATABASE_URL = (
    f"mysql+pymysql://"
    f"{MYSQL_USER}:"
    f"{encoded_password}@"
    f"{MYSQL_HOST}:"
    f"{MYSQL_PORT}/"
    f"{MYSQL_DATABASE}"
)


app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL

app.config[
    "SQLALCHEMY_TRACK_MODIFICATIONS"
] = False


# =========================================================
# INITIALIZE DATABASE
# =========================================================
# IMPORTANT:
# Do NOT use:
#
# db = SQLAlchemy(app)
#
# because db already exists in extensions.py.
# =========================================================

db.init_app(app)


# =========================================================
# INITIALIZE SOCKET.IO
# =========================================================

socketio.init_app(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    transports=["polling", "websocket"],
    allow_upgrades=True,
    logger=True,
    engineio_logger=True
)


# =========================================================
# IMPORT MODELS
# =========================================================
# This makes sure SQLAlchemy knows about all models.
# =========================================================

from models.user import User
from models.meeting import Meeting


# =========================================================
# IMPORT MEETING BLUEPRINT
# =========================================================

try:

    from meeting.routes import meeting_bp

except ImportError as error:

    print()
    print("❌ ERROR IMPORTING meeting.routes")
    print(error)
    print()

    raise


# =========================================================
# REGISTER MEETING BLUEPRINT
# =========================================================

app.register_blueprint(
    meeting_bp
)


# =========================================================
# IMPORT SOCKET EVENTS
# =========================================================

try:

    from meeting.socket_events import (
        register_socket_events
    )

except ImportError as error:

    print()
    print("❌ ERROR IMPORTING meeting.socket_events")
    print(error)
    print()

    raise


# =========================================================
# REGISTER SOCKET EVENTS
# =========================================================

register_socket_events(
    socketio
)


# =========================================================
# HOME PAGE
# =========================================================

@app.route("/")
def home():

    return render_template(
        "meeting/home.html"
    )

@app.route("/favicon.ico")
def favicon():
    return send_from_directory(
        app.static_folder,
        "favicon.ico",
        mimetype="image/vnd.microsoft.icon"
    )
# =========================================================
# TEST PAGE
# =========================================================

@app.route("/test")
def test():

    return """
    <!DOCTYPE html>

    <html>

    <head>

        <title>MeetSpace Test</title>

        <style>

            * {
                box-sizing: border-box;
            }

            body {

                margin: 0;

                min-height: 100vh;

                display: flex;

                align-items: center;

                justify-content: center;

                font-family: Arial, sans-serif;

                background:
                    linear-gradient(
                        135deg,
                        #020617,
                        #0f172a,
                        #1e1b4b
                    );

                color: white;
            }

            .card {

                width: 500px;

                max-width: 90%;

                padding: 45px;

                text-align: center;

                border-radius: 25px;

                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.08
                    );

                border:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        0.15
                    );

                backdrop-filter:
                    blur(20px);

                box-shadow:
                    0 30px 80px
                    rgba(
                        0,
                        0,
                        0,
                        0.5
                    );
            }

            h1 {

                margin-bottom: 15px;

                font-size: 32px;

                background:
                    linear-gradient(
                        90deg,
                        #38bdf8,
                        #818cf8,
                        #c084fc
                    );

                -webkit-background-clip: text;

                -webkit-text-fill-color:
                    transparent;
            }

            p {

                color: #cbd5e1;

                line-height: 1.7;
            }

            .success {

                color: #4ade80;

                font-weight: bold;
            }

        </style>

    </head>

    <body>

        <div class="card">

            <h1>
                🚀 MeetSpace
            </h1>

            <p class="success">
                Flask server is working!
            </p>

            <p>
                Socket.IO is initialized successfully.
            </p>

            <p>
                Meeting routes are connected.
            </p>

            <p>
                MySQL configuration is loaded.
            </p>

        </div>

    </body>

    </html>
    """


# =========================================================
# DATABASE TEST
# =========================================================

@app.route("/database-test")
def database_test():

    try:

        from sqlalchemy import text

        with db.engine.connect() as connection:

            connection.execute(
                text("SELECT 1")
            )

        return """
        <!DOCTYPE html>

        <html>

        <head>

            <title>
                MeetSpace Database
            </title>

        </head>

        <body
            style="
                margin:0;
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#020617;
                color:white;
                font-family:Arial;
            "
        >

            <div
                style="
                    text-align:center;
                    padding:50px;
                    border-radius:25px;
                    background:#0f172a;
                    box-shadow:0 20px 60px rgba(0,0,0,.5);
                "
            >

                <h1
                    style="
                        color:#4ade80;
                    "
                >
                    ✅ Database Connected
                </h1>

                <p>
                    MySQL connection is working correctly.
                </p>

                <br>

                <a
                    href="/"
                    style="
                        display:inline-block;
                        padding:12px 25px;
                        border-radius:10px;
                        background:#2563eb;
                        color:white;
                        text-decoration:none;
                    "
                >
                    ← Back to MeetSpace
                </a>

            </div>

        </body>

        </html>
        """

    except Exception as error:

        return f"""
        <!DOCTYPE html>

        <html>

        <head>

            <title>
                Database Error
            </title>

        </head>

        <body
            style="
                margin:0;
                padding:50px;
                background:#020617;
                color:white;
                font-family:Arial;
            "
        >

            <h1
                style="
                    color:#ef4444;
                "
            >
                ❌ Database Connection Failed
            </h1>

            <p>
                Check your MySQL server and .env file.
            </p>

            <pre
                style="
                    padding:20px;
                    background:#0f172a;
                    border-radius:10px;
                    white-space:pre-wrap;
                "
            >{error}</pre>

        </body>

        </html>
        """, 500


# =========================================================
# 404 ERROR HANDLER
# =========================================================

@app.errorhandler(404)
def page_not_found(error):

    return """
    <!DOCTYPE html>

    <html>

    <head>

        <title>
            404 | MeetSpace
        </title>

        <style>

            * {
                box-sizing: border-box;
            }

            body {

                margin: 0;

                min-height: 100vh;

                display: flex;

                align-items: center;

                justify-content: center;

                background: #020617;

                color: white;

                font-family: Arial, sans-serif;
            }

            .error {

                text-align: center;

            }

            .number {

                font-size: 110px;

                font-weight: 800;

                margin: 0;

                background:
                    linear-gradient(
                        90deg,
                        #38bdf8,
                        #8b5cf6
                    );

                -webkit-background-clip: text;

                -webkit-text-fill-color:
                    transparent;
            }

            h2 {

                font-size: 30px;

                margin: 5px 0 10px;

            }

            p {

                color: #94a3b8;

            }

            a {

                display: inline-block;

                margin-top: 20px;

                padding: 13px 28px;

                border-radius: 12px;

                background:
                    linear-gradient(
                        135deg,
                        #2563eb,
                        #7c3aed
                    );

                color: white;

                text-decoration: none;

                font-weight: 600;

                transition: .3s;
            }

            a:hover {

                transform:
                    translateY(-3px);

                box-shadow:
                    0 15px 35px
                    rgba(
                        37,
                        99,
                        235,
                        .4
                    );
            }

        </style>

    </head>

    <body>

        <div class="error">

            <div class="number">
                404
            </div>

            <h2>
                Page Not Found
            </h2>

            <p>
                The page you're looking for
                doesn't exist.
            </p>

            <a href="/">
                ← Back to MeetSpace
            </a>

        </div>

    </body>

    </html>
    """, 404


# =========================================================
# 500 ERROR HANDLER
# =========================================================

@app.errorhandler(500)
def internal_server_error(error):

    return """
    <!DOCTYPE html>

    <html>

    <head>

        <title>
            500 | MeetSpace
        </title>

    </head>

    <body
        style="
            margin:0;
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#020617;
            color:white;
            font-family:Arial;
        "
    >

        <div
            style="
                text-align:center;
                padding:40px;
            "
        >

            <h1
                style="
                    color:#ef4444;
                    font-size:60px;
                "
            >
                500
            </h1>

            <h2>
                Internal Server Error
            </h2>

            <p
                style="
                    color:#94a3b8;
                "
            >
                Something went wrong on the server.
            </p>

            <a
                href="/"
                style="
                    display:inline-block;
                    margin-top:20px;
                    padding:12px 25px;
                    border-radius:10px;
                    background:#2563eb;
                    color:white;
                    text-decoration:none;
                "
            >
                ← Back to MeetSpace
            </a>

        </div>

    </body>

    </html>
    """, 500


# =========================================================
# START APPLICATION
# =========================================================

if __name__ == "__main__":

    print()
    print("=" * 65)
    print("                    MEETSPACE SERVER")
    print("=" * 65)
    print()

    print("🚀 Server starting...")
    print()

    print("🏠 Home:")
    print("   http://127.0.0.1:5000/")
    print()

    print("🧪 Flask Test:")
    print("   http://127.0.0.1:5000/test")
    print()

    print("🗄️ Database Test:")
    print("   http://127.0.0.1:5000/database-test")
    print()

    print("🔐 Login:")
    print("   http://127.0.0.1:5000/meeting/login")
    print()

    print("📝 Register:")
    print("   http://127.0.0.1:5000/meeting/register")
    print()

    print("🔑 Forgot Password:")
    print("   http://127.0.0.1:5000/meeting/forgot-password")
    print()

    print("🎥 Meeting Home:")
    print("   http://127.0.0.1:5000/meeting/")
    print()

    print("🎬 Create Meeting:")
    print("   http://127.0.0.1:5000/meeting/create")
    print()

    print("🔗 Join Meeting:")
    print("   http://127.0.0.1:5000/meeting/join")
    print()

    print("=" * 65)
    print()

    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=False,
        use_reloader=False,
        allow_unsafe_werkzeug=True
    )