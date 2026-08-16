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
        Refresh the session timestamp.
        */

        duplicateSessionHeartbeat =
            setInterval(
                function () {

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


        /*
        Announce this tab.
        */

        if (duplicateSessionChannel) {

            duplicateSessionChannel.postMessage({

                type:
                    "MEETSPACE_SESSION_CLAIM",

                token:
                    duplicateSessionToken,

                userKey:
                    lockKey
            });
        }

    } catch (error) {

        console.warn(
            "Duplicate session protection unavailable:",
            error
        );
    }
}


function releaseDuplicateSessionLock() {

    if (!duplicateSessionStarted) {
        return;
    }


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

            duplicateSessionChannel.postMessage({

                type:
                    "MEETSPACE_SESSION_RELEASE",

                token:
                    duplicateSessionToken,

                userKey:
                    lockKey
            });

            duplicateSessionChannel.close();

        } catch (error) {}

        duplicateSessionChannel =
            null;
    }


    duplicateSessionStarted =
        false;
}


/* =========================================================
   4. SOCKET.IO SCRIPT LOADING
========================================================= */

function loadSocketIO() {

    return new Promise(
        function (resolve, reject) {

            /*
            Socket.IO already available.
            */

            if (
                typeof window.io ===
                "function"
            ) {

                console.log(
                    "Socket.IO client already loaded."
                );

                resolve();

                return;
            }


            /*
            Prevent duplicate script loading.
            */

            if (socketScriptLoading) {

                const waitForSocket =
                    setInterval(
                        function () {

                            if (
                                typeof window.io ===
                                "function"
                            ) {

                                clearInterval(
                                    waitForSocket
                                );

                                resolve();

                            }

                        },
                        100
                    );


                setTimeout(
                    function () {

                        clearInterval(
                            waitForSocket
                        );

                        if (
                            typeof window.io !==
                            "function"
                        ) {

                            reject(
                                new Error(
                                    "Socket.IO client failed to load."
                                )
                            );
                        }

                    },
                    10000
                );

                return;
            }


            socketScriptLoading =
                true;


            console.log(
                "Loading Flask Socket.IO client..."
            );


            const existingScript =
                document.querySelector(
                    'script[src="/socket.io/socket.io.js"]'
                );


            if (existingScript) {

                const waitForExistingScript =
                    setInterval(
                        function () {

                            if (
                                typeof window.io ===
                                "function"
                            ) {

                                clearInterval(
                                    waitForExistingScript
                                );

                                socketScriptLoading =
                                    false;

                                resolve();

                            }

                        },
                        100
                    );


                setTimeout(
                    function () {

                        clearInterval(
                            waitForExistingScript
                        );

                        socketScriptLoading =
                            false;


                        if (
                            typeof window.io ===
                            "function"
                        ) {

                            resolve();

                        } else {

                            reject(
                                new Error(
                                    "Existing Socket.IO script did not load."
                                )
                            );
                        }

                    },
                    10000
                );

                return;
            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                "/socket.io/socket.io.js";


            script.async =
                true;


            script.onload =
                function () {

                    socketScriptLoading =
                        false;


                    if (
                        typeof window.io ===
                        "function"
                    ) {

                        console.log(
                            "Flask Socket.IO client loaded successfully."
                        );

                        resolve();

                    } else {

                        reject(
                            new Error(
                                "Socket.IO script loaded but io() is unavailable."
                            )
                        );
                    }
                };


            script.onerror =
                function (error) {

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


                    reject(
                        error ||
                        new Error(
                            "Socket.IO client failed to load."
                        )
                    );
                };


            document.head.appendChild(
                script
            );

        }
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


            createPeerConnection(
                remoteSocketId,
                remoteName
            );


            updateParticipantCount();


            /*
            Avoid duplicate names in the UI.
            */

            const participantKey =
                `${remoteSocketId}:${remoteName}`;


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
                remoteName,
                "Connected"
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


            if (!remoteSocketId) {
                return;
            }


            removeRemoteParticipant(
                remoteSocketId
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
                "PARTICIPANT COUNT:",
                data
            );


            /*
            The server count is useful for connection
            state, but the visible participant count is
            calculated from our unique participant list.
            */

            updateParticipantCount();
        }
    );


    /* =====================================================
       OFFER
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
                data?.sid ||
                data?.socket_id ||
                data?.from;


            const offer =
                data?.offer;


            const remoteName =
                data?.name ||
                data?.username ||
                "Participant";


            if (
                !remoteSocketId ||
                !offer
            ) {

                console.warn(
                    "Invalid offer received."
                );

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
                            offer
                        )
                    );


                /*
                Add ICE candidates that arrived
                before the remote description.
                */

                await flushPendingIceCandidates(
                    remoteSocketId
                );


                const answer =
                    await peerConnection
                        .createAnswer();


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
                                .localDescription,

                        name:
                            userName
                    }
                );


                console.log(
                    "ANSWER SENT ->",
                    remoteName,
                    remoteSocketId
                );


                updateParticipantCount();


            } catch (error) {

                console.error(
                    "Offer handling failed:",
                    error
                );
            }
        }
    );


    /* =====================================================
       ANSWER
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
                data?.sid ||
                data?.socket_id ||
                data?.from;


            const answer =
                data?.answer;


            if (
                !remoteSocketId ||
                !answer
            ) {

                console.warn(
                    "Invalid answer received."
                );

                return;
            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {

                console.warn(
                    "No peer connection for answer:",
                    remoteSocketId
                );

                return;
            }


            try {

                await peerConnection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            answer
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
                data?.sid ||
                data?.socket_id ||
                data?.from;


            const candidate =
                data?.candidate;


            if (
                !remoteSocketId ||
                !candidate
            ) {
                return;
            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            /*
            If the peer does not exist yet,
            queue the candidate.
            */

            if (!peerConnection) {

                if (
                    !pendingIceCandidates[
                        remoteSocketId
                    ]
                ) {

                    pendingIceCandidates[
                        remoteSocketId
                    ] = [];
                }


                pendingIceCandidates[
                    remoteSocketId
                ].push(
                    candidate
                );


                return;
            }


            /*
            If remote description has not arrived,
            queue the candidate.
            */

            if (
                !peerConnection
                    .remoteDescription
            ) {

                if (
                    !pendingIceCandidates[
                        remoteSocketId
                    ]
                ) {

                    pendingIceCandidates[
                        remoteSocketId
                    ] = [];
                }


                pendingIceCandidates[
                    remoteSocketId
                ].push(
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

                console.warn(
                    "ICE candidate failed:",
                    error
                );
            }
        }
    );


    /* =====================================================
       DUPLICATE SESSION
    ===================================================== */

    socket.on(
        "duplicate-session",
        function (data) {

            console.warn(
                "Duplicate session received:",
                data
            );


            forceCloseDuplicateSession();
        }
    );


    socket.on(
        "duplicate-login",
        function (data) {

            console.warn(
                "Duplicate login/session received:",
                data
            );


            forceCloseDuplicateSession();
        }
    );


    socket.on(
        "session-replaced",
        function (data) {

            console.warn(
                "Session replaced:",
                data
            );


            forceCloseDuplicateSession();
        }
    );


    /* =====================================================
       CHAT MESSAGE
    ===================================================== */

    socket.on(
        "chat-message",
        function (data) {

            console.log(
                "CHAT MESSAGE:",
                data
            );


            const name =
                data?.name ||
                data?.username ||
                "Participant";


            const message =
                data?.message ||
                "";


            if (!message) {
                return;
            }


            /*
            IMPORTANT:

            Do NOT display our own message immediately
            inside the submit handler.

            The server broadcasts the message back
            to the meeting room and this listener
            displays it exactly once.
            */

            addChatMessage(
                name,
                message
            );


            /*
            If chat sidebar is closed, show unread
            count for messages received.
            */

            if (
                meetingSidebar &&
                !meetingSidebar.classList.contains(
                    "open"
                )
            ) {

                increaseUnreadChatCount();
            }
        }
    );


    /* =====================================================
       SERVER ERROR
    ===================================================== */

    socket.on(
        "error",
        function (data) {

            console.error(
                "Socket server error:",
                data
            );


            const message =
                data?.message ||
                "Meeting server error.";


            showToast(
                "error",
                message
            );
        }
    );


    /* =====================================================
       MEETING ERROR
    ===================================================== */

    socket.on(
        "meeting-error",
        function (data) {

            console.error(
                "Meeting error:",
                data
            );


            showToast(
                "error",
                data?.message ||
                "Unable to process meeting request."
            );
        }
    );


    /* =====================================================
       SOCKET READY
    ===================================================== */

    socket.on(
        "room-joined",
        function (data) {

            console.log(
                "ROOM JOINED:",
                data
            );


            socketRoomJoined =
                true;


            updateConnectionStatus(
                "connected",
                "Connected"
            );


            updateParticipantCount();
        }
    );


    /*
    Some backend versions may use "joined-room"
    instead of "room-joined".
    */

    socket.on(
        "joined-room",
        function (data) {

            console.log(
                "JOINED ROOM:",
                data
            );


            socketRoomJoined =
                true;


            updateConnectionStatus(
                "connected",
                "Connected"
            );


            updateParticipantCount();
        }
    );


    /*
    Generic meeting-connected event.
    */

    socket.on(
        "meeting-connected",
        function (data) {

            console.log(
                "MEETING CONNECTED:",
                data
            );


            socketRoomJoined =
                true;


            updateConnectionStatus(
                "connected",
                "Connected"
            );


            updateParticipantCount();
        }
    );
}


