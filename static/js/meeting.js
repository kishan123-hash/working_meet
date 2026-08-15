"use strict";

/*
=========================================================
                 MEETSPACE MEETING CLIENT
=========================================================

Features:
- Camera
- Microphone
- Multiple participants
- WebRTC video/audio
- Screen sharing
- Socket.IO signaling
- Participant count
- Chat
- Leave meeting
- Reconnection support
- Remote video/audio
- Camera ON/OFF
- Microphone ON/OFF

IMPORTANT:
Socket.IO client is loaded from Flask-SocketIO:

/socket.io/socket.io.js

Do NOT use:
- /static/js/socket.io.min.js
- cdn.socket.io
=========================================================
*/


/* =========================================================
   1. MEETING INFORMATION
========================================================= */

const meetingApp =
    document.getElementById("meetingApp");

if (!meetingApp) {
    console.error("MeetSpace: #meetingApp not found.");
}

const meetingId =
    meetingApp?.dataset?.meetingId || "";

const userName =
    meetingApp?.dataset?.userName ||
    "Participant";

console.log("========================================");
console.log("        MEETSPACE MEETING CLIENT");
console.log("========================================");
console.log("Meeting ID:", meetingId);
console.log("User:", userName);
console.log("========================================");


/* =========================================================
   2. HTML ELEMENTS
========================================================= */

const localVideo =
    document.getElementById("localVideo");

const localPlaceholder =
    document.getElementById("localPlaceholder");

const remoteVideos =
    document.getElementById("remoteVideos");

const emptyState =
    document.getElementById("emptyState");


/* =========================================================
   BUTTONS
========================================================= */

const micBtn =
    document.getElementById("micBtn");

const cameraBtn =
    document.getElementById("cameraBtn");

const screenShareBtn =
    document.getElementById("screenShareBtn");

const leaveMeetingBtn =
    document.getElementById("leaveMeetingBtn");

const leaveMeetingBtn2 =
    document.getElementById("leaveMeetingBtn2");


/* =========================================================
   CONNECTION STATUS
========================================================= */

const connectionStatus =
    document.getElementById("connectionStatus");

const connectionText =
    document.getElementById("connectionText");


/* =========================================================
   PARTICIPANTS
========================================================= */

const participantCount =
    document.getElementById("participantCount");

const participantsList =
    document.getElementById("participantsList");


/* =========================================================
   CHAT
========================================================= */

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const chatMessages =
    document.getElementById("chatMessages");


/* =========================================================
   SIDEBAR
========================================================= */

const meetingSidebar =
    document.getElementById("meetingSidebar");

const chatBtn =
    document.getElementById("chatBtn");

const meetingChatBtn =
    document.getElementById("meetingChatBtn");

const participantsBtn =
    document.getElementById("participantsBtn");

const meetingParticipantsBtn =
    document.getElementById(
        "meetingParticipantsBtn"
    );

const sidebarClose =
    document.getElementById("sidebarClose");


/* =========================================================
   TOAST
========================================================= */

const meetingToast =
    document.getElementById("meetingToast");

const toastMessage =
    document.getElementById("toastMessage");

const toastIcon =
    document.getElementById("toastIcon");


/* =========================================================
   3. WEBRTC VARIABLES
========================================================= */

let localStream = null;

let screenStream = null;

let socket = null;


/*
One RTCPeerConnection per remote participant.
*/

const peerConnections = {};


/*
Participant names indexed by Socket.IO SID.
*/

const participants = {};


/*
Pending ICE candidates.
*/

const pendingIceCandidates = {};


/*
Remote MediaStreams.
*/

const remoteStreams = {};


/* =========================================================
   LOCAL MEDIA STATE
========================================================= */

let microphoneEnabled = true;

let cameraEnabled = true;


/* =========================================================
   INITIALIZATION FLAGS
========================================================= */

let meetingInitialized = false;

let socketRoomJoined = false;

let hasLeftMeeting = false;

let socketInitialized = false;

let mediaInitializationStarted = false;

let socketEventsRegistered = false;

let socketScriptLoading = false;


/* =========================================================
   WEBRTC CONFIGURATION
========================================================= */

const rtcConfiguration = {

    iceServers: [

        {
            urls: "stun:stun.l.google.com:19302"
        },

        {
            urls: "stun:stun1.l.google.com:19302"
        },

        {
            urls: "stun:stun2.l.google.com:19302"
        }

    ]

};


/* =========================================================
   4. SOCKET.IO CLIENT LOADER
========================================================= */

/*
IMPORTANT FIX

We DO NOT use:

/static/js/socket.io.min.js

We DO NOT use:

https://cdn.socket.io/...

Instead Flask-SocketIO provides its Socket.IO client at:

/socket.io/socket.io.js

This avoids the CDN timeout problem and also avoids
having to keep a socket.io.min.js file in static/js.
*/


function initializeSocket() {

    if (socketInitialized) {

        console.log(
            "Socket initialization already started."
        );

        return;
    }

    socketInitialized = true;


    /*
    If Socket.IO is already present,
    immediately create the connection.
    */

    if (typeof window.io === "function") {

        console.log(
            "Socket.IO client already available."
        );

        createSocket();

        return;
    }


    console.log(
        "Socket.IO client not found."
    );

    console.log(
        "Loading Socket.IO client from Flask server..."
    );

    loadFlaskSocketIO();
}


/* =========================================================
   LOAD SOCKET.IO FROM FLASK-SOCKETIO
========================================================= */

function loadFlaskSocketIO() {

    if (socketScriptLoading) {
        return;
    }

    socketScriptLoading = true;


    const existingScript =
        document.querySelector(
            'script[data-meetspace-socketio="true"]'
        );


    if (existingScript) {

        console.log(
            "Socket.IO script is already loading."
        );

        return;
    }


    const script =
        document.createElement("script");


    /*
    IMPORTANT:

    Flask-SocketIO serves this file automatically.
    */

    script.src =
        "/socket.io/socket.io.js";


    script.async = false;


    script.dataset.meetspaceSocketio =
        "true";


    script.onload =
        function () {

            socketScriptLoading = false;

            console.log(
                "================================="
            );

            console.log(
                "SOCKET.IO CLIENT LOADED FROM FLASK"
            );

            console.log(
                "================================="
            );


            if (
                typeof window.io === "function"
            ) {

                console.log(
                    "Socket.IO client detected."
                );

                createSocket();

            } else {

                console.error(
                    "Socket.IO script loaded but io() is unavailable."
                );

                updateConnectionStatus(
                    "error",
                    "Socket.IO unavailable"
                );

                showToast(
                    "error",
                    "Socket.IO client could not be initialized."
                );
            }
        };


    script.onerror =
        function () {

            socketScriptLoading = false;

            console.error(
                "================================="
            );

            console.error(
                "FLASK SOCKET.IO CLIENT FAILED"
            );

            console.error(
                "Expected:"
            );

            console.error(
                "/socket.io/socket.io.js"
            );

            console.error(
                "================================="
            );


            updateConnectionStatus(
                "error",
                "Socket.IO unavailable"
            );


            showToast(
                "error",
                "Unable to load Socket.IO client from Flask."
            );
        };


    document.head.appendChild(script);
}


