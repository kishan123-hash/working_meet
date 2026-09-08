from flask import request
from flask_socketio import join_room, leave_room, emit


# =========================================================
# ACTIVE MEETINGS
# =========================================================

# {
#     "ABC123": {
#         "socket_id_1": "Kishan",
#         "socket_id_2": "Vaishnavi"
#     }
# }

active_meetings = {}


# =========================================================
# SOCKET -> MEETING MAPPING
# =========================================================

# {
#     "socket_id_1": "ABC123"
# }

socket_meetings = {}


# =========================================================
# REGISTER SOCKET EVENTS
# =========================================================

def register_socket_events(socketio):


    # =====================================================
    # JOIN MEETING
    # =====================================================

    @socketio.on("join-meeting")
    def handle_join(data):

        # -------------------------------------------------
        # Validate data
        # -------------------------------------------------

        if not data:
            return

        meeting_id = str(
            data.get(
                "meeting_id",
                ""
            )
        ).strip().upper()

        user_name = str(
            data.get(
                "name",
                "Participant"
            )
        ).strip()

        if not user_name:
            user_name = "Participant"

        if not meeting_id:
            print(
                "[MEETING] Join rejected: "
                "meeting_id missing."
            )
            return


        sid = request.sid


        # -------------------------------------------------
        # Check if socket is already in a meeting
        # -------------------------------------------------

        old_meeting_id = socket_meetings.get(
            sid
        )


        # -------------------------------------------------
        # If socket is already in the SAME meeting
        # -------------------------------------------------

        if old_meeting_id == meeting_id:

            meeting = active_meetings.get(
                meeting_id,
                {}
            )

            if sid in meeting:

                print(
                    f"[MEETING] Duplicate join ignored: "
                    f"{user_name} -> {meeting_id}"
                )

                # Send current participant count
                emit(
                    "participant-count",
                    {
                        "count": len(meeting)
                    },
                    to=sid
                )

                return


        # -------------------------------------------------
        # If socket belongs to another meeting
        # -------------------------------------------------

        if (
            old_meeting_id
            and
            old_meeting_id != meeting_id
        ):

            print(
                f"[MEETING] {sid} switching from "
                f"{old_meeting_id} to {meeting_id}"
            )

            remove_participant(
                old_meeting_id,
                sid
            )


        # -------------------------------------------------
        # Create meeting if required
        # -------------------------------------------------

        if meeting_id not in active_meetings:

            active_meetings[
                meeting_id
            ] = {}


        meeting = active_meetings[
            meeting_id
        ]


        # -------------------------------------------------
        # Existing participants BEFORE adding new user
        # -------------------------------------------------

        existing_participants = [

            {
                "sid": participant_sid,
                "name": participant_name
            }

            for (
                participant_sid,
                participant_name
            )
            in meeting.items()

        ]


        # -------------------------------------------------
        # Add participant
        # -------------------------------------------------

        meeting[sid] = user_name

        socket_meetings[
            sid
        ] = meeting_id


        # -------------------------------------------------
        # Join Socket.IO room
        # -------------------------------------------------

        join_room(
            meeting_id
        )


        print(
            f"[MEETING] {user_name} joined "
            f"{meeting_id} | SID: {sid}"
        )


        # -------------------------------------------------
        # Send existing participants to NEW USER
        # -------------------------------------------------

        emit(
            "existing-participants",
            {
                "participants":
                    existing_participants
            },
            to=sid
        )


        # -------------------------------------------------
        # Tell EXISTING USERS about NEW USER
        # -------------------------------------------------

        emit(
            "user-joined",
            {
                "sid": sid,
                "name": user_name
            },
            to=meeting_id,
            include_self=False
        )


        # -------------------------------------------------
        # Update participant count
        # -------------------------------------------------

        emit(
            "participant-count",
            {
                "count": len(meeting)
            },
            to=meeting_id
        )


        print(
            f"[MEETING] {meeting_id} "
            f"participants: {len(meeting)}"
        )


    # =====================================================
    # OFFER
    # =====================================================

    @socketio.on("offer")
    def handle_offer(data):

        if not data:
            return

        target = data.get(
            "target"
        )

        offer = data.get(
            "offer"
        )

        name = data.get(
            "name",
            "Participant"
        )


        if not target or not offer:
            return


        # -------------------------------------------------
        # Verify sender is in a meeting
        # -------------------------------------------------

        sender_meeting = socket_meetings.get(
            request.sid
        )

        if not sender_meeting:
            print(
                "[WEBRTC] Offer rejected: "
                "sender not in meeting."
            )
            return


        # -------------------------------------------------
        # Verify target is in same meeting
        # -------------------------------------------------

        target_meeting = socket_meetings.get(
            target
        )

        if target_meeting != sender_meeting:
            print(
                "[WEBRTC] Offer rejected: "
                "different meeting."
            )
            return


        emit(
            "offer",
            {
                "offer": offer,
                "sender": request.sid,
                "name": name
            },
            to=target
        )


    # =====================================================
    # ANSWER
    # =====================================================

    @socketio.on("answer")
    def handle_answer(data):

        if not data:
            return

        target = data.get(
            "target"
        )

        answer = data.get(
            "answer"
        )


        if not target or not answer:
            return


        # -------------------------------------------------
        # Verify sender and target
        # -------------------------------------------------

        sender_meeting = socket_meetings.get(
            request.sid
        )

        target_meeting = socket_meetings.get(
            target
        )


        if (
            not sender_meeting
            or
            sender_meeting != target_meeting
        ):

            print(
                "[WEBRTC] Answer rejected: "
                "users are not in same meeting."
            )

            return


        emit(
            "answer",
            {
                "answer": answer,
                "sender": request.sid
            },
            to=target
        )


    # =====================================================
    # ICE CANDIDATE
    # =====================================================

    @socketio.on("ice-candidate")
    def handle_ice_candidate(data):

        if not data:
            return

        target = data.get(
            "target"
        )

        candidate = data.get(
            "candidate"
        )


        if not target or not candidate:
            return


        # -------------------------------------------------
        # Verify same meeting
        # -------------------------------------------------

        sender_meeting = socket_meetings.get(
            request.sid
        )

        target_meeting = socket_meetings.get(
            target
        )


        if (
            not sender_meeting
            or
            sender_meeting != target_meeting
        ):

            print(
                "[WEBRTC] ICE candidate rejected: "
                "different meeting."
            )

            return


        emit(
            "ice-candidate",
            {
                "candidate": candidate,
                "sender": request.sid
            },
            to=target
        )


    # =====================================================
    # CHAT MESSAGE
    # =====================================================

    @socketio.on("chat-message")
    def handle_chat_message(data):

        if not data:
            return


        meeting_id = str(
            data.get(
                "meeting_id",
                ""
            )
        ).strip().upper()


        message = str(
            data.get(
                "message",
                ""
            )
        ).strip()


        # Keep chat messages within the limit used by
        # meeting_room.html.
        message = message[:1000]


        if not meeting_id or not message:
            return


        # -------------------------------------------------
        # Verify socket is actually in this meeting
        # -------------------------------------------------

        current_meeting = socket_meetings.get(
            request.sid
        )


        if current_meeting != meeting_id:
            return


        meeting = active_meetings.get(
            meeting_id,
            {}
        )


        if request.sid not in meeting:
            return


        # Use the server-side participant name so a client
        # cannot impersonate another participant in chat.
        sender_name = meeting.get(
            request.sid,
            "Participant"
        )


        emit(
            "chat-message",
            {
                "name": sender_name,
                "message": message
            },
            to=meeting_id
        )


    # =====================================================
    # LEAVE MEETING
    # =====================================================

    @socketio.on("leave-meeting")
    def handle_leave(data):

        sid = request.sid


        meeting_id = None


        if data:

            meeting_id = data.get(
                "meeting_id"
            )


        if meeting_id:

            meeting_id = str(
                meeting_id
            ).strip().upper()


        # -------------------------------------------------
        # If meeting ID wasn't supplied,
        # use socket mapping
        # -------------------------------------------------

        if not meeting_id:

            meeting_id = socket_meetings.get(
                sid
            )


        if not meeting_id:
            return


        remove_participant(
            meeting_id,
            sid
        )


    # =====================================================
    # DISCONNECT
    # =====================================================

    @socketio.on("disconnect")
    def handle_disconnect():

        sid = request.sid


        meeting_id = socket_meetings.get(
            sid
        )


        print(
            f"[SOCKET] Disconnected: {sid}"
        )


        if meeting_id:

            remove_participant(
                meeting_id,
                sid
            )


    # =====================================================
    # COMMON REMOVE PARTICIPANT FUNCTION
    # =====================================================

    def remove_participant(
        meeting_id,
        sid
    ):

        if not meeting_id:
            return


        meeting = active_meetings.get(
            meeting_id
        )


        # -------------------------------------------------
        # Remove socket mapping even if
        # meeting doesn't exist
        # -------------------------------------------------

        if not meeting:

            socket_meetings.pop(
                sid,
                None
            )

            return


        user_name = meeting.get(
            sid,
            "Participant"
        )


        # -------------------------------------------------
        # Check whether participant exists
        # -------------------------------------------------

        if sid not in meeting:

            socket_meetings.pop(
                sid,
                None
            )

            return


        # -------------------------------------------------
        # Remove participant
        # -------------------------------------------------

        del meeting[sid]


        socket_meetings.pop(
            sid,
            None
        )


        # -------------------------------------------------
        # Leave Socket.IO room
        # -------------------------------------------------

        leave_room(
            meeting_id
        )


        print(
            f"[MEETING] {user_name} left "
            f"{meeting_id}"
        )


        # -------------------------------------------------
        # Notify remaining participants
        # -------------------------------------------------

        emit(
            "user-left",
            {
                "sid": sid,
                "name": user_name
            },
            to=meeting_id
        )


        # -------------------------------------------------
        # Update participant count
        # -------------------------------------------------

        emit(
            "participant-count",
            {
                "count": len(meeting)
            },
            to=meeting_id
        )


        # -------------------------------------------------
        # Delete empty meeting
        # -------------------------------------------------

        if len(meeting) == 0:

            active_meetings.pop(
                meeting_id,
                None
            )


            print(
                f"[MEETING] Empty room "
                f"{meeting_id} removed."
            )