/* =========================================================
   7. JOIN MEETING ROOM
========================================================= */

function joinMeetingRoom() {

    if (
        !socket ||
        !socket.connected
    ) {

        console.warn(
            "Cannot join room: socket not connected."
        );

        return;
    }


    if (
        !meetingId
    ) {

        console.error(
            "Cannot join meeting: meeting ID missing."
        );

        showToast(
            "error",
            "Meeting ID is missing."
        );

        return;
    }


    if (
        duplicateSessionLost ||
        hasLeftMeeting
    ) {
        return;
    }


    /*
    Prevent duplicate join events.
    */

    if (socketRoomJoined) {

        console.log(
            "Already joined meeting room."
        );

        return;
    }


    console.log(
        "Joining meeting room:",
        meetingId
    );


    updateConnectionStatus(
        "connecting",
        "Joining meeting..."
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


    /*
    We don't immediately mark socketRoomJoined
    here because the server still needs to confirm
    the room join.
    */
}


/* =========================================================
   8. INITIALIZE SOCKET
========================================================= */

async function initializeSocket() {

    if (
        socketInitialized
    ) {
        return;
    }


    if (
        duplicateSessionLost ||
        hasLeftMeeting
    ) {
        return;
    }


    socketInitialized =
        true;


    try {

        await loadSocketIO();


        if (
            duplicateSessionLost ||
            hasLeftMeeting
        ) {

            socketInitialized =
                false;

            return;
        }


        createSocket();


    } catch (error) {

        socketInitialized =
            false;


        console.error(
            "Socket initialization failed:",
            error
        );


        updateConnectionStatus(
            "error",
            "Socket.IO initialization failed"
        );


        showToast(
            "error",
            "Unable to connect to meeting server."
        );
    }
}


/* =========================================================
   9. INITIALIZE MEETING MEDIA
========================================================= */

async function initializeMeeting() {

    if (
        mediaInitializationStarted
    ) {
        return;
    }


    if (
        duplicateSessionLost ||
        hasLeftMeeting
    ) {
        return;
    }


    mediaInitializationStarted =
        true;


    console.log(
        "Initializing local media..."
    );


    try {

        /*
        Request camera + microphone.
        */

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
                        }
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


        microphoneEnabled =
            true;


        cameraEnabled =
            true;


        setLocalVideoStream(
            localStream,
            true
        );


        updateMicrophoneButton();

        updateCameraButton();


        console.log(
            "Local media initialized successfully."
        );


    } catch (error) {

        console.error(
            "Local media initialization failed:",
            error
        );


        mediaInitializationStarted =
            false;


        /*
        Try audio-only if camera access failed.
        */

        try {

            localStream =
                await navigator.mediaDevices
                    .getUserMedia({

                        video:
                            false,

                        audio: {

                            echoCancellation:
                                true,

                            noiseSuppression:
                                true,

                            autoGainControl:
                                true
                        }
                    });


            microphoneEnabled =
                true;


            cameraEnabled =
                false;


            setLocalVideoStream(
                localStream,
                false
            );


            updateMicrophoneButton();

            updateCameraButton();


            showToast(
                "info",
                "Camera unavailable. Joined with microphone only."
            );


        } catch (audioError) {

            console.error(
                "Audio-only initialization failed:",
                audioError
            );


            microphoneEnabled =
                false;


            cameraEnabled =
                false;


            updateMicrophoneButton();

            updateCameraButton();


            showToast(
                "error",
                "Camera and microphone access was denied."
            );
        }
    }
}