/* =========================================================
   5. CREATE SOCKET CONNECTION
========================================================= */

function createSocket() {

    if (socket) {

        console.log(
            "Socket already exists."
        );

        return;
    }


    if (typeof window.io !== "function") {

        console.error(
            "Cannot create socket: io() unavailable."
        );

        updateConnectionStatus(
            "error",
            "Socket.IO unavailable"
        );

        return;
    }


    try {

        console.log(
            "Creating Socket.IO connection..."
        );


        /*
        Use same origin as Flask.

        This is important because your Flask server
        is hosting both the web page and Socket.IO.
        */

        socket =
            window.io(
                window.location.origin,
                {

                    path:
                        "/socket.io/",

                    transports: [
                        "polling",
                        "websocket"
                    ],

                    reconnection:
                        true,

                    reconnectionAttempts:
                        Infinity,

                    reconnectionDelay:
                        1000,

                    reconnectionDelayMax:
                        5000,

                    timeout:
                        20000,

                    autoConnect:
                        true

                }
            );


        registerSocketEvents();


    } catch (error) {

        console.error(
            "Socket creation failed:",
            error
        );

        socket = null;

        updateConnectionStatus(
            "error",
            "Socket.IO unavailable"
        );
    }
}


/* =========================================================
   6. SOCKET EVENTS
========================================================= */

function registerSocketEvents() {

    if (!socket) {
        return;
    }


    if (socketEventsRegistered) {
        return;
    }


    socketEventsRegistered = true;


    /* =====================================================
       CONNECT
    ===================================================== */

    socket.on(
        "connect",
        async function () {

            console.log(
                "================================="
            );

            console.log(
                "SOCKET.IO CONNECTED"
            );

            console.log(
                "Socket ID:",
                socket.id
            );

            console.log(
                "Meeting ID:",
                meetingId
            );

            console.log(
                "User:",
                userName
            );

            console.log(
                "================================="
            );


            hasLeftMeeting = false;

            socketRoomJoined = false;


            updateConnectionStatus(
                "connecting",
                "Connected to server"
            );


            /*
            Camera and microphone first.
            */

            await initializeMeeting();


            /*
            Then join the Socket.IO room.
            */

            joinMeetingRoom();

        }
    );


    /* =====================================================
       CONNECT ERROR
    ===================================================== */

    socket.on(
        "connect_error",
        function (error) {

            console.error(
                "Socket.IO connection error:",
                error
            );


            updateConnectionStatus(
                "error",
                "Server connection failed"
            );
        }
    );


    /* =====================================================
       RECONNECT ATTEMPT
    ===================================================== */

    if (socket.io) {

        socket.io.on(
            "reconnect_attempt",
            function (attempt) {

                console.log(
                    "Socket reconnect attempt:",
                    attempt
                );

                socketRoomJoined = false;

                updateConnectionStatus(
                    "connecting",
                    "Reconnecting..."
                );
            }
        );


        socket.io.on(
            "reconnect",
            function (attempt) {

                console.log(
                    "Socket reconnected:",
                    attempt
                );

                socketRoomJoined = false;

                if (
                    !hasLeftMeeting &&
                    socket &&
                    socket.connected
                ) {

                    joinMeetingRoom();
                }
            }
        );
    }


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
        "disconnect",
        function (reason) {

            console.warn(
                "Socket.IO disconnected:",
                reason
            );


            socketRoomJoined = false;


            if (!hasLeftMeeting) {

                updateConnectionStatus(
                    "error",
                    "Disconnected"
                );
            }
        }
    );


    /* =====================================================
       EXISTING PARTICIPANTS
    ===================================================== */

    socket.on(
        "existing-participants",
        async function (data) {

            console.log(
                "Existing participants:",
                data
            );


            const list =
                Array.isArray(
                    data?.participants
                )
                    ? data.participants
                    : [];


            for (
                const participant of list
            ) {

                let remoteSocketId =
                    participant?.sid ||
                    participant?.socket_id ||
                    participant?.id;


                let remoteName =
                    participant?.name ||
                    participant?.username ||
                    "Participant";


                /*
                Server may send plain SID.
                */

                if (
                    typeof participant ===
                    "string"
                ) {

                    remoteSocketId =
                        participant;

                    remoteName =
                        "Participant";
                }


                if (!remoteSocketId) {
                    continue;
                }


                if (
                    remoteSocketId ===
                    socket.id
                ) {
                    continue;
                }


                participants[
                    remoteSocketId
                ] = remoteName;


                const peerConnection =
                    createPeerConnection(
                        remoteSocketId,
                        remoteName
                    );


                try {

                    /*
                    Existing participant gets an offer.
                    */

                    const offer =
                        await peerConnection
                            .createOffer({

                                offerToReceiveAudio:
                                    true,

                                offerToReceiveVideo:
                                    true
                            });


                    await peerConnection
                        .setLocalDescription(
                            offer
                        );


                    socket.emit(
                        "offer",
                        {

                            target:
                                remoteSocketId,

                            offer:
                                peerConnection
                                    .localDescription,

                            name:
                                userName
                        }
                    );


                    console.log(
                        "OFFER SENT ->",
                        remoteName,
                        remoteSocketId
                    );


                } catch (error) {

                    console.error(
                        "Offer creation failed:",
                        error
                    );
                }
            }


            updateParticipantCount();
        }
    );


    /* =====================================================
       USER JOINED
    ===================================================== */

    socket.on(
        "user-joined",
        function (data) {

            console.log(
                "USER JOINED:",
                data
            );


            const remoteSocketId =
                data?.sid ||
                data?.socket_id ||
                data?.id;


            const remoteName =
                data?.name ||
                data?.username ||
                "Participant";


            if (!remoteSocketId) {
                return;
            }


            if (
                remoteSocketId ===
                socket.id
            ) {
                return;
            }


            participants[
                remoteSocketId
            ] = remoteName;


            /*
            Create the peer now.

            The new participant should receive
            an offer from the existing participant.
            */

            createPeerConnection(
                remoteSocketId,
                remoteName
            );


            updateParticipantCount();


            showToast(
                "info",
                `${remoteName} joined the meeting.`
            );
        }
    );


    /* =====================================================
       RECEIVE OFFER
    ===================================================== */

    socket.on(
        "offer",
        async function (data) {

            console.log(
                "OFFER RECEIVED:",
                data
            );


            const remoteSocketId =
                data?.sender ||
                data?.from ||
                data?.socket_id;


            const remoteName =
                data?.name ||
                data?.username ||
                "Participant";


            if (
                !remoteSocketId ||
                !data?.offer
            ) {
                return;
            }


            if (
                remoteSocketId ===
                socket.id
            ) {
                return;
            }


            participants[
                remoteSocketId
            ] = remoteName;


            const peerConnection =
                createPeerConnection(
                    remoteSocketId,
                    remoteName
                );


            try {

                await peerConnection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            data.offer
                        )
                    );


                await flushPendingIceCandidates(
                    remoteSocketId
                );


                const answer =
                    await peerConnection
                        .createAnswer({

                            offerToReceiveAudio:
                                true,

                            offerToReceiveVideo:
                                true
                        });


                await peerConnection
                    .setLocalDescription(
                        answer
                    );


                socket.emit(
                    "answer",
                    {

                        target:
                            remoteSocketId,

                        answer:
                            peerConnection
                                .localDescription
                    }
                );


                console.log(
                    "ANSWER SENT ->",
                    remoteName
                );


            } catch (error) {

                console.error(
                    "Offer handling failed:",
                    error
                );
            }
        }
    );


    /* =====================================================
       RECEIVE ANSWER
    ===================================================== */

    socket.on(
        "answer",
        async function (data) {

            console.log(
                "ANSWER RECEIVED:",
                data
            );


            const remoteSocketId =
                data?.sender ||
                data?.from ||
                data?.socket_id;


            if (
                !remoteSocketId ||
                !data?.answer
            ) {
                return;
            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {

                console.warn(
                    "Peer connection not found:",
                    remoteSocketId
                );

                return;
            }


            try {

                await peerConnection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            data.answer
                        )
                    );


                await flushPendingIceCandidates(
                    remoteSocketId
                );


                console.log(
                    "Remote answer applied:",
                    remoteSocketId
                );


            } catch (error) {

                console.error(
                    "Answer handling failed:",
                    error
                );
            }
        }
    );


    /* =====================================================
       ICE CANDIDATE
    ===================================================== */

    socket.on(
        "ice-candidate",
        async function (data) {

            const remoteSocketId =
                data?.sender ||
                data?.from ||
                data?.socket_id;


            const candidate =
                data?.candidate;


            if (
                !remoteSocketId ||
                !candidate
            ) {
                return;
            }


            if (
                remoteSocketId ===
                socket.id
            ) {
                return;
            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {

                queueIceCandidate(
                    remoteSocketId,
                    candidate
                );

                return;
            }


            if (
                !peerConnection
                    .remoteDescription
            ) {

                queueIceCandidate(
                    remoteSocketId,
                    candidate
                );

                return;
            }


            try {

                await peerConnection
                    .addIceCandidate(
                        new RTCIceCandidate(
                            candidate
                        )
                    );

            } catch (error) {

                console.error(
                    "ICE candidate error:",
                    error
                );
            }
        }
    );


    /* =====================================================
       CHAT
    ===================================================== */

    socket.on(
        "chat-message",
        function (data) {

            addChatMessage(
                data?.name ||
                data?.username ||
                "Participant",

                data?.message ||
                ""
            );
        }
    );


    /* =====================================================
       USER LEFT
    ===================================================== */

    socket.on(
        "user-left",
        function (data) {

            console.log(
                "USER LEFT:",
                data
            );


            const remoteSocketId =
                data?.sid ||
                data?.socket_id ||
                data?.id;


            const remoteName =
                data?.name ||
                data?.username ||
                "Participant";


            if (!remoteSocketId) {
                return;
            }


            removeRemoteParticipant(
                remoteSocketId
            );


            showToast(
                "info",
                `${remoteName} left the meeting.`
            );
        }
    );


    /* =====================================================
       PARTICIPANT COUNT
    ===================================================== */

    socket.on(
        "participant-count",
        function (data) {

            console.log(
                "Server participant count:",
                data?.count
            );


            if (
                typeof data?.count ===
                "number"
            ) {

                if (participantCount) {

                    participantCount.textContent =
                        data.count;
                }
            }
        }
    );
}


