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
   DUPLICATE SESSION PROTECTION
========================================================= */

const duplicateSessionToken =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let duplicateSessionChannel = null;

let duplicateSessionHeartbeat = null;

let duplicateSessionStarted = false;

let duplicateSessionLost = false;


function getDuplicateSessionKey() {

    if (!meetingId) {
        return null;
    }

    const safeUserName =
        String(
            userName ||
            "Participant"
        )
            .trim()
            .toLowerCase();

    return (
        `meetspace-active-session:` +
        `${meetingId}:` +
        `${safeUserName}`
    );
}


function forceCloseDuplicateSession() {

    if (
        duplicateSessionLost ||
        hasLeftMeeting
    ) {
        return;
    }

    duplicateSessionLost = true;

    hasLeftMeeting = true;


    console.warn(
        "MeetSpace: duplicate meeting session detected."
    );


    if (duplicateSessionHeartbeat) {

        clearInterval(
            duplicateSessionHeartbeat
        );

        duplicateSessionHeartbeat =
            null;
    }


    const lockKey =
        getDuplicateSessionKey();


    try {

        if (lockKey) {

            const currentLock =
                JSON.parse(
                    localStorage.getItem(
                        lockKey
                    ) || "null"
                );


            if (
                currentLock?.token ===
                duplicateSessionToken
            ) {

                localStorage.removeItem(
                    lockKey
                );
            }
        }

    } catch (error) {}


    if (duplicateSessionChannel) {

        try {
            duplicateSessionChannel.close();
        } catch (error) {}

        duplicateSessionChannel =
            null;
    }


    /*
    Stop camera and microphone.
    */

    stopLocalMedia();


    /*
    Close all WebRTC connections.
    */

    closeAllPeerConnections();


    /*
    Disconnect Socket.IO.
    */

    if (socket) {

        try {
            socket.disconnect();
        } catch (error) {}
    }


    updateConnectionStatus(
        "error",
        "Meeting opened in another tab"
    );


    showToast(
        "error",
        "This meeting was opened in another tab. This tab has been disconnected."
    );
}


function initializeDuplicateSessionProtection() {

    if (
        duplicateSessionStarted ||
        !meetingId
    ) {
        return;
    }

    duplicateSessionStarted =
        true;


    const lockKey =
        getDuplicateSessionKey();


    if (!lockKey) {
        return;
    }


    /*
    BroadcastChannel allows tabs of the
    same browser to communicate immediately.
    */

    if (
        typeof BroadcastChannel ===
        "function"
    ) {

        try {

            duplicateSessionChannel =
                new BroadcastChannel(
                    `meetspace-session-${meetingId}`
                );


            duplicateSessionChannel.onmessage =
                function (event) {

                    const data =
                        event?.data || {};


                    if (
                        data.type ===
                            "MEETSPACE_SESSION_CLAIM" &&

                        data.token !==
                            duplicateSessionToken &&

                        data.userKey ===
                            lockKey
                    ) {

                        forceCloseDuplicateSession();
                    }
                };


        } catch (error) {

            duplicateSessionChannel =
                null;
        }
    }


    /*
    localStorage provides a second layer
    of duplicate-session protection.
    */

    try {

        localStorage.setItem(
            lockKey,
            JSON.stringify({

                token:
                    duplicateSessionToken,

                timestamp:
                    Date.now()
            })
        );


        /*
        Detect when another tab replaces
        the current session lock.
        */

        window.addEventListener(
            "storage",
            function (event) {

                if (
                    event.key !==
                        lockKey ||
                    !event.newValue
                ) {
                    return;
                }


                try {

                    const data =
                        JSON.parse(
                            event.newValue
                        );


                    if (
                        data?.token &&
                        data.token !==
                            duplicateSessionToken
                    ) {

                        forceCloseDuplicateSession();
                    }

                } catch (error) {}
            }
        );


        /*
        Keep the active session lock alive.
        */

        duplicateSessionHeartbeat =
            setInterval(
                function () {

                    if (
                        duplicateSessionLost ||
                        hasLeftMeeting
                    ) {
                        return;
                    }


                    try {

                        const currentLock =
                            JSON.parse(
                                localStorage.getItem(
                                    lockKey
                                ) || "null"
                            );


                        if (
                            currentLock?.token &&
                            currentLock.token !==
                                duplicateSessionToken
                        ) {

                            forceCloseDuplicateSession();

                            return;
                        }


                        localStorage.setItem(
                            lockKey,
                            JSON.stringify({

                                token:
                                    duplicateSessionToken,

                                timestamp:
                                    Date.now()
                            })
                        );


                    } catch (error) {}

                },
                2000
            );


    } catch (error) {

        console.warn(
            "MeetSpace: localStorage duplicate-session protection unavailable.",
            error
        );
    }


    /*
    Announce this active session to other tabs.
    */

    if (duplicateSessionChannel) {

        try {

            duplicateSessionChannel.postMessage({

                type:
                    "MEETSPACE_SESSION_CLAIM",

                token:
                    duplicateSessionToken,

                userKey:
                    lockKey

            });

        } catch (error) {}
    }
}


