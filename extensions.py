from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO


# =========================================================
# DATABASE
# =========================================================

db = SQLAlchemy()


# =========================================================
# SOCKET.IO
# =========================================================

socketio = SocketIO()