/* =========================================================
   7. INITIALIZE CAMERA + MICROPHONE
========================================================= */

async function initializeMeeting() {

    if (meetingInitialized) {
        return;
    }


    if (mediaInitializationStarted) {
        return;
    }


    mediaInitializationStarted = true;


    if (!meetingId) {

        console.error(
            "Meeting ID is missing."
        );

        updateConnectionStatus(
            "error",
            "Meeting ID missing"
        );

        return;
    }


    try {

        updateConnectionStatus(
            "connecting",
            "Requesting camera & microphone..."
        );


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "getUserMedia is not supported by this browser."
            );
        }


        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        width: {
                            ideal: 1280
                        },

                        height: {
                            ideal: 720
                        },

                        frameRate: {
                            ideal: 30,
                            max: 30
                        },

                        facingMode:
                            "user"
                    },

                    audio: {

                        echoCancellation:
                            true,

                        noiseSuppression:
                            true,

                        autoGainControl:
                            true
                    }
                });


        console.log(
            "================================="
        );

        console.log(
            "CAMERA + MICROPHONE OBTAINED"
        );

        console.log(
            "Video tracks:",
            localStream.getVideoTracks().length
        );

        console.log(
            "Audio tracks:",
            localStream.getAudioTracks().length
        );

        console.log(
            "================================="
        );


        const videoTracks =
            localStream.getVideoTracks();


        const audioTracks =
            localStream.getAudioTracks();


        microphoneEnabled =
            audioTracks.length > 0 &&
            audioTracks.some(
                track => track.enabled
            );


        cameraEnabled =
            videoTracks.length > 0 &&
            videoTracks.some(
                track => track.enabled
            );


        /* =====================================================
           LOCAL VIDEO
        ===================================================== */

        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.muted =
                true;

            localVideo.defaultMuted =
                true;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;

            localVideo.setAttribute(
                "autoplay",
                ""
            );

            localVideo.setAttribute(
                "muted",
                ""
            );

            localVideo.setAttribute(
                "playsinline",
                ""
            );

            localVideo.style.display =
                "block";


            await playLocalVideo();
        }


        if (localPlaceholder) {

            localPlaceholder.style.display =
                cameraEnabled
                    ? "none"
                    : "flex";
        }


        updateMicrophoneButton();

        updateCameraButton();


        meetingInitialized =
            true;


        updateConnectionStatus(
            "connected",
            "Camera & microphone ready"
        );


        console.log(
            "Camera and microphone are ready."
        );


    } catch (error) {

        console.error(
            "Media initialization error:",
            error
        );


        if (localVideo) {

            localVideo.srcObject =
                null;

            localVideo.style.display =
                "none";
        }


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "flex";
        }


        microphoneEnabled =
            false;

        cameraEnabled =
            false;


        updateMicrophoneButton();

        updateCameraButton();


        updateConnectionStatus(
            "error",
            "Camera unavailable"
        );


        showToast(
            "error",
            getMediaErrorMessage(error)
        );
    }
}


/* =========================================================
   PLAY LOCAL VIDEO
========================================================= */

async function playLocalVideo() {

    if (!localVideo) {
        return;
    }


    if (!localVideo.srcObject) {
        return;
    }


    try {

        localVideo.muted =
            true;

        localVideo.defaultMuted =
            true;

        localVideo.autoplay =
            true;

        localVideo.playsInline =
            true;


        await localVideo.play();


        localVideo.style.display =
            "block";


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";
        }


        console.log(
            "Local camera video is PLAYING."
        );


    } catch (error) {

        console.warn(
            "Local video play attempt failed:",
            error
        );
    }
}