/* =========================================================
   10. LOCAL VIDEO STREAM
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


    if (
        stream &&
        showVideo
    ) {

        localVideo.style.display =
            "block";


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";
        }


        localVideo.muted =
            true;


        const playPromise =
            localVideo.play();


        if (
            playPromise &&
            typeof playPromise.catch ===
                "function"
        ) {

            playPromise.catch(
                function (error) {

                    console.warn(
                        "Local video autoplay blocked:",
                        error
                    );
                }
            );
        }


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
   11. CREATE WEBRTC PEER CONNECTION
========================================================= */

function createPeerConnection(
    remoteSocketId,
    remoteName = "Participant"
) {

    if (!remoteSocketId) {
        return null;
    }


    /*
    IMPORTANT DUPLICATE CONNECTION PROTECTION:

    If a connection already exists for this Socket.IO
    participant, return the existing connection.

    This prevents accidental creation of multiple
    RTCPeerConnections for the same remote socket.
    */

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
        "Creating WebRTC peer connection:",
        remoteSocketId,
        remoteName
    );


    const peerConnection =
        new RTCPeerConnection({

            iceServers: [

                {
                    urls:
                        "stun:stun.l.google.com:19302"
                },

                {
                    urls:
                        "stun:stun1.l.google.com:19302"
                }

            ]
        });


    peerConnections[
        remoteSocketId
    ] =
        peerConnection;


    participants[
        remoteSocketId
    ] =
        remoteName;


    /*
    Add local tracks.
    */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                function (track) {

                    try {

                        peerConnection.addTrack(
                            track,
                            localStream
                        );

                    } catch (error) {

                        console.warn(
                            "Could not add local track:",
                            error
                        );
                    }
                }
            );
    }


    /*
    ICE candidate handling.
    */

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


    /*
    Remote track handling.
    */

    peerConnection.ontrack =
        function (event) {

            console.log(
                "Remote track received:",
                remoteSocketId,
                event.track?.kind
            );


            let remoteStream =
                remoteStreams[
                    remoteSocketId
                ];


            if (!remoteStream) {

                remoteStream =
                    new MediaStream();


                remoteStreams[
                    remoteSocketId
                ] =
                    remoteStream;
            }


            /*
            Avoid adding the same track twice.
            */

            const alreadyAdded =
                remoteStream
                    .getTracks()
                    .some(
                        function (track) {

                            return (
                                track.id ===
                                event.track.id
                            );
                        }
                    );


            if (!alreadyAdded) {

                remoteStream.addTrack(
                    event.track
                );
            }


            createOrUpdateRemoteVideo(
                remoteSocketId,
                remoteName,
                remoteStream
            );


            /*
            Some browsers fire the event
            before the stream is completely ready.
            */

            event.track.onended =
                function () {

                    console.log(
                        "Remote track ended:",
                        remoteSocketId,
                        event.track.kind
                    );
                };
        };


    /*
    Connection state.
    */

    peerConnection.onconnectionstatechange =
        function () {

            const state =
                peerConnection.connectionState;


            console.log(
                "Peer connection state:",
                remoteSocketId,
                state
            );


            if (
                state ===
                    "connected"
            ) {

                updateParticipantCount();
            }


            if (
                state ===
                    "failed"
            ) {

                console.warn(
                    "Peer connection failed:",
                    remoteSocketId
                );


                /*
                Attempt ICE restart.
                */

                try {

                    if (
                        socket &&
                        socket.connected
                    ) {

                        peerConnection.restartIce();
                    }

                } catch (error) {}
            }


            if (
                state ===
                    "closed"
            ) {

                removeRemoteParticipant(
                    remoteSocketId
                );
            }
        };


    /*
    ICE connection state.
    */

    peerConnection.oniceconnectionstatechange =
        function () {

            const state =
                peerConnection
                    .iceConnectionState;


            console.log(
                "ICE state:",
                remoteSocketId,
                state
            );


            if (
                state ===
                    "failed"
            ) {

                try {

                    peerConnection.restartIce();

                } catch (error) {}
            }
        };


    /*
    ICE gathering state.
    */

    peerConnection.onicegatheringstatechange =
        function () {

            console.log(
                "ICE gathering state:",
                remoteSocketId,
                peerConnection
                    .iceGatheringState
            );
        };


    updateParticipantCount();


    return peerConnection;
}