function releaseDuplicateSessionLock() {

    if (duplicateSessionHeartbeat) {

        clearInterval(
            duplicateSessionHeartbeat
        );

        duplicateSessionHeartbeat =
            null;
    }


    const lockKey =
        getDuplicateSessionKey();


    try {

        if (lockKey) {

            const currentLock =
                JSON.parse(
                    localStorage.getItem(
                        lockKey
                    ) || "null"
                );


            if (
                currentLock?.token ===
                duplicateSessionToken
            ) {

                localStorage.removeItem(
                    lockKey
                );
            }
        }

    } catch (error) {}


    if (duplicateSessionChannel) {

        try {
            duplicateSessionChannel.close();
        } catch (error) {}

        duplicateSessionChannel =
            null;
    }
}



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

    socketInitialized =
        true;


    /*
    If Socket.IO is already present,
    immediately create the connection.
    */

    if (
        typeof window.io ===
        "function"
    ) {

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

    socketScriptLoading =
        true;


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
        document.createElement(
            "script"
        );


    /*
    IMPORTANT:

    Flask-SocketIO serves this file automatically.
    */

    script.src =
        "/socket.io/socket.io.js";


    script.async =
        false;


    script.dataset.meetspaceSocketio =
        "true";


    script.onload =
        function () {

            socketScriptLoading =
                false;


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
                typeof window.io ===
                "function"
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

            socketScriptLoading =
                false;


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


    document.head.appendChild(
        script
    );
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


    if (
        typeof window.io !==
        "function"
    ) {

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


        socket =
            null;


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


    socketEventsRegistered =
        true;


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


            hasLeftMeeting =
                false;


            socketRoomJoined =
                false;


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


                socketRoomJoined =
                    false;


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


                socketRoomJoined =
                    false;


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


            socketRoomJoined =
                false;


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
                ] =
                    remoteName;


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
            ] =
                remoteName;


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
            ] =
                remoteName;


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