/* =========================================================
   MEDIA ERROR MESSAGE
========================================================= */

function getMediaErrorMessage(error) {

    if (!error) {
        return "Camera or microphone unavailable.";
    }


    switch (error.name) {

        case "NotAllowedError":

            return (
                "Camera/microphone permission was denied. " +
                "Allow camera and microphone access in Chrome."
            );


        case "NotFoundError":

            return (
                "Camera or microphone was not found."
            );


        case "NotReadableError":

            return (
                "Camera or microphone is already being used " +
                "by another application."
            );


        case "OverconstrainedError":

            return (
                "Camera does not support the requested settings."
            );


        case "SecurityError":

            return (
                "Browser security prevented camera access."
            );


        case "AbortError":

            return (
                "Camera initialization was interrupted."
            );


        default:

            return (
                "Unable to access camera or microphone."
            );
    }
}


/* =========================================================
   8. JOIN SOCKET.IO ROOM
========================================================= */

function joinMeetingRoom() {

    if (!socket) {

        console.error(
            "Cannot join meeting: socket unavailable."
        );

        return;
    }


    if (!socket.connected) {

        console.warn(
            "Cannot join meeting: socket not connected."
        );

        return;
    }


    if (!meetingId) {

        console.error(
            "Cannot join meeting: meeting ID missing."
        );

        return;
    }


    if (socketRoomJoined) {

        console.log(
            "Already joined Socket.IO room."
        );

        return;
    }


    console.log(
        "================================="
    );

    console.log(
        "JOINING SOCKET.IO ROOM"
    );

    console.log(
        "Meeting:",
        meetingId
    );

    console.log(
        "User:",
        userName
    );

    console.log(
        "Socket:",
        socket.id
    );

    console.log(
        "================================="
    );


    socket.emit(
        "join-meeting",
        {

            meeting_id:
                meetingId,

            name:
                userName
        }
    );


    socketRoomJoined =
        true;
}


/* =========================================================
   9. CREATE PEER CONNECTION
========================================================= */

function createPeerConnection(
    remoteSocketId,
    remoteName = "Participant"
) {

    if (
        peerConnections[
            remoteSocketId
        ]
    ) {

        return peerConnections[
            remoteSocketId
        ];
    }


    console.log(
        "Creating WebRTC peer:",
        remoteName,
        remoteSocketId
    );


    const peerConnection =
        new RTCPeerConnection(
            rtcConfiguration
        );


    peerConnections[
        remoteSocketId
    ] =
        peerConnection;


    participants[
        remoteSocketId
    ] =
        remoteName;


    remoteStreams[
        remoteSocketId
    ] =
        new MediaStream();


    pendingIceCandidates[
        remoteSocketId
    ] =
        pendingIceCandidates[
            remoteSocketId
        ] || [];


    /* =====================================================
       ADD LOCAL CAMERA + MICROPHONE / SCREEN

       IMPORTANT:
       If screen sharing is already active when a new
       participant joins, the new peer receives the
       screen track instead of the camera track.
    ===================================================== */

    if (localStream) {

        /*
        Add microphone separately.
        */

        const audioTracks =
            localStream.getAudioTracks();


        audioTracks.forEach(
            function (track) {

                try {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );


                    console.log(
                        "Local audio track added:",
                        track.kind
                    );


                } catch (error) {

                    console.error(
                        "Unable to add local audio track:",
                        error
                    );
                }
            }
        );


        /*
        Determine whether the outgoing video should
        be the camera or the currently shared screen.
        */

        const outgoingVideoTrack =
            getOutgoingVideoTrack();


        if (outgoingVideoTrack) {

            try {

                const videoStream =
                    screenStream ||
                    localStream;


                peerConnection.addTrack(
                    outgoingVideoTrack,
                    videoStream
                );


                console.log(
                    "Outgoing video track added:",
                    outgoingVideoTrack.kind,

                    screenStream
                        ? "(SCREEN)"
                        : "(CAMERA)"
                );


            } catch (error) {

                console.error(
                    "Unable to add outgoing video track:",
                    error
                );
            }
        }
    }


    /* =====================================================
       REMOTE TRACK
    ===================================================== */

    peerConnection.ontrack =
        function (event) {

            console.log(
                "REMOTE TRACK:",
                remoteSocketId,
                event.track.kind
            );


            let stream =
                remoteStreams[
                    remoteSocketId
                ];


            if (!stream) {

                stream =
                    new MediaStream();

                remoteStreams[
                    remoteSocketId
                ] =
                    stream;
            }


            const alreadyAdded =
                stream
                    .getTracks()
                    .some(
                        track =>
                            track.id ===
                            event.track.id
                    );


            if (!alreadyAdded) {

                stream.addTrack(
                    event.track
                );
            }


            createRemoteVideo(
                remoteSocketId,
                remoteName,
                stream
            );


            event.track.onended =
                function () {

                    console.log(
                        "Remote track ended:",
                        remoteSocketId,
                        event.track.kind
                    );
                };
        };


    /* =====================================================
       ICE CANDIDATE
    ===================================================== */

    peerConnection.onicecandidate =
        function (event) {

            if (
                !event.candidate ||
                !socket ||
                !socket.connected
            ) {
                return;
            }


            socket.emit(
                "ice-candidate",
                {

                    target:
                        remoteSocketId,

                    candidate:
                        event.candidate
                }
            );
        };


    /* =====================================================
       CONNECTION STATE
    ===================================================== */

    peerConnection.onconnectionstatechange =
        function () {

            const state =
                peerConnection.connectionState;


            console.log(
                `WebRTC ${remoteName}:`,
                state
            );


            if (
                state === "connected"
            ) {

                updateConnectionStatus(
                    "connected",
                    "Connected"
                );


                showToast(
                    "success",
                    `${remoteName} connected.`
                );
            }


            if (
                state === "connecting"
            ) {

                updateConnectionStatus(
                    "connecting",
                    "Connecting..."
                );
            }


            if (
                state === "failed"
            ) {

                console.error(
                    "WebRTC connection failed:",
                    remoteSocketId
                );


                try {

                    peerConnection.restartIce();

                } catch (error) {

                    console.warn(
                        "ICE restart unavailable:",
                        error
                    );
                }
            }


            if (
                state === "disconnected"
            ) {

                setTimeout(
                    function () {

                        const current =
                            peerConnections[
                                remoteSocketId
                            ];


                        if (
                            current &&
                            (
                                current.connectionState ===
                                "disconnected" ||

                                current.connectionState ===
                                "failed"
                            )
                        ) {

                            removeRemoteParticipant(
                                remoteSocketId
                            );
                        }

                    },
                    5000
                );
            }


            if (
                state === "closed"
            ) {

                removeRemoteParticipant(
                    remoteSocketId
                );
            }
        };


    /* =====================================================
       ICE CONNECTION STATE
    ===================================================== */

    peerConnection
        .oniceconnectionstatechange =
        function () {

            console.log(
                "ICE:",
                remoteSocketId,
                peerConnection
                    .iceConnectionState
            );
        };


    /* =====================================================
       ICE GATHERING STATE
    ===================================================== */

    peerConnection
        .onicegatheringstatechange =
        function () {

            console.log(
                "ICE gathering:",
                remoteSocketId,
                peerConnection
                    .iceGatheringState
            );
        };


    return peerConnection;
}