/* =========================================================
   12. CREATE / UPDATE REMOTE VIDEO
========================================================= */

function createOrUpdateRemoteVideo(
    remoteSocketId,
    remoteName,
    stream
) {

    if (
        !remoteVideos ||
        !remoteSocketId
    ) {
        return;
    }


    let container =
        document.getElementById(
            `remote-${remoteSocketId}`
        );


    let video;


    if (!container) {

        container =
            document.createElement(
                "div"
            );


        container.className =
            "video-container remote-video-container";


        container.id =
            `remote-${remoteSocketId}`;


        video =
            document.createElement(
                "video"
            );


        video.autoplay =
            true;


        video.playsInline =
            true;


        video.className =
            "remote-video";


        video.dataset.socketId =
            remoteSocketId;


        const nameLabel =
            document.createElement(
                "div"
            );


        nameLabel.className =
            "video-name";


        nameLabel.textContent =
            remoteName ||
            "Participant";


        container.appendChild(
            video
        );


        container.appendChild(
            nameLabel
        );


        remoteVideos.appendChild(
            container
        );


    } else {

        video =
            container.querySelector(
                "video"
            );
    }


    if (!video) {
        return;
    }


    if (
        video.srcObject !==
        stream
    ) {

        video.srcObject =
            stream;
    }


    video.muted =
        false;


    /*
    Attempt playback.
    */

    const playPromise =
        video.play();


    if (
        playPromise &&
        typeof playPromise.catch ===
            "function"
    ) {

        playPromise.catch(
            function (error) {

                console.warn(
                    "Remote video autoplay blocked:",
                    error
                );
            }
        );
    }


    if (emptyState) {

        emptyState.style.display =
            "none";
    }
}


/* =========================================================
   13. FLUSH PENDING ICE
========================================================= */

async function flushPendingIceCandidates(
    remoteSocketId
) {

    const peerConnection =
        peerConnections[
            remoteSocketId
        ];


    if (!peerConnection) {
        return;
    }


    const queue =
        pendingIceCandidates[
            remoteSocketId
        ];


    if (
        !queue ||
        !queue.length
    ) {
        return;
    }


    /*
    Only add candidates after remote
    description is available.
    */

    if (
        !peerConnection
            .remoteDescription
    ) {
        return;
    }


    while (queue.length) {

        const candidate =
            queue.shift();


        try {

            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

        } catch (error) {

            console.warn(
                "Queued ICE candidate failed:",
                error
            );
        }
    }


    delete pendingIceCandidates[
        remoteSocketId
    ];
}


/* =========================================================
   14. REMOVE REMOTE PARTICIPANT
========================================================= */