/* =========================================================
   PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    /*
    Use unique participant names for the displayed count.

    This prevents the same person from being counted
    multiple times when more than one Socket.IO connection
    exists for the same display name.
    */

    const uniqueParticipants =
        new Set();


    /*
    Always include the current user.
    */

    const currentUser =
        String(
            userName || "Participant"
        )
            .trim()
            .toLowerCase();


    if (currentUser) {

        uniqueParticipants.add(
            currentUser
        );
    }


    /*
    Add remote participants only once.
    */

    Object.values(
        participants
    ).forEach(
        function (name) {

            const normalizedName =
                String(
                    name || "Participant"
                )
                    .trim()
                    .toLowerCase();


            if (normalizedName) {

                uniqueParticipants.add(
                    normalizedName
                );
            }
        }
    );


    const total =
        uniqueParticipants.size;


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


    /*
    Clear the old list first.
    */

    participantsList.innerHTML =
        "";


    /*
    Keep track of names already displayed.

    This is the important duplicate fix.
    */

    const displayedNames =
        new Set();


    /*
    Normalize names so these are considered
    the same participant:

        Kishan
        kishan
        Kishan 
    */

    function normalizeParticipantName(
        name
    ) {

        return String(
            name || "Participant"
        )
            .trim()
            .toLowerCase();
    }


    /*
    Add CURRENT USER.

    The current user should always appear exactly once.
    */

    const currentName =
        userName ||
        "Participant";


    const currentKey =
        normalizeParticipantName(
            currentName
        );


    if (!displayedNames.has(
        currentKey
    )) {

        displayedNames.add(
            currentKey
        );


        addParticipantToList(
            currentName,
            "You"
        );
    }


    /*
    Add REMOTE participants.

    If the same name exists under multiple Socket.IO
    IDs, only the first one is displayed.
    */

    Object.values(
        participants
    ).forEach(
        function (name) {

            const participantName =
                name ||
                "Participant";


            const participantKey =
                normalizeParticipantName(
                    participantName
                );


            /*
            IMPORTANT:

            Do not display the current user again
            if another Socket.IO connection belonging
            to the same user appears.
            */

            if (
                participantKey ===
                currentKey
            ) {

                return;
            }


            /*
            Skip duplicate names.
            */

            if (
                displayedNames.has(
                    participantKey
                )
            ) {

                return;
            }


            displayedNames.add(
                participantKey
            );


            addParticipantToList(
                participantName,
                "Connected"
            );
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


    mediaInitializationStarted =
        true;


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

        return (
            "Camera or microphone unavailable."
        );
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


    if (showVideo) {

        localVideo.style.display =
            "block";


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";
        }


        localVideo.play().catch(
            function (error) {

                console.warn(
                    "Local preview playback failed:",
                    error
                );
            }
        );


    } else {

        localVideo.style.display =
            "none";


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "flex";
        }
    }
}


/* =========================================================
   START SCREEN SHARING
========================================================= */

async function startScreenSharing() {

    if (screenStream) {

        console.log(
            "Screen sharing is already active."
        );


        return;
    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia
    ) {

        showToast(
            "error",
            "Screen sharing is not supported by this browser."
        );


        return;
    }


    try {

        console.log(
            "Starting screen sharing..."
        );


        screenStream =
            await navigator.mediaDevices
                .getDisplayMedia({

                    video: {

                        frameRate: {
                            ideal: 30,
                            max: 30
                        }
                    },

                    audio: false
                });


        const screenTrack =
            screenStream.getVideoTracks()[0];


        if (!screenTrack) {

            throw new Error(
                "No screen video track was returned."
            );
        }


        /*
        Browser's native "Stop sharing" button.
        */

        screenTrack.onended =
            function () {

                console.log(
                    "Browser stopped screen sharing."
                );


                stopScreenSharing(
                    true
                );
            };


        /*
        Show screen locally.
        */

        setLocalVideoStream(
            screenStream,
            true
        );


        /*
        Replace camera track with screen track
        for every existing WebRTC peer.
        */

        await replaceVideoTrackForAllPeers(
            screenTrack
        );


        /*
        Update button.
        */

        updateScreenShareButton(
            true
        );


        showToast(
            "success",
            "Screen sharing started."
        );


        console.log(
            "Screen sharing started successfully."
        );


    } catch (error) {

        console.error(
            "Screen sharing failed:",
            error
        );


        screenStream =
            null;


        updateScreenShareButton(
            false
        );


        if (
            error &&
            (
                error.name ===
                "NotAllowedError" ||

                error.name ===
                "AbortError"
            )
        ) {

            showToast(
                "info",
                "Screen sharing was cancelled."
            );


            /*
            Restore camera preview.
            */

            if (localStream) {

                setLocalVideoStream(
                    localStream,
                    cameraEnabled
                );
            }


            return;
        }


        showToast(
            "error",
            "Unable to start screen sharing."
        );
    }
}


/* =========================================================
   STOP SCREEN SHARING
========================================================= */

async function stopScreenSharing(
    fromBrowser = false
) {

    if (!screenStream) {

        updateScreenShareButton(
            false
        );


        if (localStream) {

            setLocalVideoStream(
                localStream,
                cameraEnabled
            );
        }


        return;
    }


    console.log(
        "Stopping screen sharing..."
    );


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
    Stop the screen tracks.
    */

    screenStream
        .getTracks()
        .forEach(
            function (track) {

                try {
                    track.stop();
                } catch (error) {}
            }
        );


    screenStream =
        null;


    /*
    Restore camera track to every peer.
    */

    if (cameraTrack) {

        await replaceVideoTrackForAllPeers(
            cameraTrack
        );
    }


    /*
    Restore local camera preview.
    */

    if (localStream) {

        setLocalVideoStream(
            localStream,
            cameraEnabled
        );
    }


    updateScreenShareButton(
        false
    );


    if (!fromBrowser) {

        showToast(
            "info",
            "Screen sharing stopped."
        );
    }


    console.log(
        "Screen sharing stopped."
    );
}