/* =========================================================
   10. ICE QUEUE
========================================================= */

function queueIceCandidate(
    socketId,
    candidate
) {

    if (
        !pendingIceCandidates[
            socketId
        ]
    ) {

        pendingIceCandidates[
            socketId
        ] = [];
    }


    pendingIceCandidates[
        socketId
    ].push(
        candidate
    );
}


/* =========================================================
   FLUSH ICE CANDIDATES
========================================================= */

async function flushPendingIceCandidates(
    socketId
) {

    const peerConnection =
        peerConnections[
            socketId
        ];


    if (!peerConnection) {
        return;
    }


    if (
        !peerConnection.remoteDescription
    ) {
        return;
    }


    const candidates =
        pendingIceCandidates[
            socketId
        ] || [];


    for (
        const candidate of candidates
    ) {

        try {

            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

        } catch (error) {

            console.error(
                "Queued ICE candidate error:",
                error
            );
        }
    }


    pendingIceCandidates[
        socketId
    ] = [];
}


/* =========================================================
   11. CREATE REMOTE VIDEO
========================================================= */

function createRemoteVideo(
    socketId,
    name,
    stream
) {

    if (!remoteVideos) {

        console.error(
            "#remoteVideos not found."
        );

        return;
    }


    let card =
        document.getElementById(
            `remote-${socketId}`
        );


    /* =====================================================
       CARD ALREADY EXISTS
    ===================================================== */

    if (card) {

        const video =
            card.querySelector(
                "video"
            );


        if (video) {

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.controls =
                false;

            video.muted =
                false;

            video.volume =
                1;

            video.srcObject =
                stream;


            video.play().catch(
                function (error) {

                    console.warn(
                        "Remote video playback:",
                        error
                    );
                }
            );
        }


        if (emptyState) {

            emptyState.style.display =
                "none";
        }


        return;
    }


    /* =====================================================
       CREATE CARD
    ===================================================== */

    card =
        document.createElement(
            "div"
        );


    card.className =
        "video-card remote-video-card";


    card.id =
        `remote-${socketId}`;


    /* =====================================================
       VIDEO
    ===================================================== */

    const video =
        document.createElement(
            "video"
        );


    video.autoplay =
        true;

    video.playsInline =
        true;

    video.controls =
        false;

    video.muted =
        false;

    video.volume =
        1;

    video.setAttribute(
        "autoplay",
        ""
    );

    video.setAttribute(
        "playsinline",
        ""
    );

    video.srcObject =
        stream;


    /* =====================================================
       NAME
    ===================================================== */

    const label =
        document.createElement(
            "div"
        );


    label.className =
        "video-name";


    label.textContent =
        name;


    /* =====================================================
       ADD TO DOM
    ===================================================== */

    card.appendChild(
        video
    );


    card.appendChild(
        label
    );


    remoteVideos.appendChild(
        card
    );


    if (emptyState) {

        emptyState.style.display =
            "none";
    }


    /* =====================================================
       PLAY REMOTE VIDEO
    ===================================================== */

    video.play().then(
        function () {

            console.log(
                "Remote video playing:",
                name
            );
        }
    ).catch(
        function (error) {

            console.warn(
                "Remote autoplay blocked:",
                error
            );


            const resumePlayback =
                function () {

                    video.play().catch(
                        function () {}
                    );
                };


            document.addEventListener(
                "click",
                resumePlayback,
                {
                    once: true
                }
            );
        }
    );


    video.addEventListener(
        "loadedmetadata",
        function () {

            console.log(
                "Remote video metadata loaded:",
                name,
                video.videoWidth,
                video.videoHeight
            );


            video.play().catch(
                function () {}
            );
        }
    );


    updateParticipantCount();


    console.log(
        "Remote participant video created:",
        name
    );
}


/* =========================================================
   12. REMOVE REMOTE PARTICIPANT
========================================================= */

function removeRemoteParticipant(
    socketId
) {

    console.log(
        "Removing participant:",
        socketId
    );


    const card =
        document.getElementById(
            `remote-${socketId}`
        );


    if (card) {

        const video =
            card.querySelector(
                "video"
            );


        if (video) {

            try {
                video.pause();
            } catch (error) {}


            video.srcObject =
                null;
        }


        card.remove();
    }


    const peerConnection =
        peerConnections[
            socketId
        ];


    if (peerConnection) {

        try {

            peerConnection.ontrack =
                null;

            peerConnection.onicecandidate =
                null;

            peerConnection.close();

        } catch (error) {

            console.error(
                "Peer close error:",
                error
            );
        }
    }


    delete peerConnections[
        socketId
    ];

    delete participants[
        socketId
    ];

    delete pendingIceCandidates[
        socketId
    ];

    delete remoteStreams[
        socketId
    ];


    if (
        Object.keys(
            peerConnections
        ).length === 0
    ) {

        if (emptyState) {

            emptyState.style.display =
                "flex";
        }
    }


    updateParticipantCount();
}


/* =========================================================
   13. MICROPHONE
========================================================= */

if (micBtn) {

    micBtn.addEventListener(
        "click",
        toggleMicrophone
    );
}


function toggleMicrophone() {

    if (!localStream) {

        showToast(
            "error",
            "Microphone is unavailable."
        );

        return;
    }


    const tracks =
        localStream.getAudioTracks();


    if (tracks.length === 0) {

        showToast(
            "error",
            "No microphone found."
        );

        return;
    }


    microphoneEnabled =
        !microphoneEnabled;


    tracks.forEach(
        function (track) {

            track.enabled =
                microphoneEnabled;
        }
    );


    updateMicrophoneButton();


    showToast(
        "info",
        microphoneEnabled
            ? "Microphone turned on."
            : "Microphone muted."
    );
}


/* =========================================================
   MICROPHONE UI
========================================================= */

function updateMicrophoneButton() {

    if (!micBtn) {
        return;
    }


    const icon =
        micBtn.querySelector(
            ".control-icon"
        );


    if (microphoneEnabled) {

        micBtn.classList.add(
            "active"
        );

        micBtn.classList.remove(
            "off"
        );


        if (icon) {

            icon.textContent =
                "🎤";
        }


        micBtn.title =
            "Mute microphone";


    } else {

        micBtn.classList.remove(
            "active"
        );

        micBtn.classList.add(
            "off"
        );


        if (icon) {

            icon.textContent =
                "🔇";
        }


        micBtn.title =
            "Unmute microphone";
    }
}


/* =========================================================
   14. CAMERA
========================================================= */