function removeRemoteParticipant(
    remoteSocketId
) {

    if (!remoteSocketId) {
        return;
    }


    console.log(
        "Removing remote participant:",
        remoteSocketId
    );


    /*
    Close WebRTC connection.
    */

    const peerConnection =
        peerConnections[
            remoteSocketId
        ];


    if (peerConnection) {

        try {

            peerConnection.ontrack =
                null;

            peerConnection.onicecandidate =
                null;

            peerConnection.onconnectionstatechange =
                null;

            peerConnection.oniceconnectionstatechange =
                null;

            peerConnection.close();

        } catch (error) {

            console.warn(
                "Peer close error:",
                error
            );
        }


        delete peerConnections[
            remoteSocketId
        ];
    }


    /*
    Remove participant state.
    */

    delete participants[
        remoteSocketId
    ];


    delete pendingIceCandidates[
        remoteSocketId
    ];


    /*
    Stop remote stream tracks.
    */

    const remoteStream =
        remoteStreams[
            remoteSocketId
        ];


    if (remoteStream) {

        remoteStream
            .getTracks()
            .forEach(
                function (track) {

                    try {
                        track.stop();
                    } catch (error) {}
                }
            );


        delete remoteStreams[
            remoteSocketId
        ];
    }


    /*
    Remove video card.
    */

    const container =
        document.getElementById(
            `remote-${remoteSocketId}`
        );


    if (container) {

        container.remove();
    }


    /*
    Show empty state if there are
    no remote participants.
    */

    if (
        remoteVideos &&
        remoteVideos.children.length ===
            0 &&
        emptyState
    ) {

        emptyState.style.display =
            "flex";
    }


    updateParticipantCount();
}


/* =========================================================
   15. MICROPHONE BUTTON
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

        micBtn.classList.remove(
            "off"
        );


        micBtn.classList.add(
            "active"
        );


        micBtn.title =
            "Mute microphone";


        if (icon) {

            icon.textContent =
                "🎤";
        }


    } else {

        micBtn.classList.remove(
            "active"
        );


        micBtn.classList.add(
            "off"
        );


        micBtn.title =
            "Unmute microphone";


        if (icon) {

            icon.textContent =
                "🔇";
        }
    }
}


/* =========================================================
   16. TOGGLE MICROPHONE
========================================================= */

function toggleMicrophone() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {
        return;
    }


    if (!localStream) {

        showToast(
            "error",
            "Microphone is not available."
        );

        return;
    }


    const audioTracks =
        localStream.getAudioTracks();


    if (!audioTracks.length) {

        showToast(
            "error",
            "No microphone track found."
        );

        return;
    }


    microphoneEnabled =
        !microphoneEnabled;


    audioTracks.forEach(
        function (track) {

            track.enabled =
                microphoneEnabled;
        }
    );


    updateMicrophoneButton();


    showToast(
        "info",
        microphoneEnabled
            ? "Microphone unmuted."
            : "Microphone muted."
    );
}


/* =========================================================
   17. CAMERA BUTTON
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

        cameraBtn.classList.remove(
            "off"
        );


        cameraBtn.classList.add(
            "active"
        );


        cameraBtn.title =
            "Turn camera off";


        if (icon) {

            icon.textContent =
                "📹";
        }


    } else {

        cameraBtn.classList.remove(
            "active"
        );


        cameraBtn.classList.add(
            "off"
        );


        cameraBtn.title =
            "Turn camera on";


        if (icon) {

            icon.textContent =
                "📷";
        }
    }
}


/* =========================================================
   18. TOGGLE CAMERA
========================================================= */

function toggleCamera() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {
        return;
    }


    if (!localStream) {

        showToast(
            "error",
            "Camera is not available."
        );

        return;
    }


    const videoTracks =
        localStream.getVideoTracks();


    if (!videoTracks.length) {

        showToast(
            "error",
            "No camera track found."
        );

        return;
    }


    cameraEnabled =
        !cameraEnabled;


    videoTracks.forEach(
        function (track) {

            track.enabled =
                cameraEnabled;
        }
    );


    /*
    Keep local placeholder in sync.
    */

    if (cameraEnabled) {

        setLocalVideoStream(
            localStream,
            true
        );

    } else {

        setLocalVideoStream(
            localStream,
            false
        );
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
   19. BUTTON EVENTS
========================================================= */

if (micBtn) {

    micBtn.addEventListener(
        "click",
        toggleMicrophone
    );
}


if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        toggleCamera
    );
}

/* =========================================================
   20. SCREEN SHARE
========================================================= */

function updateScreenShareButton(
    sharing
) {

    if (!screenShareBtn) {
        return;
    }


    const icon =
        screenShareBtn.querySelector(
            ".control-icon"
        );


    if (sharing) {

        screenShareBtn.classList.add(
            "active"
        );


        screenShareBtn.title =
            "Stop screen sharing";


        if (icon) {

            icon.textContent =
                "🛑";
        }


    } else {

        screenShareBtn.classList.remove(
            "active"
        );


        screenShareBtn.title =
            "Share screen";


        if (icon) {

            icon.textContent =
                "🖥️";
        }
    }
}


/* =========================================================
   21. START SCREEN SHARE
========================================================= */