/* =========================================================
   TOGGLE SCREEN SHARING
========================================================= */

async function toggleScreenShare() {

    if (hasLeftMeeting) {
        return;
    }


    if (screenStream) {

        await stopScreenSharing();

        return;
    }


    await startScreenSharing();
}


/* =========================================================
   SCREEN SHARE BUTTON UI
========================================================= */

function updateScreenShareButton(
    sharing
) {

    if (!screenShareBtn) {
        return;
    }


    if (sharing) {

        screenShareBtn.classList.add(
            "active"
        );


        screenShareBtn.classList.remove(
            "off"
        );


        screenShareBtn.title =
            "Stop sharing screen";


        const icon =
            screenShareBtn.querySelector(
                ".control-icon"
            );


        if (icon) {

            icon.textContent =
                "🛑";
        }


    } else {

        screenShareBtn.classList.remove(
            "active"
        );


        screenShareBtn.classList.remove(
            "off"
        );


        screenShareBtn.title =
            "Share screen";


        const icon =
            screenShareBtn.querySelector(
                ".control-icon"
            );


        if (icon) {

            icon.textContent =
                "🖥️";
        }
    }
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


    /*
    Add current user.
    */

    addParticipantToList(
        userName,
        "You"
    );


    /*
    Add remote participants.
    */

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
        name ||
        "Participant";


    const span =
        document.createElement(
            "span"
        );


    span.textContent =
        status ||
        "Connected";


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


            /*
            Do not send chat when this tab has
            already been disconnected because
            another tab joined the same meeting.
            */

            if (
                duplicateSessionLost ||
                hasLeftMeeting
            ) {

                showToast(
                    "error",
                    "This meeting session is no longer active."
                );


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


            /*
            Show our own message immediately.
            */

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
        name ||
        "Participant";


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


    /*
    Always scroll to the latest message.
    */

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


/* =========================================================
   18. SIDEBAR
========================================================= */

function openSidebar(
    section = "chat"
) {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.add(
        "open"
    );


    meetingSidebar.classList.remove(
        "hidden"
    );


    if (
        section ===
        "participants"
    ) {

        showParticipantsPanel();

    } else {

        showChatPanel();
    }
}


/* =========================================================
   CLOSE SIDEBAR
========================================================= */

function closeSidebar() {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.remove(
        "open"
    );


    meetingSidebar.classList.add(
        "hidden"
    );
}


/* =========================================================
   SHOW CHAT PANEL
========================================================= */

function showChatPanel() {

    const chatPanel =
        document.getElementById(
            "chatPanel"
        );


    const participantsPanel =
        document.getElementById(
            "participantsPanel"
        );


    if (chatPanel) {

        chatPanel.style.display =
            "block";
    }


    if (participantsPanel) {

        participantsPanel.style.display =
            "none";
    }


    openSidebarWithoutAnimation();
}


/* =========================================================
   SHOW PARTICIPANTS PANEL
========================================================= */

function showParticipantsPanel() {

    const chatPanel =
        document.getElementById(
            "chatPanel"
        );


    const participantsPanel =
        document.getElementById(
            "participantsPanel"
        );


    if (chatPanel) {

        chatPanel.style.display =
            "none";
    }


    if (participantsPanel) {

        participantsPanel.style.display =
            "block";
    }


    updateParticipantsList();


    openSidebarWithoutAnimation();
}


/* =========================================================
   OPEN SIDEBAR
========================================================= */

function openSidebarWithoutAnimation() {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.add(
        "open"
    );


    meetingSidebar.classList.remove(
        "hidden"
    );
}


/* =========================================================
   CHAT BUTTONS
========================================================= */

if (chatBtn) {

    chatBtn.addEventListener(
        "click",
        function () {

            showChatPanel();
        }
    );
}


if (meetingChatBtn) {

    meetingChatBtn.addEventListener(
        "click",
        function () {

            showChatPanel();
        }
    );
}


/* =========================================================
   PARTICIPANT BUTTONS
========================================================= */

if (participantsBtn) {

    participantsBtn.addEventListener(
        "click",
        function () {

            showParticipantsPanel();
        }
    );
}


if (meetingParticipantsBtn) {

    meetingParticipantsBtn.addEventListener(
        "click",
        function () {

            showParticipantsPanel();
        }
    );
}


/* =========================================================
   SIDEBAR CLOSE BUTTON
========================================================= */

if (sidebarClose) {

    sidebarClose.addEventListener(
        "click",
        function () {

            closeSidebar();
        }
    );
}


/* =========================================================
   19. TOAST
========================================================= */

function showToast(
    type,
    message
) {

    if (!meetingToast) {

        console.log(
            `[${type}] ${message}`
        );


        return;
    }


    if (toastMessage) {

        toastMessage.textContent =
            message;
    }


    if (toastIcon) {

        if (type === "success") {

            toastIcon.textContent =
                "✓";


        } else if (type === "error") {

            toastIcon.textContent =
                "✕";


        } else {

            toastIcon.textContent =
                "ℹ";
        }
    }


    meetingToast.classList.remove(
        "success",
        "error",
        "info"
    );


    meetingToast.classList.add(
        type
    );


    meetingToast.classList.add(
        "show"
    );


    clearTimeout(
        meetingToast._hideTimer
    );


    meetingToast._hideTimer =
        setTimeout(
            function () {

                meetingToast.classList.remove(
                    "show"
                );

            },
            3000
        );
}


/* =========================================================
   20. CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    type,
    message
) {

    if (connectionStatus) {

        connectionStatus.classList.remove(
            "connected",
            "connecting",
            "error",
            "disconnected"
        );


        connectionStatus.classList.add(
            type
        );
    }


    if (connectionText) {

        connectionText.textContent =
            message;
    }
}


/* =========================================================
   21. CLOSE ALL PEER CONNECTIONS
========================================================= */

function closeAllPeerConnections() {

    console.log(
        "Closing all WebRTC peer connections..."
    );


    Object.keys(
        peerConnections
    ).forEach(
        function (socketId) {

            const peerConnection =
                peerConnections[
                    socketId
                ];


            if (!peerConnection) {
                return;
            }


            try {

                /*
                Remove handlers before closing.
                This prevents cleanup events from
                creating unwanted new UI states.
                */

                peerConnection.ontrack =
                    null;


                peerConnection.onicecandidate =
                    null;


                peerConnection.onconnectionstatechange =
                    null;


                peerConnection.oniceconnectionstatechange =
                    null;


                peerConnection.onicegatheringstatechange =
                    null;


                peerConnection.close();


            } catch (error) {

                console.warn(
                    "Peer connection cleanup error:",
                    error
                );
            }
        }
    );


    /*
    Clear peer objects.
    */

    Object.keys(
        peerConnections
    ).forEach(
        function (socketId) {

            delete peerConnections[
                socketId
            ];
        }
    );


    /*
    Clear participant state.
    */

    Object.keys(
        participants
    ).forEach(
        function (socketId) {

            delete participants[
                socketId
            ];
        }
    );


    /*
    Clear ICE queues.
    */

    Object.keys(
        pendingIceCandidates
    ).forEach(
        function (socketId) {

            delete pendingIceCandidates[
                socketId
            ];
        }
    );


    /*
    Clear remote streams.
    */

    Object.keys(
        remoteStreams
    ).forEach(
        function (socketId) {

            delete remoteStreams[
                socketId
            ];
        }
    );


    /*
    Remove remote video cards.
    */

    if (remoteVideos) {

        remoteVideos.innerHTML =
            "";
    }


    if (emptyState) {

        emptyState.style.display =
            "flex";
    }


    updateParticipantCount();
}


/* =========================================================
   22. STOP LOCAL MEDIA
========================================================= */

function stopLocalMedia() {

    console.log(
        "Stopping local media..."
    );


    /*
    Stop screen-sharing tracks.
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

                    } catch (error) {

                        console.warn(
                            "Screen track cleanup error:",
                            error
                        );
                    }
                }
            );


        screenStream =
            null;
    }


    /*
    Stop camera + microphone tracks.
    */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                function (track) {

                    try {

                        track.stop();

                    } catch (error) {

                        console.warn(
                            "Local media cleanup error:",
                            error
                        );
                    }
                }
            );


        localStream =
            null;
    }


    /*
    Clear local video.
    */

    if (localVideo) {

        try {
            localVideo.pause();
        } catch (error) {}


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

    updateScreenShareButton(
        false
    );


    console.log(
        "Local media stopped."
    );
}


/* =========================================================
   23. LEAVE MEETING
========================================================= */

function leaveMeeting() {

    if (hasLeftMeeting) {
        return;
    }


    hasLeftMeeting =
        true;


    console.log(
        "Leaving meeting..."
    );


    /*
    Tell the server that we are leaving.
    */

    if (
        socket &&
        socket.connected
    ) {

        try {

            socket.emit(
                "leave-meeting",
                {

                    meeting_id:
                        meetingId
                }
            );

        } catch (error) {

            console.warn(
                "Leave event failed:",
                error
            );
        }
    }


    /*
    Stop all local media.
    */

    stopLocalMedia();


    /*
    Close all WebRTC connections.
    */

    closeAllPeerConnections();


    /*
    Disconnect Socket.IO.
    */

    if (socket) {

        try {

            socket.disconnect();

        } catch (error) {

            console.warn(
                "Socket disconnect error:",
                error
            );
        }
    }


    /*
    IMPORTANT DUPLICATE-SESSION FIX:
    Release our tab's session lock.
    */

    releaseDuplicateSessionLock();


    updateConnectionStatus(
        "disconnected",
        "Meeting ended"
    );


    /*
    Return to meeting page.
    */

    window.location.href =
        "/meeting/";
}


/* =========================================================
   LEAVE BUTTONS
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


/* =========================================================
   24. BEFORE UNLOAD
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        /*
        Tell server that the participant
        is leaving.

        IMPORTANT:
        Use sendBeacon-style behavior through
        Socket.IO if it is still connected.
        */

        if (
            socket &&
            socket.connected &&
            meetingId
        ) {

            try {

                socket.emit(
                    "leave-meeting",
                    {

                        meeting_id:
                            meetingId
                    }
                );

            } catch (error) {

                console.warn(
                    "beforeunload leave failed:",
                    error
                );
            }
        }


        /*
        Stop microphone and camera.
        */

        stopLocalMedia();


        /*
        Close WebRTC.
        */

        closeAllPeerConnections();


        /*
        Release the duplicate-session lock.
        */

        releaseDuplicateSessionLock();
    }
);