if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        toggleCamera
    );
}


function toggleCamera() {

    if (!localStream) {

        showToast(
            "error",
            "Camera is unavailable."
        );

        return;
    }


    const tracks =
        localStream.getVideoTracks();


    if (tracks.length === 0) {

        showToast(
            "error",
            "No camera found."
        );

        return;
    }


    cameraEnabled =
        !cameraEnabled;


    tracks.forEach(
        function (track) {

            track.enabled =
                cameraEnabled;
        }
    );


    /*
    If screen sharing is active, do not replace
    the outgoing screen track. The camera track is
    only being enabled/disabled for restoration later.
    */

    if (screenStream) {

        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";
        }

    } else {

        if (cameraEnabled) {

            if (localVideo) {

                localVideo.srcObject =
                    localStream;

                localVideo.muted =
                    true;

                localVideo.defaultMuted =
                    true;

                localVideo.autoplay =
                    true;

                localVideo.playsInline =
                    true;

                localVideo.style.display =
                    "block";


                localVideo.play().catch(
                    function () {}
                );
            }


            if (localPlaceholder) {

                localPlaceholder.style.display =
                    "none";
            }


        } else {

            if (localVideo) {

                localVideo.style.display =
                    "none";
            }


            if (localPlaceholder) {

                localPlaceholder.style.display =
                    "flex";
            }
        }
    }


    updateCameraButton();


    showToast(
        "info",
        cameraEnabled
            ? "Camera turned on."
            : "Camera turned off."
    );
}


/* =========================================================
   CAMERA UI
========================================================= */

function updateCameraButton() {

    if (!cameraBtn) {
        return;
    }


    const icon =
        cameraBtn.querySelector(
            ".control-icon"
        );


    if (cameraEnabled) {

        cameraBtn.classList.add(
            "active"
        );

        cameraBtn.classList.remove(
            "off"
        );


        if (icon) {

            icon.textContent =
                "📹";
        }


        cameraBtn.title =
            "Turn camera off";


    } else {

        cameraBtn.classList.remove(
            "active"
        );

        cameraBtn.classList.add(
            "off"
        );


        if (icon) {

            icon.textContent =
                "🚫";
        }


        cameraBtn.title =
            "Turn camera on";
    }
}


/* =========================================================
   15. SCREEN SHARE

   FIXED WEBRTC SCREEN-SHARING FLOW

   - Existing peer connections use replaceTrack().
   - New peer connections automatically use screenStream.
   - Browser native "Stop sharing" restores camera.
   - Camera/microphone WebRTC structure remains unchanged.
========================================================= */

if (screenShareBtn) {

    screenShareBtn.addEventListener(
        "click",
        toggleScreenShare
    );
}


/* =========================================================
   GET CURRENT OUTGOING VIDEO TRACK
========================================================= */

function getOutgoingVideoTrack() {

    /*
    If screen sharing is active,
    return the screen video track.
    */

    if (screenStream) {

        const screenTrack =
            screenStream.getVideoTracks()[0];


        if (
            screenTrack &&
            screenTrack.readyState !==
            "ended"
        ) {

            return screenTrack;
        }
    }


    /*
    Otherwise return the camera track.
    */

    return (
        localStream
            ?.getVideoTracks()
            ?.find(
                function (track) {

                    return (
                        track.readyState !==
                        "ended"
                    );
                }
            ) || null
    );
}


/* =========================================================
   GET VIDEO SENDER
========================================================= */

function getVideoSender(
    peerConnection
) {

    if (!peerConnection) {
        return null;
    }


    return (
        peerConnection
            .getSenders()
            .find(
                function (sender) {

                    return (
                        sender.track &&
                        sender.track.kind ===
                        "video"
                    );
                }
            ) || null
    );
}


/* =========================================================
   REPLACE VIDEO TRACK FOR ALL EXISTING PEERS
========================================================= */

async function replaceVideoTrackForAllPeers(
    videoTrack
) {

    if (!videoTrack) {
        return;
    }


    const peerIds =
        Object.keys(
            peerConnections
        );


    console.log(
        "Replacing outgoing video track for",
        peerIds.length,
        "peer(s)."
    );


    for (
        const socketId of peerIds
    ) {

        const peerConnection =
            peerConnections[
                socketId
            ];


        if (!peerConnection) {
            continue;
        }


        const sender =
            getVideoSender(
                peerConnection
            );


        if (!sender) {

            console.warn(
                "No video sender found for peer:",
                socketId
            );

            continue;
        }


        try {

            await sender.replaceTrack(
                videoTrack
            );


            console.log(
                "Video track replaced for peer:",
                socketId
            );


        } catch (error) {

            console.error(
                "replaceTrack failed for peer:",
                socketId,
                error
            );
        }
    }
}


/* =========================================================
   LOCAL VIDEO PREVIEW
========================================================= */

function setLocalVideoStream(
    stream,
    showVideo = true
) {

    if (!localVideo) {
        return;
    }


    localVideo.srcObject =
        stream || null;


    localVideo.muted =
        true;


    localVideo.defaultMuted =
        true;


    localVideo.autoplay =
        true;


    localVideo.playsInline =
        true;


    if (
        stream &&
        showVideo
    ) {

        localVideo.style.display =
            "block";


        localVideo.play().catch(
            function (error) {

                console.warn(
                    "Local video playback warning:",
                    error
                );
            }
        );


    } else {

        localVideo.style.display =
            "none";
    }
}


/* =========================================================
   SCREEN SHARE BUTTON
========================================================= */

function updateScreenShareButton(
    isSharing
) {

    if (!screenShareBtn) {
        return;
    }


    if (isSharing) {

        screenShareBtn.classList.add(
            "active"
        );


    } else {

        screenShareBtn.classList.remove(
            "active"
        );
    }


    const label =
        screenShareBtn.querySelector(
            ".control-label"
        );


    if (label) {

        label.textContent =
            isSharing
                ? "Stop Share"
                : "Share Screen";
    }


    screenShareBtn.title =
        isSharing
            ? "Stop screen sharing"
            : "Share your screen";
}


/* =========================================================
   START / STOP SCREEN SHARE
========================================================= */