async function startScreenShare() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {
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
            "Starting screen share..."
        );


        screenStream =
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
            screenStream.getVideoTracks()[0];


        if (!screenTrack) {

            throw new Error(
                "No screen video track received."
            );
        }


        /*
        Replace the camera video track in every
        existing peer connection.
        */

        for (
            const remoteSocketId
            of Object.keys(
                peerConnections
            )
        ) {

            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {
                continue;
            }


            const senders =
                peerConnection
                    .getSenders();


            const videoSender =
                senders.find(
                    function (sender) {

                        return (
                            sender.track &&
                            sender.track.kind ===
                                "video"
                        );
                    }
                );


            if (videoSender) {

                try {

                    await videoSender
                        .replaceTrack(
                            screenTrack
                        );

                } catch (error) {

                    console.warn(
                        "Could not replace video track:",
                        remoteSocketId,
                        error
                    );
                }
            }
        }


        /*
        Show the shared screen locally.
        */

        if (localVideo) {

            localVideo.srcObject =
                screenStream;


            localVideo.style.display =
                "block";


            if (localPlaceholder) {

                localPlaceholder.style.display =
                    "none";
            }


            localVideo.muted =
                true;


            const playPromise =
                localVideo.play();


            if (
                playPromise &&
                typeof playPromise.catch ===
                    "function"
            ) {

                playPromise.catch(
                    function () {}
                );
            }
        }


        updateScreenShareButton(
            true
        );


        showToast(
            "success",
            "Screen sharing started."
        );


        /*
        Automatically stop when the browser's
        "Stop sharing" button is pressed.
        */

        screenTrack.onended =
            function () {

                stopScreenShare();
            };


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
            error?.name ===
            "NotAllowedError"
        ) {

            showToast(
                "info",
                "Screen sharing cancelled."
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
   22. STOP SCREEN SHARE
========================================================= */

async function stopScreenShare() {

    if (!screenStream) {

        updateScreenShareButton(
            false
        );

        return;
    }


    console.log(
        "Stopping screen share..."
    );


    /*
    Stop screen tracks.
    */

    screenStream
        .getTracks()
        .forEach(
            function (track) {

                try {

                    track.onended =
                        null;

                    track.stop();

                } catch (error) {}
            }
        );


    screenStream =
        null;


    /*
    Restore camera track.
    */

    const cameraTrack =
        localStream
            ?.getVideoTracks()
            ?.find(
                function (track) {

                    return track.readyState !==
                        "ended";
                }
            );


    if (cameraTrack) {

        cameraTrack.enabled =
            cameraEnabled;


        for (
            const remoteSocketId
            of Object.keys(
                peerConnections
            )
        ) {

            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {
                continue;
            }


            const senders =
                peerConnection
                    .getSenders();


            const videoSender =
                senders.find(
                    function (sender) {

                        return (
                            sender.track &&
                            sender.track.kind ===
                                "video"
                        );
                    }
                );


            if (videoSender) {

                try {

                    await videoSender
                        .replaceTrack(
                            cameraTrack
                        );

                } catch (error) {

                    console.warn(
                        "Could not restore camera track:",
                        remoteSocketId,
                        error
                    );
                }
            }
        }


        setLocalVideoStream(
            localStream,
            cameraEnabled
        );


    } else {

        /*
        If camera is unavailable,
        keep the placeholder visible.
        */

        setLocalVideoStream(
            null,
            false
        );
    }


    updateScreenShareButton(
        false
    );


    showToast(
        "info",
        "Screen sharing stopped."
    );
}


if (screenShareBtn) {

    screenShareBtn.addEventListener(
        "click",
        function () {

            if (screenStream) {

                stopScreenShare();

            } else {

                startScreenShare();
            }
        }
    );
}


/* =========================================================
   23. CHAT HELPERS
========================================================= */

let unreadChatCount = 0;


function increaseUnreadChatCount() {

    unreadChatCount +=
        1;


    updateUnreadChatBadge();
}


function clearUnreadChatCount() {

    unreadChatCount =
        0;


    updateUnreadChatBadge();
}


function updateUnreadChatBadge() {

    const badge =
        document.getElementById(
            "chatUnreadBadge"
        );


    if (!badge) {
        return;
    }


    if (
        unreadChatCount >
        0
    ) {

        badge.textContent =
            unreadChatCount >
            99
                ? "99+"
                : String(
                    unreadChatCount
                );


        badge.classList.add(
            "show"
        );


    } else {

        badge.textContent =
            "0";


        badge.classList.remove(
            "show"
        );
    }
}


/* =========================================================
   24. ADD CHAT MESSAGE
========================================================= */

function addChatMessage(
    name,
    message
) {

    if (!chatMessages) {
        return;
    }


    const cleanName =
        String(
            name ||
            "Participant"
        ).trim();


    const cleanMessage =
        String(
            message ||
            ""
        ).trim();


    if (!cleanMessage) {
        return;
    }


    /*
    Remove empty-state message.
    */

    const emptyMessage =
        chatMessages.querySelector(
            ".sidebar-empty"
        );


    if (emptyMessage) {

        emptyMessage.remove();
    }


    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        "chat-message";


    /*
    IMPORTANT SECURITY FIX:

    Use textContent instead of innerHTML
    for user-provided chat text.
    */

    const nameElement =
        document.createElement(
            "strong"
        );


    nameElement.textContent =
        cleanName;


    const textElement =
        document.createElement(
            "span"
        );


    textElement.textContent =
        cleanMessage;


    messageElement.appendChild(
        nameElement
    );


    messageElement.appendChild(
        textElement
    );


    chatMessages.appendChild(
        messageElement
    );


    /*
    Automatically scroll to newest message.
    */

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


/* =========================================================
   25. CHAT FORM
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
                hasLeftMeeting ||
                duplicateSessionLost
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


            /*
            IMPORTANT:

            Do NOT call addChatMessage() here.

            The server broadcasts the message back
            through the "chat-message" Socket.IO event.

            The socket listener displays it exactly once.
            */

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


            if (chatInput) {

                chatInput.value =
                    "";
            }
        }
    );
}