/* =========================================================
   25. PAGE VISIBILITY
========================================================= */

document.addEventListener(
    "visibilitychange",
    function () {

        /*
        IMPORTANT:

        Do NOT leave the meeting merely because
        the user switches browser tabs.

        A user may legitimately switch tabs
        while keeping the meeting active.

        Duplicate-session protection handles
        another meeting tab separately.
        */

        if (
            document.visibilityState ===
            "visible"
        ) {

            if (
                localVideo &&
                localVideo.srcObject
            ) {

                localVideo.play().catch(
                    function () {}
                );
            }
        }
    }
);


/* =========================================================
   26. INITIALIZE MEETING PAGE
========================================================= */

async function initializeMeetSpacePage() {

    if (meetingInitialized) {
        return;
    }


    console.log(
        "================================="
    );


    console.log(
        "INITIALIZING MEETSPACE"
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


    /*
    IMPORTANT:

    Start duplicate-session protection BEFORE
    Socket.IO and WebRTC initialization.

    This prevents a duplicate tab from creating
    another microphone/camera connection.
    */

    initializeDuplicateSessionProtection();


    if (duplicateSessionLost) {

        console.warn(
            "Duplicate meeting session detected. Initialization stopped."
        );


        return;
    }


    /*
    Update participant count.
    */

    updateParticipantCount();


    /*
    Start Socket.IO.
    */

    initializeSocket();
}


/* =========================================================
   27. INITIAL PAGE LOAD
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMeetSpacePage
    );

} else {

    initializeMeetSpacePage();
}


/* =========================================================
   END OF MEETING.JS
========================================================= */