async function toggleScreenShare() {

    /*
    If already sharing,
    stop screen sharing.
    */

    if (screenStream) {

        await stopScreenSharing();

        return;
    }


    /*
    Camera and microphone should already exist.
    */

    if (!localStream) {

        showToast(
            "error",
            "Camera and microphone are not ready yet."
        );

        return;
    }


    /*
    Browser support check.
    */

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia
    ) {

        showToast(
            "error",
            "Screen sharing is not supported in this browser."
        );

        return;
    }


    try {

        console.log(
            "================================="
        );

        console.log(
            "STARTING SCREEN SHARE"
        );

        console.log(
            "================================="
        );


        /*
        IMPORTANT:

        Audio is intentionally false.

        The existing microphone WebRTC audio track
        continues working normally.

        This prevents creating an additional audio
        sender and avoids unnecessary renegotiation.
        */

        const selectedScreenStream =
            await navigator.mediaDevices
                .getDisplayMedia({

                    video: {

                        cursor:
                            "always"
                    },

                    audio:
                        false
                });


        const screenTrack =
            selectedScreenStream
                .getVideoTracks()[0];


        if (!screenTrack) {

            selectedScreenStream
                .getTracks()
                .forEach(
                    function (track) {

                        track.stop();
                    }
                );


            throw new Error(
                "Screen video track was not returned by the browser."
            );
        }


        /*
        Save the screen stream globally.

        This is important because createPeerConnection()
        checks screenStream when a NEW participant joins.
        */

        screenStream =
            selectedScreenStream;


        console.log(
            "Screen track:",
            screenTrack.id
        );


        /*
        =====================================================
        REPLACE CAMERA WITH SCREEN FOR EXISTING PEERS
        =====================================================
        */

        await replaceVideoTrackForAllPeers(
            screenTrack
        );


        /*
        =====================================================
        LOCAL SCREEN PREVIEW
        =====================================================
        */

        setLocalVideoStream(
            screenStream,
            true
        );


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";
        }


        /*
        =====================================================
        UPDATE BUTTON
        =====================================================
        */

        updateScreenShareButton(
            true
        );


        showToast(
            "success",
            "Screen sharing started."
        );


        console.log(
            "Screen sharing is now active."
        );


        /*
        =====================================================
        BROWSER STOP SHARING
        =====================================================

        When the user clicks the browser's native
        "Stop sharing" button, the screen track fires
        the ended event.
        */

        screenTrack.onended =
            function () {

                console.log(
                    "Browser ended screen sharing."
                );


                stopScreenSharing(
                    false
                );
            };


    } catch (error) {

        console.error(
            "Screen sharing error:",
            error
        );


        /*
        Clean up failed screen stream.
        */

        if (screenStream) {

            screenStream
                .getTracks()
                .forEach(
                    function (track) {

                        try {

                            track.onended =
                                null;

                            track.stop();

                        } catch (stopError) {

                            console.warn(
                                "Unable to stop screen track:",
                                stopError
                            );
                        }
                    }
                );
        }


        screenStream =
            null;


        updateScreenShareButton(
            false
        );


        /*
        User cancelled the screen picker.
        */

        if (
            error?.name ===
                "NotAllowedError" ||

            error?.name ===
                "AbortError"
        ) {

            showToast(
                "info",
                "Screen sharing was cancelled."
            );


        } else {

            showToast(
                "error",
                "Unable to start screen sharing."
            );
        }
    }
}


/* =========================================================
   STOP SCREEN SHARING
========================================================= */

async function stopScreenSharing(
    showMessage = true
) {

    /*
    Save the current screen stream.

    screenStream is cleared immediately so that
    another "ended" event cannot recursively call
    this function.
    */

    const activeScreenStream =
        screenStream;


    if (!activeScreenStream) {

        updateScreenShareButton(
            false
        );

        return;
    }


    screenStream =
        null;


    /*
    =====================================================
    FIND ORIGINAL CAMERA TRACK
    =====================================================
    */

    const cameraTrack =
        localStream
            ?.getVideoTracks()
            ?.find(
                function (track) {

                    return (
                        track.readyState !==
                        "ended"
                    );
                }
            );


    /*
    =====================================================
    RESTORE CAMERA FOR ALL EXISTING PEERS
    =====================================================
    */

    if (cameraTrack) {

        await replaceVideoTrackForAllPeers(
            cameraTrack
        );
    }


    /*
    =====================================================
    STOP SCREEN TRACK
    =====================================================
    */

    activeScreenStream
        .getTracks()
        .forEach(
            function (track) {

                try {

                    track.onended =
                        null;

                    track.stop();

                } catch (error) {

                    console.warn(
                        "Unable to stop screen track:",
                        error
                    );
                }
            }
        );


    /*
    =====================================================
    RESTORE LOCAL CAMERA PREVIEW
    =====================================================
    */

    if (localStream) {

        if (cameraEnabled) {

            setLocalVideoStream(
                localStream,
                true
            );


            if (localPlaceholder) {

                localPlaceholder.style.display =
                    "none";
            }


        } else {

            setLocalVideoStream(
                localStream,
                false
            );


            if (localPlaceholder) {

                localPlaceholder.style.display =
                    "flex";
            }
        }
    }


    /*
    =====================================================
    RESET SCREEN SHARE BUTTON
    =====================================================
    */

    updateScreenShareButton(
        false
    );


    if (showMessage) {

        showToast(
            "info",
            "Screen sharing stopped."
        );
    }


    console.log(
        "Screen sharing stopped and camera restored."
    );
}


/* =========================================================
   16. PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    const remoteCount =
        Object.keys(
            participants
        ).length;


    const total =
        remoteCount + 1;


    if (participantCount) {

        participantCount.textContent =
            total;
    }


    updateParticipantsList();
}


/* =========================================================
   PARTICIPANT LIST
========================================================= */

function updateParticipantsList() {

    if (!participantsList) {
        return;
    }


    participantsList.innerHTML =
        "";


    addParticipantToList(
        userName,
        "You"
    );


    Object.values(
        participants
    ).forEach(
        function (name) {

            addParticipantToList(
                name,
                "Connected"
            );
        }
    );
}


/* =========================================================
   ADD PARTICIPANT TO LIST
========================================================= */

function addParticipantToList(
    name,
    status
) {

    if (!participantsList) {
        return;
    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "participant-item";


    const avatar =
        document.createElement(
            "div"
        );


    avatar.className =
        "participant-small-avatar";


    avatar.textContent =
        (name || "P")
            .charAt(0)
            .toUpperCase();


    const details =
        document.createElement(
            "div"
        );


    details.className =
        "participant-details";


    const strong =
        document.createElement(
            "strong"
        );


    strong.textContent =
        name;


    const span =
        document.createElement(
            "span"
        );


    span.textContent =
        status;


    details.appendChild(
        strong
    );


    details.appendChild(
        span
    );


    item.appendChild(
        avatar
    );


    item.appendChild(
        details
    );


    participantsList.appendChild(
        item
    );
}


/* =========================================================
   17. CHAT
========================================================= */

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const message =
                chatInput?.value?.trim();


            if (!message) {
                return;
            }


            if (
                !socket ||
                !socket.connected
            ) {

                showToast(
                    "error",
                    "Chat connection unavailable."
                );

                return;
            }


            socket.emit(
                "chat-message",
                {

                    meeting_id:
                        meetingId,

                    name:
                        userName,

                    message:
                        message
                }
            );


            addChatMessage(
                userName,
                message
            );


            if (chatInput) {

                chatInput.value =
                    "";
            }
        }
    );
}


/* =========================================================
   ADD CHAT MESSAGE
========================================================= */