/* =========================================================
   26. CHAT SIDEBAR
========================================================= */

function openMeetingSidebar(
    panel
) {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.remove(
        "hidden"
    );


    meetingSidebar.classList.add(
        "open"
    );


    const chatPanel =
        document.getElementById(
            "chatPanel"
        );


    const participantsPanel =
        document.getElementById(
            "participantsPanel"
        );


    const chatTab =
        document.getElementById(
            "meetingChatBtn"
        );


    const participantsTab =
        document.getElementById(
            "meetingParticipantsBtn"
        );


    if (
        panel ===
        "participants"
    ) {

        if (chatPanel) {

            chatPanel.classList.remove(
                "active"
            );
        }


        if (participantsPanel) {

            participantsPanel.classList.add(
                "active"
            );
        }


        if (chatTab) {

            chatTab.classList.remove(
                "active"
            );
        }


        if (participantsTab) {

            participantsTab.classList.add(
                "active"
            );
        }


    } else {

        if (chatPanel) {

            chatPanel.classList.add(
                "active"
            );
        }


        if (participantsPanel) {

            participantsPanel.classList.remove(
                "active"
            );
        }


        if (chatTab) {

            chatTab.classList.add(
                "active"
            );
        }


        if (participantsTab) {

            participantsTab.classList.remove(
                "active"
            );
        }
    }


    if (
        panel ===
        "chat"
    ) {

        clearUnreadChatCount();


        setTimeout(
            function () {

                if (chatInput) {

                    chatInput.focus();
                }


                if (chatMessages) {

                    chatMessages.scrollTop =
                        chatMessages.scrollHeight;
                }

            },
            100
        );
    }


    updateParticipantsList();
}


function closeMeetingSidebar() {

    if (!meetingSidebar) {
        return;
    }


    meetingSidebar.classList.remove(
        "open"
    );


    /*
    Keep hidden class for CSS
    pointer-event behavior.
    */

    setTimeout(
        function () {

            if (
                meetingSidebar &&
                !meetingSidebar.classList.contains(
                    "open"
                )
            ) {

                meetingSidebar.classList.add(
                    "hidden"
                );
            }

        },
        250
    );
}


if (chatBtn) {

    chatBtn.addEventListener(
        "click",
        function () {

            openMeetingSidebar(
                "chat"
            );
        }
    );
}


if (meetingChatBtn) {

    meetingChatBtn.addEventListener(
        "click",
        function () {

            openMeetingSidebar(
                "chat"
            );
        }
    );
}


if (participantsBtn) {

    participantsBtn.addEventListener(
        "click",
        function () {

            openMeetingSidebar(
                "participants"
            );
        }
    );
}


if (meetingParticipantsBtn) {

    meetingParticipantsBtn.addEventListener(
        "click",
        function () {

            openMeetingSidebar(
                "participants"
            );
        }
    );
}


if (sidebarClose) {

    sidebarClose.addEventListener(
        "click",
        closeMeetingSidebar
    );
}


/* =========================================================
   27. PARTICIPANT LIST
========================================================= */

/*
Set used to prevent duplicate participant names
from being displayed in the visible list.
*/

const displayedNames =
    new Set();


function normalizeParticipantName(
    name
) {

    return String(
        name ||
        "Participant"
    )
        .trim()
        .toLowerCase();
}