function addChatMessage(
    name,
    message
) {

    if (!chatMessages) {
        return;
    }


    if (!message) {
        return;
    }


    const messageItem =
        document.createElement(
            "div"
        );


    messageItem.className =
        "chat-message";


    const nameElement =
        document.createElement(
            "strong"
        );


    nameElement.textContent =
        name;


    const textElement =
        document.createElement(
            "span"
        );


    textElement.textContent =
        message;


    messageItem.appendChild(
        nameElement
    );


    messageItem.appendChild(
        textElement
    );


    chatMessages.appendChild(
        messageItem
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


/* =========================================================
   18. SIDEBAR
========================================================= */

function openChat() {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.add(
        "show-chat"
    );


    meetingSidebar.classList.remove(
        "show-participants"
    );
}


function openParticipants() {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.add(
        "show-participants"
    );


    meetingSidebar.classList.remove(
        "show-chat"
    );


    updateParticipantsList();
}


function closeSidebar() {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.remove(
        "show-chat"
    );


    meetingSidebar.classList.remove(
        "show-participants"
    );
}


if (chatBtn) {

    chatBtn.addEventListener(
        "click",
        openChat
    );
}


if (meetingChatBtn) {

    meetingChatBtn.addEventListener(
        "click",
        openChat
    );
}


if (participantsBtn) {

    participantsBtn.addEventListener(
        "click",
        openParticipants
    );
}


if (meetingParticipantsBtn) {

    meetingParticipantsBtn.addEventListener(
        "click",
        openParticipants
    );
}


if (sidebarClose) {

    sidebarClose.addEventListener(
        "click",
        closeSidebar
    );
}


/* =========================================================
   19. LEAVE MEETING
========================================================= */

if (leaveMeetingBtn) {

    leaveMeetingBtn.addEventListener(
        "click",
        leaveMeeting
    );
}


if (leaveMeetingBtn2) {

    leaveMeetingBtn2.addEventListener(
        "click",
        leaveMeeting
    );
}


function leaveMeeting() {

    if (hasLeftMeeting) {
        return;
    }


    const confirmed =
        window.confirm(
            "Are you sure you want to leave the meeting?"
        );


    if (!confirmed) {
        return;
    }


    hasLeftMeeting =
        true;


    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "leave-meeting",
            {

                meeting_id:
                    meetingId
            }
        );
    }


    stopLocalMedia();

    closeAllPeerConnections();


    if (socket) {
        socket.disconnect();
    }


    window.location.href =
        "/meeting/";
}


/* =========================================================
   20. STOP LOCAL MEDIA
========================================================= */

function stopLocalMedia() {

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();
                }
            );


        localStream =
            null;
    }


    if (screenStream) {

        screenStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();
                }
            );


        screenStream =
            null;
    }


    if (localVideo) {

        try {
            localVideo.pause();
        } catch (error) {}


        localVideo.srcObject =
            null;
    }
}


/* =========================================================
   21. CLOSE ALL PEERS
========================================================= */

function closeAllPeerConnections() {

    Object.keys(
        peerConnections
    ).forEach(
        function (socketId) {

            try {

                const peer =
                    peerConnections[
                        socketId
                    ];


                peer.ontrack =
                    null;

                peer.onicecandidate =
                    null;

                peer.close();

            } catch (error) {

                console.error(
                    "Peer close error:",
                    error
                );
            }
        }
    );


    Object.keys(
        peerConnections
    ).forEach(
        function (key) {

            delete peerConnections[
                key
            ];
        }
    );


    Object.keys(
        participants
    ).forEach(
        function (key) {

            delete participants[
                key
            ];
        }
    );


    Object.keys(
        pendingIceCandidates
    ).forEach(
        function (key) {

            delete pendingIceCandidates[
                key
            ];
        }
    );


    Object.keys(
        remoteStreams
    ).forEach(
        function (key) {

            delete remoteStreams[
                key
            ];
        }
    );


    if (emptyState) {

        emptyState.style.display =
            "flex";
    }


    updateParticipantCount();
}


/* =========================================================
   22. CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    type,
    text
) {

    if (!connectionStatus) {
        return;
    }


    connectionStatus.classList.remove(
        "connected",
        "error",
        "connecting"
    );


    if (type === "connected") {

        connectionStatus.classList.add(
            "connected"
        );
    }


    if (type === "error") {

        connectionStatus.classList.add(
            "error"
        );
    }


    if (type === "connecting") {

        connectionStatus.classList.add(
            "connecting"
        );
    }


    if (connectionText) {

        connectionText.textContent =
            text;

    } else {

        connectionStatus.textContent =
            text;
    }
}


/* =========================================================
   23. TOAST
========================================================= */

let toastTimer =
    null;


function showToast(
    type,
    message
) {

    if (
        !meetingToast ||
        !toastMessage
    ) {

        console.log(
            `[${type}] ${message}`
        );

        return;
    }


    toastMessage.textContent =
        message;


    if (toastIcon) {

        if (type === "error") {

            toastIcon.textContent =
                "⚠️";

        } else if (type === "info") {

            toastIcon.textContent =
                "ℹ️";

        } else {

            toastIcon.textContent =
                "✓";
        }
    }


    meetingToast.classList.add(
        "show"
    );


    if (toastTimer) {

        clearTimeout(
            toastTimer
        );
    }


    toastTimer =
        setTimeout(
            function () {

                meetingToast.classList.remove(
                    "show"
                );

            },
            2500
        );
}


/* =========================================================
   24. BEFORE UNLOAD
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        if (
            socket &&
            socket.connected &&
            meetingId &&
            !hasLeftMeeting
        ) {

            socket.emit(
                "leave-meeting",
                {

                    meeting_id:
                        meetingId
                }
            );
        }


        stopLocalMedia();
    }
);


/* =========================================================
   25. USER INTERACTION PLAYBACK FALLBACK
========================================================= */

document.addEventListener(
    "click",
    function () {

        /*
        Local video.
        */

        if (
            localVideo &&
            localVideo.srcObject
        ) {

            localVideo.play().catch(
                function () {}
            );
        }


        /*
        Remote videos.
        */

        if (remoteVideos) {

            remoteVideos
                .querySelectorAll(
                    "video"
                )
                .forEach(
                    function (video) {

                        video.play().catch(
                            function () {}
                        );
                    }
                );
        }

    },
    {
        passive: true
    }
);


/* =========================================================
   26. PAGE INITIALIZATION
========================================================= */

function initializeMeetSpacePage() {

    console.log(
        "================================="
    );

    console.log(
        "MeetSpace meeting.js loaded."
    );

    console.log(
        "Meeting:",
        meetingId
    );

    console.log(
        "User:",
        userName
    );

    console.log(
        "================================="
    );


    if (!meetingId) {

        console.error(
            "Meeting ID is missing from #meetingApp."
        );


        updateConnectionStatus(
            "error",
            "Meeting ID missing"
        );


        return;
    }


    updateParticipantCount();


    /*
    Start Socket.IO.
    */

    initializeSocket();
}


/* =========================================================
   27. DOM READY
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMeetSpacePage,
        {
            once: true
        }
    );

} else {

    initializeMeetSpacePage();
}


/* =========================================================
                    END OF FILE
========================================================= */