function addParticipantToList(
    name,
    status = "Connected"
) {

    if (!participantsList) {
        return;
    }


    const cleanName =
        String(
            name ||
            "Participant"
        ).trim();


    const normalizedName =
        normalizeParticipantName(
            cleanName
        );


    /*
    Do not display the same person twice.
    */

    const existingItems =
        participantsList.querySelectorAll(
            ".participant-item"
        );


    for (
        const item
        of existingItems
    ) {

        const existingName =
            item.dataset.participantName ||
            "";


        if (
            existingName ===
            normalizedName
        ) {

            return;
        }
    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "participant-item";


    item.dataset.participantName =
        normalizedName;


    const avatar =
        document.createElement(
            "div"
        );


    avatar.className =
        "participant-small-avatar";


    avatar.textContent =
        cleanName
            .charAt(0)
            .toUpperCase() ||
        "P";


    const details =
        document.createElement(
            "div"
        );


    details.className =
        "participant-details";


    const nameElement =
        document.createElement(
            "strong"
        );


    nameElement.textContent =
        cleanName;


    const statusElement =
        document.createElement(
            "span"
        );


    statusElement.textContent =
        status;


    details.appendChild(
        nameElement
    );


    details.appendChild(
        statusElement
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


function updateParticipantsList() {

    if (!participantsList) {
        return;
    }


    participantsList.innerHTML =
        "";


    displayedNames.clear();


    /*
    Always show current user first.
    */

    const currentName =
        userName ||
        "Participant";


    const currentKey =
        normalizeParticipantName(
            currentName
        );


    displayedNames.add(
        currentKey
    );


    addParticipantToList(
        currentName,
        "You"
    );


    /*
    Add remote participants only once.
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
            Prevent current user from being
            added again under another Socket.IO ID.
            */

            if (
                participantKey ===
                currentKey
            ) {

                return;
            }


            /*
            Prevent duplicate names.
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
   28. PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    /*
    Use unique normalized names.

    This prevents duplicate Socket.IO connections
    from producing duplicate visible participants.
    */

    const uniqueNames =
        new Set();


    const currentName =
        normalizeParticipantName(
            userName ||
            "Participant"
        );


    if (currentName) {

        uniqueNames.add(
            currentName
        );
    }


    Object.values(
        participants
    ).forEach(
        function (name) {

            const normalizedName =
                normalizeParticipantName(
                    name
                );


            if (
                normalizedName
            ) {

                uniqueNames.add(
                    normalizedName
                );
            }
        }
    );


    if (participantCount) {

        participantCount.textContent =
            uniqueNames.size;
    }


    updateParticipantsList();
}


/* =========================================================
   29. TOAST
========================================================= */

function showToast(
    type,
    message
) {

    if (!meetingToast) {

        console.log(
            `[${type}]`,
            message
        );

        return;
    }


    if (toastMessage) {

        toastMessage.textContent =
            message;
    }


    if (toastIcon) {

        if (
            type ===
            "success"
        ) {

            toastIcon.textContent =
                "✓";

        } else if (
            type ===
            "error"
        ) {

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
   30. CONNECTION STATUS
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
   31. CLOSE ALL PEER CONNECTIONS
========================================================= */

function closeAllPeerConnections() {

    console.log(
        "Closing all WebRTC peer connections..."
    );


    /*
    Close every peer connection.
    */

    Object.keys(
        peerConnections
    ).forEach(
        function (remoteSocketId) {

            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {
                return;
            }


            try {

                /*
                Remove handlers before closing.
                This prevents cleanup events from
                creating unwanted UI states.
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
        function (remoteSocketId) {

            delete peerConnections[
                remoteSocketId
            ];
        }
    );


    /*
    Clear participant state.
    */

    Object.keys(
        participants
    ).forEach(
        function (remoteSocketId) {

            delete participants[
                remoteSocketId
            ];
        }
    );


    /*
    Clear ICE queues.
    */

    Object.keys(
        pendingIceCandidates
    ).forEach(
        function (remoteSocketId) {

            delete pendingIceCandidates[
                remoteSocketId
            ];
        }
    );


    /*
    Stop remote streams.
    */

    Object.keys(
        remoteStreams
    ).forEach(
        function (remoteSocketId) {

            const stream =
                remoteStreams[
                    remoteSocketId
                ];


            if (stream) {

                stream
                    .getTracks()
                    .forEach(
                        function (track) {

                            try {

                                track.stop();

                            } catch (error) {}
                        }
                    );
            }


            delete remoteStreams[
                remoteSocketId
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
   32. STOP LOCAL MEDIA
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
   33. LEAVE MEETING
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
    Tell server that we are leaving.
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
    Stop screen sharing first.
    */

    if (screenStream) {

        try {

            screenStream
                .getTracks()
                .forEach(
                    function (track) {

                        track.onended =
                            null;

                        track.stop();
                    }
                );

        } catch (error) {}


        screenStream =
            null;
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
    Release duplicate-session lock.
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
   34. LEAVE BUTTONS
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
   35. BEFORE UNLOAD
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        /*
        Tell server that the participant
        is leaving.

        IMPORTANT:
        Do not redirect here. The browser is
        already unloading.
        */

        if (
            socket &&
            socket.connected &&
            meetingId &&
            !hasLeftMeeting
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
        Release duplicate-session lock.
        */

        releaseDuplicateSessionLock();
    }
);


/* =========================================================
   36. PAGE VISIBILITY
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
   37. INITIALIZE MEETSPACE PAGE
========================================================= */

async function initializeMeetSpacePage() {

    if (meetingInitialized) {
        return;
    }


    meetingInitialized =
        true;


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
    Initial participant display.
    */

    updateParticipantCount();


    /*
    Initial button states.
    */

    updateMicrophoneButton();

    updateCameraButton();

    updateScreenShareButton(
        false
    );


    /*
    Start Socket.IO.

    Socket.IO will initialize the local
    media after connection and then join
    the meeting room.
    */

    initializeSocket();
}


/* =========================================================
   38. INITIAL PAGE LOAD
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