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

=========================================================
*/


/* =========================================================
   1. MEETING INFORMATION
========================================================= */

const meetingApp =
    document.getElementById("meetingApp");

if (!meetingApp) {

    console.error(
        "MeetSpace: #meetingApp not found."
    );

}

const meetingId =
    meetingApp?.dataset?.meetingId || "";

const userName =
    meetingApp?.dataset?.userName ||
    "Participant";


console.log(
    "========================================"
);

console.log(
    "        MEETSPACE MEETING CLIENT"
);

console.log(
    "========================================"
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
    "========================================"
);


/* =========================================================
   2. HTML ELEMENTS
========================================================= */

const localVideo =
    document.getElementById(
        "localVideo"
    );

const localPlaceholder =
    document.getElementById(
        "localPlaceholder"
    );

const remoteVideos =
    document.getElementById(
        "remoteVideos"
    );

const emptyState =
    document.getElementById(
        "emptyState"
    );


/* =========================================================
   BUTTONS
========================================================= */

const micBtn =
    document.getElementById(
        "micBtn"
    );

const cameraBtn =
    document.getElementById(
        "cameraBtn"
    );

const screenShareBtn =
    document.getElementById(
        "screenShareBtn"
    );

const leaveMeetingBtn =
    document.getElementById(
        "leaveMeetingBtn"
    );

const leaveMeetingBtn2 =
    document.getElementById(
        "leaveMeetingBtn2"
    );


/* =========================================================
   CONNECTION STATUS
========================================================= */

const connectionStatus =
    document.getElementById(
        "connectionStatus"
    );

const connectionText =
    document.getElementById(
        "connectionText"
    );


/* =========================================================
   PARTICIPANTS
========================================================= */

const participantCount =
    document.getElementById(
        "participantCount"
    );

const participantsList =
    document.getElementById(
        "participantsList"
    );


/* =========================================================
   CHAT
========================================================= */

const chatForm =
    document.getElementById(
        "chatForm"
    );

const chatInput =
    document.getElementById(
        "chatInput"
    );

const chatMessages =
    document.getElementById(
        "chatMessages"
    );


/* =========================================================
   SIDEBAR
========================================================= */

const meetingSidebar =
    document.getElementById(
        "meetingSidebar"
    );

const chatBtn =
    document.getElementById(
        "chatBtn"
    );

const meetingChatBtn =
    document.getElementById(
        "meetingChatBtn"
    );

const participantsBtn =
    document.getElementById(
        "participantsBtn"
    );

const meetingParticipantsBtn =
    document.getElementById(
        "meetingParticipantsBtn"
    );

const sidebarClose =
    document.getElementById(
        "sidebarClose"
    );


/* =========================================================
   TOAST
========================================================= */

const meetingToast =
    document.getElementById(
        "meetingToast"
    );

const toastMessage =
    document.getElementById(
        "toastMessage"
    );

const toastIcon =
    document.getElementById(
        "toastIcon"
    );


/* =========================================================
   3. WEBRTC VARIABLES
========================================================= */

let localStream =
    null;

let screenStream =
    null;

let socket =
    null;


/*
One RTCPeerConnection per remote participant.
*/

const peerConnections =
    {};


/*
Participant names indexed by Socket.IO SID.
*/

const participants =
    {};


/*
Pending ICE candidates.
*/

const pendingIceCandidates =
    {};


/*
Remote MediaStreams.
*/

const remoteStreams =
    {};


/* =========================================================
   LOCAL MEDIA STATE
========================================================= */

let microphoneEnabled =
    true;

let cameraEnabled =
    true;


/* =========================================================
   INITIALIZATION FLAGS
========================================================= */

let meetingInitialized =
    false;

let socketRoomJoined =
    false;

let hasLeftMeeting =
    false;

let socketInitialized =
    false;

let mediaInitializationStarted =
    false;

let socketEventsRegistered =
    false;

let socketScriptLoading =
    false;


/* =========================================================
   DUPLICATE SESSION PROTECTION
========================================================= */

const duplicateSessionToken =
    `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

let duplicateSessionChannel =
    null;

let duplicateSessionHeartbeat =
    null;

let duplicateSessionStarted =
    false;

let duplicateSessionLost =
    false;


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


    duplicateSessionLost =
        true;

    hasLeftMeeting =
        true;


    console.warn(
        "MeetSpace: duplicate meeting session detected."
    );


    if (
        duplicateSessionHeartbeat
    ) {

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


    if (
        duplicateSessionChannel
    ) {

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

        if (
            duplicateSessionChannel
        ) {

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
/* =========================================================
   RELEASE DUPLICATE SESSION LOCK
========================================================= */

function releaseDuplicateSessionLock() {

    if (
        !duplicateSessionStarted
    ) {

        return;

    }


    if (
        duplicateSessionHeartbeat
    ) {

        clearInterval(
            duplicateSessionHeartbeat
        );

        duplicateSessionHeartbeat =
            null;

    }


    const lockKey =
        getDuplicateSessionKey();


    if (lockKey) {

        try {

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

        } catch (error) {}

    }


    if (
        duplicateSessionChannel
    ) {

        try {

            duplicateSessionChannel.postMessage({

                type:
                    "MEETSPACE_SESSION_RELEASE",

                token:
                    duplicateSessionToken,

                userKey:
                    lockKey

            });

        } catch (error) {}


        try {

            duplicateSessionChannel.close();

        } catch (error) {}


        duplicateSessionChannel =
            null;

    }


    duplicateSessionStarted =
        false;

}


/* =========================================================
   4. SOCKET.IO LOADING
========================================================= */

function loadSocketIO() {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            /*
            Socket.IO is already available.
            */

            if (
                typeof window.io ===
                "function"
            ) {

                console.log(
                    "Socket.IO client already available."
                );


                resolve();

                return;

            }


            /*
            Prevent duplicate script loading.
            */

            if (
                socketScriptLoading
            ) {

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
                            waitForSocket
                        );


                        if (
                            typeof window.io !==
                            "function"
                        ) {

                            socketScriptLoading =
                                false;


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


            /*
            Your meeting_room.html loads
            Flask-SocketIO's client from:

            /socket.io/socket.io.js

            If it has already loaded, use it.
            */

            const existingScript =
                document.querySelector(
                    'script[src="/socket.io/socket.io.js"]'
                );


            if (
                existingScript
            ) {

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


                        if (
                            typeof window.io ===
                            "function"
                        ) {

                            socketScriptLoading =
                                false;


                            resolve();

                        } else {

                            socketScriptLoading =
                                false;


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


            /*
            Load Flask-SocketIO client if the
            HTML did not load it.
            */

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
                                "Socket.IO loaded but io() is unavailable."
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


                    reject(
                        error ||
                        new Error(
                            "Unable to load Socket.IO client."
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
   5. CREATE SOCKET
========================================================= */

function createSocket() {

    if (
        socket
    ) {

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
   7. REGISTER SOCKET EVENTS
========================================================= */

function registerSocketEvents() {

    if (
        !socket
    ) {

        return;

    }


    if (
        socketEventsRegistered
    ) {

        return;

    }


    socketEventsRegistered =
        true;


    /* =====================================================
       SOCKET CONNECT
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
            Initialize camera and microphone.
            */

            await initializeMeeting();


            /*
            Join the meeting room only after
            Socket.IO connection is ready.
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


            showToast(
                "error",
                "Unable to connect to meeting server."
            );

        }
    );


    /* =====================================================
       RECONNECT ATTEMPT
    ===================================================== */

    if (
        socket.io
    ) {

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
                    !duplicateSessionLost &&
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


            if (
                !hasLeftMeeting
            ) {

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


            /*
            The backend sends this event after the
            current user has successfully joined.

            Therefore it also confirms the room join.
            */

            socketRoomJoined =
                true;


            updateConnectionStatus(
                "connected",
                "Connected"
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
                Some server versions may send
                the Socket.IO ID directly.
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


                if (
                    !remoteSocketId
                ) {

                    continue;

                }


                /*
                Never create a connection to ourselves.
                */

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


                /*
                IMPORTANT:

                createPeerConnection() returns the
                existing connection if one already
                exists.

                This prevents duplicate WebRTC
                connections for the same participant.
                */

                const peerConnection =
                    createPeerConnection(
                        remoteSocketId,
                        remoteName
                    );


                if (
                    !peerConnection
                ) {

                    continue;

                }


                try {

                    /*
                    Existing participant receives
                    an offer from this participant.
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


            updateParticipantsList();

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


            if (
                !remoteSocketId
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


            /*
            Create only one connection for
            this Socket.IO participant.
            */

            createPeerConnection(
                remoteSocketId,
                remoteName
            );


            updateParticipantsList();

            updateParticipantCount();

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


            if (
                !remoteSocketId
            ) {

                return;

            }


            removeRemoteParticipant(
                remoteSocketId
            );


            updateParticipantsList();

            updateParticipantCount();

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


            if (
                participantCount &&
                typeof data?.count ===
                    "number"
            ) {

                participantCount.textContent =
                    String(
                        data.count
                    );

            }


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
                data?.from ||
                data?.sid ||
                data?.socket_id;


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


            if (
                !peerConnection
            ) {

                return;

            }


            try {

                await peerConnection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            offer
                        )
                    );


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
                    remoteSocketId
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
                data?.from ||
                data?.sid ||
                data?.socket_id;


            const answer =
                data?.answer;


            if (
                !remoteSocketId ||
                !answer
            ) {

                return;

            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (
                !peerConnection
            ) {

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

            console.log(
                "ICE CANDIDATE RECEIVED:",
                data
            );


            const remoteSocketId =
                data?.sender ||
                data?.from ||
                data?.sid ||
                data?.socket_id;


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
            If the peer connection hasn't been
            created yet, queue the candidate.
            */

            if (
                !peerConnection
            ) {

                if (
                    !pendingIceCandidates[
                        remoteSocketId
                    ]
                ) {

                    pendingIceCandidates[
                        remoteSocketId
                    ] =
                        [];

                }


                pendingIceCandidates[
                    remoteSocketId
                ].push(
                    candidate
                );


                return;

            }


            try {

                if (
                    peerConnection.remoteDescription
                ) {

                    await peerConnection
                        .addIceCandidate(
                            new RTCIceCandidate(
                                candidate
                            )
                        );

                } else {

                    if (
                        !pendingIceCandidates[
                            remoteSocketId
                        ]
                    ) {

                        pendingIceCandidates[
                            remoteSocketId
                        ] =
                            [];

                    }


                    pendingIceCandidates[
                        remoteSocketId
                    ].push(
                        candidate
                    );

                }


            } catch (error) {

                console.error(
                    "ICE candidate handling failed:",
                    error
                );

            }

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


            if (
                !message
            ) {

                return;

            }


            addChatMessage(
                name,
                message
            );


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
       ROOM JOINED
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


    /* =====================================================
       JOINED ROOM
    ===================================================== */

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


    /* =====================================================
       MEETING CONNECTED
    ===================================================== */

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
   8. JOIN MEETING ROOM
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

    if (
        socketRoomJoined
    ) {

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

}


/* =========================================================
   9. INITIALIZE SOCKET
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
   10. INITIALIZE MEETING MEDIA
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


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        console.error(
            "MediaDevices API unavailable."
        );


        showToast(
            "error",
            "Camera and microphone are not supported."
        );


        mediaInitializationStarted =
            false;


        return;

    }


    try {

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
   11. LOCAL VIDEO STREAM
========================================================= */

function setLocalVideoStream(
    stream,
    showVideo = true
) {

    if (
        !localVideo
    ) {

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


        if (
            localPlaceholder
        ) {

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


        if (
            localPlaceholder
        ) {

            localPlaceholder.style.display =
                "flex";

        }

    }

}
/* =========================================================
   16. ADD PARTICIPANT TO LIST
========================================================= */

function addParticipantToList(
    name,
    status = "Connected"
) {

    if (
        !participantsList
    ) {

        return;

    }


    const safeName =
        String(
            name ||
            "Participant"
        ).trim();


    /*
    Do not create duplicate visible entries
    for the same participant name.
    */

    const existingItems =
        participantsList.querySelectorAll(
            ".participant-item"
        );


    for (
        const item of existingItems
    ) {

        const nameElement =
            item.querySelector(
                ".participant-name"
            );


        if (
            nameElement &&
            nameElement.textContent
                .trim()
                .toLowerCase() ===
                safeName
                    .toLowerCase()
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


    const avatar =
        document.createElement(
            "div"
        );


    avatar.className =
        "participant-avatar";


    avatar.textContent =
        safeName
            .charAt(0)
            .toUpperCase() ||
        "P";


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "participant-info";


    const nameElement =
        document.createElement(
            "div"
        );


    nameElement.className =
        "participant-name";


    nameElement.textContent =
        safeName;


    const statusElement =
        document.createElement(
            "div"
        );


    statusElement.className =
        "participant-status";


    statusElement.textContent =
        status;


    info.appendChild(
        nameElement
    );


    info.appendChild(
        statusElement
    );


    item.appendChild(
        avatar
    );


    item.appendChild(
        info
    );


    participantsList.appendChild(
        item
    );

}


/* =========================================================
   24. CHAT VARIABLES
========================================================= */

let unreadChatCount =
    0;


/* =========================================================
   INCREASE UNREAD CHAT COUNT
========================================================= */

function increaseUnreadChatCount() {

    unreadChatCount +=
        1;


    updateUnreadChatBadge();

}


/* =========================================================
   CLEAR UNREAD CHAT COUNT
========================================================= */

function clearUnreadChatCount() {

    unreadChatCount =
        0;


    updateUnreadChatBadge();

}


/* =========================================================
   UPDATE CHAT BADGE
========================================================= */

function updateUnreadChatBadge() {

    let badge =
        document.getElementById(
            "chatUnreadCount"
        );


    if (
        !badge &&
        chatBtn
    ) {

        badge =
            document.createElement(
                "span"
            );


        badge.id =
            "chatUnreadCount";


        badge.className =
            "chat-unread-count";


        chatBtn.appendChild(
            badge
        );

    }


    if (
        !badge
    ) {

        return;

    }


    if (
        unreadChatCount > 0
    ) {

        badge.textContent =
            unreadChatCount > 99
                ? "99+"
                : String(
                    unreadChatCount
                );


        badge.style.display =
            "inline-flex";


    } else {

        badge.textContent =
            "";


        badge.style.display =
            "none";

    }

}


/* =========================================================
   25. ADD CHAT MESSAGE
========================================================= */

function addChatMessage(
    name,
    message
) {

    if (
        !chatMessages
    ) {

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


    if (
        !cleanMessage
    ) {

        return;

    }


    const existingMessages =
        chatMessages.querySelectorAll(
            ".chat-message"
        );


    for (
        const existingMessage
            of existingMessages
    ) {

        const existingName =
            existingMessage.querySelector(
                ".chat-message-name"
            );


        const existingText =
            existingMessage.querySelector(
                ".chat-message-text"
            );


        if (
            existingName &&
            existingText &&
            existingName.textContent ===
                cleanName &&
            existingText.textContent ===
                cleanMessage
        ) {

            const previousTime =
                Number(
                    existingMessage.dataset
                        .messageTime ||
                    0
                );


            const now =
                Date.now();


            if (
                previousTime &&
                now -
                    previousTime <
                    800
            ) {

                return;

            }

        }

    }


    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        "chat-message";


    messageElement.dataset.messageTime =
        String(
            Date.now()
        );


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "chat-message-header";


    const nameElement =
        document.createElement(
            "span"
        );


    nameElement.className =
        "chat-message-name";


    nameElement.textContent =
        cleanName;


    const timeElement =
        document.createElement(
            "span"
        );


    timeElement.className =
        "chat-message-time";


    timeElement.textContent =
        new Date().toLocaleTimeString(
            [],
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );


    const textElement =
        document.createElement(
            "div"
        );


    textElement.className =
        "chat-message-text";


    textElement.textContent =
        cleanMessage;


    header.appendChild(
        nameElement
    );


    header.appendChild(
        timeElement
    );


    messageElement.appendChild(
        header
    );


    messageElement.appendChild(
        textElement
    );


    chatMessages.appendChild(
        messageElement
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}
/* =========================================================
   26. CHAT FORM SUBMIT
========================================================= */

if (
    chatForm
) {

    chatForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            if (
                hasLeftMeeting ||
                duplicateSessionLost
            ) {

                return;

            }


            const message =
                chatInput
                    ? chatInput.value.trim()
                    : "";


            if (
                !message
            ) {

                return;

            }


            if (
                !socket ||
                !socket.connected
            ) {

                showToast(
                    "error",
                    "You are not connected to the meeting."
                );


                return;

            }


            /*
            Show the message immediately for the
            sender so chat feels responsive.
            */

            addChatMessage(
                userName ||
                    "You",
                message
            );


            /*
            Send the message through Socket.IO.
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


            /*
            Clear input after successful send.
            */

            chatInput.value =
                "";


            chatInput.focus();

        }
    );

}


/* =========================================================
   27. CHAT INPUT ENTER KEY
========================================================= */

if (
    chatInput
) {

    chatInput.addEventListener(
        "keydown",
        function (event) {

            /*
            Enter sends the message.

            Shift + Enter creates a new line
            if the input element supports it.
            */

            if (
                event.key ===
                    "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                if (
                    chatForm
                ) {

                    chatForm.dispatchEvent(
                        new Event(
                            "submit",
                            {
                                bubbles:
                                    true,

                                cancelable:
                                    true
                            }
                        )
                    );

                }

            }

        }
    );

}


/* =========================================================
   28. SIDEBAR HELPERS
========================================================= */

function openSidebar(
    section = "chat"
) {

    if (
        !meetingSidebar
    ) {

        return;

    }


    meetingSidebar.classList.add(
        "open"
    );


    meetingSidebar.classList.remove(
        "closed"
    );


    /*
    Hide all sidebar sections first.
    */

    const chatSection =
        document.getElementById(
            "chatSection"
        );


    const participantsSection =
        document.getElementById(
            "participantsSection"
        );


    if (
        chatSection
    ) {

        chatSection.style.display =
            "none";

    }


    if (
        participantsSection
    ) {

        participantsSection.style.display =
            "none";

    }


    /*
    Show requested section.
    */

    if (
        section ===
            "participants"
    ) {

        if (
            participantsSection
        ) {

            participantsSection.style.display =
                "flex";

        }


        updateParticipantsList();


    } else {

        if (
            chatSection
        ) {

            chatSection.style.display =
                "flex";

        }


        clearUnreadChatCount();


        if (
            chatMessages
        ) {

            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        }

    }

}


/* =========================================================
   CLOSE SIDEBAR
========================================================= */

function closeSidebar() {

    if (
        !meetingSidebar
    ) {

        return;

    }


    meetingSidebar.classList.remove(
        "open"
    );


    meetingSidebar.classList.add(
        "closed"
    );

}


/* =========================================================
   29. CHAT SIDEBAR BUTTON
========================================================= */

function openChatSidebar(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    openSidebar(
        "chat"
    );

}


/* =========================================================
   PARTICIPANTS SIDEBAR BUTTON
========================================================= */

function openParticipantsSidebar(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    openSidebar(
        "participants"
    );

}


/* =========================================================
   SIDEBAR BUTTON EVENTS
========================================================= */

if (
    chatBtn
) {

    chatBtn.addEventListener(
        "click",
        openChatSidebar
    );

}


if (
    meetingChatBtn
) {

    meetingChatBtn.addEventListener(
        "click",
        openChatSidebar
    );

}


if (
    participantsBtn
) {

    participantsBtn.addEventListener(
        "click",
        openParticipantsSidebar
    );

}


if (
    meetingParticipantsBtn
) {

    meetingParticipantsBtn.addEventListener(
        "click",
        openParticipantsSidebar
    );

}


if (
    sidebarClose
) {

    sidebarClose.addEventListener(
        "click",
        function (event) {

            if (
                event
            ) {

                event.preventDefault();

            }


            closeSidebar();

        }
    );

}


/* =========================================================
   30. CLOSE SIDEBAR WITH ESCAPE
========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !==
                "Escape"
        ) {

            return;

        }


        if (
            meetingSidebar &&
            meetingSidebar.classList.contains(
                "open"
            )
        ) {

            closeSidebar();

        }

    }
);


/* =========================================================
   31. MICROPHONE BUTTON
========================================================= */

function updateMicrophoneButton() {

    if (
        !micBtn
    ) {

        return;

    }


    const icon =
        micBtn.querySelector(
            ".control-icon"
        );


    if (
        microphoneEnabled
    ) {

        micBtn.classList.remove(
            "off"
        );


        micBtn.classList.add(
            "active"
        );


        micBtn.title =
            "Mute microphone";


        if (
            icon
        ) {

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


        if (
            icon
        ) {

            icon.textContent =
                "🔇";

        }

    }

}


/* =========================================================
   32. TOGGLE MICROPHONE
========================================================= */

function toggleMicrophone() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    if (
        !localStream
    ) {

        showToast(
            "error",
            "Microphone is not available."
        );


        return;

    }


    const audioTracks =
        localStream.getAudioTracks();


    if (
        !audioTracks.length
    ) {

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
   33. CAMERA BUTTON
========================================================= */

function updateCameraButton() {

    if (
        !cameraBtn
    ) {

        return;

    }


    const icon =
        cameraBtn.querySelector(
            ".control-icon"
        );


    if (
        cameraEnabled
    ) {

        cameraBtn.classList.remove(
            "off"
        );


        cameraBtn.classList.add(
            "active"
        );


        cameraBtn.title =
            "Turn camera off";


        if (
            icon
        ) {

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


        if (
            icon
        ) {

            icon.textContent =
                "📷";

        }

    }

}


/* =========================================================
   34. TOGGLE CAMERA
========================================================= */

function toggleCamera() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    if (
        !localStream
    ) {

        showToast(
            "error",
            "Camera is not available."
        );


        return;

    }


    const videoTracks =
        localStream.getVideoTracks();


    if (
        !videoTracks.length
    ) {

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


    if (
        cameraEnabled
    ) {

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
   35. CAMERA / MICROPHONE EVENTS
========================================================= */

if (
    micBtn
) {

    micBtn.addEventListener(
        "click",
        toggleMicrophone
    );

}


if (
    cameraBtn
) {

    cameraBtn.addEventListener(
        "click",
        toggleCamera
    );

}
/* =========================================================
   36. SCREEN SHARE BUTTON
========================================================= */

function updateScreenShareButton(
    sharing
) {

    if (
        !screenShareBtn
    ) {

        return;

    }


    const icon =
        screenShareBtn.querySelector(
            ".control-icon"
        );


    if (
        sharing
    ) {

        screenShareBtn.classList.add(
            "active"
        );


        screenShareBtn.title =
            "Stop screen sharing";


        if (
            icon
        ) {

            icon.textContent =
                "🛑";

        }


    } else {

        screenShareBtn.classList.remove(
            "active"
        );


        screenShareBtn.title =
            "Share your screen";


        if (
            icon
        ) {

            icon.textContent =
                "🖥️";

        }

    }

}


/* =========================================================
   37. START SCREEN SHARE
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


        if (
            !screenTrack
        ) {

            showToast(
                "error",
                "Unable to get screen video."
            );


            screenStream =
                null;


            return;

        }


        /*
        Replace the camera video track in
        every existing WebRTC connection.
        */

        for (
            const remoteSocketId in
                peerConnections
        ) {

            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (
                !peerConnection
            ) {

                continue;

            }


            const senders =
                peerConnection.getSenders();


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


            if (
                videoSender
            ) {

                try {

                    await videoSender
                        .replaceTrack(
                            screenTrack
                        );


                } catch (error) {

                    console.warn(
                        "Could not replace camera track:",
                        remoteSocketId,
                        error
                    );

                }

            }

        }


        /*
        Show the shared screen in the local
        video element.
        */

        if (
            localVideo
        ) {

            localVideo.srcObject =
                screenStream;


            localVideo.style.display =
                "block";


            if (
                localPlaceholder
            ) {

                localPlaceholder.style.display =
                    "none";

            }


            localVideo.muted =
                true;


            /*
            Contain the screen so the complete
            shared screen remains visible.
            */

            localVideo.style.objectFit =
                "contain";


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
                            "Screen share playback blocked:",
                            error
                        );

                    }
                );

            }

        }


        updateScreenShareButton(
            true
        );


        showToast(
            "info",
            "Screen sharing started."
        );


        /*
        The browser fires this event when the
        user clicks "Stop sharing".
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
   38. STOP SCREEN SHARE
========================================================= */

async function stopScreenShare() {

    if (
        !screenStream
    ) {

        updateScreenShareButton(
            false
        );


        return;

    }


    console.log(
        "Stopping screen sharing..."
    );


    const screenTracks =
        screenStream.getTracks();


    screenTracks.forEach(
        function (track) {

            try {

                track.stop();

            } catch (error) {}

        }
    );


    /*
    Find the original camera video track.
    */

    let cameraTrack =
        null;


    if (
        localStream
    ) {

        const cameraTracks =
            localStream.getVideoTracks();


        if (
            cameraTracks.length &&
            cameraEnabled
        ) {

            cameraTrack =
                cameraTracks[0];

        }

    }


    /*
    Restore the camera track in every
    existing WebRTC connection.
    */

    for (
        const remoteSocketId in
            peerConnections
    ) {

        const peerConnection =
            peerConnections[
                remoteSocketId
            ];


        if (
            !peerConnection
        ) {

            continue;

        }


        const senders =
            peerConnection.getSenders();


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


        if (
            videoSender &&
            cameraTrack
        ) {

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


    screenStream =
        null;


    /*
    Restore the local camera preview.
    */

    if (
        localStream &&
        cameraEnabled
    ) {

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


    updateScreenShareButton(
        false
    );


    showToast(
        "info",
        "Screen sharing stopped."
    );

}


/* =========================================================
   39. SCREEN SHARE BUTTON EVENT
========================================================= */

if (
    screenShareBtn
) {

    screenShareBtn.addEventListener(
        "click",
        function () {

            if (
                screenStream
            ) {

                stopScreenShare();


            } else {

                startScreenShare();

            }

        }
    );

}


/* =========================================================
   40. PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    if (
        !participantCount
    ) {

        return;

    }


    /*
    Count unique active Socket.IO IDs.

    This prevents the same participant from
    being counted more than once.
    */

    const uniqueSocketIds =
        new Set();


    Object.keys(
        peerConnections
    ).forEach(
        function (remoteSocketId) {

            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (
                peerConnection &&
                peerConnection.connectionState !==
                    "closed"
            ) {

                uniqueSocketIds.add(
                    remoteSocketId
                );

            }

        }
    );


    /*
    Include the local participant.
    */

    const totalParticipants =
        uniqueSocketIds.size + 1;


    participantCount.textContent =
        String(
            totalParticipants
        );


    /*
    Update empty-state visibility.
    */

    if (
        emptyState &&
        remoteVideos
    ) {

        if (
            uniqueSocketIds.size ===
                0
        ) {

            emptyState.style.display =
                "flex";


        } else {

            emptyState.style.display =
                "none";

        }

    }

}


/* =========================================================
   41. UPDATE PARTICIPANTS LIST
========================================================= */

function updateParticipantsList() {

    if (
        !participantsList
    ) {

        return;

    }


    /*
    Rebuild the list every time.

    This prevents stale participants from
    remaining after someone leaves.
    */

    participantsList.innerHTML =
        "";


    /*
    Add local participant first.
    */

    addParticipantToList(
        userName ||
            "You",
        "You"
    );


    /*
    Track IDs already added.
    */

    const addedSocketIds =
        new Set();


    Object.keys(
        participants
    ).forEach(
        function (remoteSocketId) {

            /*
            Never add the same Socket.IO
            participant twice.
            */

            if (
                addedSocketIds.has(
                    remoteSocketId
                )
            ) {

                return;

            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            /*
            Do not show a participant whose
            connection has already closed.
            */

            if (
                !peerConnection ||
                peerConnection.connectionState ===
                    "closed"
            ) {

                return;

            }


            addedSocketIds.add(
                remoteSocketId
            );


            addParticipantToList(
                participants[
                    remoteSocketId
                ] ||
                    "Participant",
                "Connected"
            );

        }
    );

}


/* =========================================================
   42. VIDEO LAYOUT
========================================================= */

function updateVideoLayout() {

    if (
        !remoteVideos
    ) {

        return;

    }


    /*
    Count the local participant plus
    all currently rendered remote videos.
    */

    const remoteCount =
        remoteVideos.querySelectorAll(
            ".remote-video-card"
        ).length;


    const totalParticipants =
        remoteCount + 1;


    /*
    Store the count as a CSS variable so
    meeting_room.html can use it for the
    responsive grid.
    */

    remoteVideos.style.setProperty(
        "--participant-count",
        String(
            totalParticipants
        )
    );


    /*
    Keep the local video container synchronized
    with the same participant count.
    */

    if (
        localVideo
    ) {

        const localCard =
            localVideo.closest(
                ".video-card"
            );


        if (
            localCard
        ) {

            localCard.dataset.participantCount =
                String(
                    totalParticipants
                );

        }

    }


    /*
    Every participant gets the same layout
    size. The CSS grid in meeting_room.html
    handles the actual responsive dimensions.
    */

    if (
        remoteVideos.children.length ===
            0
    ) {

        if (
            emptyState
        ) {

            emptyState.style.display =
                "flex";

        }


    } else {

        if (
            emptyState
        ) {

            emptyState.style.display =
                "none";

        }

    }

}


/* =========================================================
   43. WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    function () {

        updateVideoLayout();

    }
);
/* =========================================================
   44. VIDEO CARD MAXIMIZE / MINIMIZE
========================================================= */

function setupVideoCardControls() {

    const videoCards =
        document.querySelectorAll(
            ".video-card"
        );


    videoCards.forEach(
        function (card) {

            /*
            Prevent adding the same controls
            more than once.
            */

            if (
                card.dataset.controlsInitialized ===
                    "true"
            ) {

                return;

            }


            card.dataset.controlsInitialized =
                "true";


            let maximizeButton =
                card.querySelector(
                    ".maximize-btn"
                );


            /*
            Create maximize button if the
            card doesn't already have one.
            */

            if (
                !maximizeButton
            ) {

                maximizeButton =
                    document.createElement(
                        "button"
                    );


                maximizeButton.className =
                    "maximize-btn";


                maximizeButton.type =
                    "button";


                maximizeButton.title =
                    "Maximize video";


                maximizeButton.setAttribute(
                    "aria-label",
                    "Maximize video"
                );


                maximizeButton.textContent =
                    "⛶";


                card.appendChild(
                    maximizeButton
                );

            }


            maximizeButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();


                    toggleVideoCardMaximize(
                        card
                    );

                }
            );

        }
    );

}


/* =========================================================
   45. TOGGLE VIDEO CARD MAXIMIZE
========================================================= */

function toggleVideoCardMaximize(
    card
) {

    if (
        !card
    ) {

        return;

    }


    const wasMaximized =
        card.classList.contains(
            "video-maximized"
        );


    /*
    Remove maximize state from every
    other video card first.

    This means only one participant can
    be maximized at a time.
    */

    document
        .querySelectorAll(
            ".video-card.video-maximized"
        )
        .forEach(
            function (otherCard) {

                if (
                    otherCard !== card
                ) {

                    otherCard.classList.remove(
                        "video-maximized"
                    );


                    const otherButton =
                        otherCard.querySelector(
                            ".maximize-btn"
                        );


                    if (
                        otherButton
                    ) {

                        otherButton.textContent =
                            "⛶";


                        otherButton.title =
                            "Maximize video";

                    }

                }

            }
        );


    if (
        wasMaximized
    ) {

        card.classList.remove(
            "video-maximized"
        );


    } else {

        card.classList.add(
            "video-maximized"
        );

    }


    const button =
        card.querySelector(
            ".maximize-btn"
        );


    if (
        button
    ) {

        if (
            card.classList.contains(
                "video-maximized"
            )
        ) {

            button.textContent =
                "⛶";


            button.title =
                "Minimize video";


        } else {

            button.textContent =
                "⛶";


            button.title =
                "Maximize video";

        }

    }


    updateVideoLayout();

}


/* =========================================================
   46. OBSERVE NEW REMOTE VIDEO CARDS
========================================================= */

function initializeVideoCardObserver() {

    if (
        !remoteVideos ||
        typeof MutationObserver !==
            "function"
    ) {

        setupVideoCardControls();

        return;

    }


    /*
    Setup controls for cards that already exist.
    */

    setupVideoCardControls();


    const observer =
        new MutationObserver(
            function () {

                setupVideoCardControls();

                updateVideoLayout();

            }
        );


    observer.observe(
        remoteVideos,
        {

            childList:
                true,

            subtree:
                true

        }
    );

}


/* =========================================================
   47. CREATE / UPDATE REMOTE VIDEO
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


    if (
        !container
    ) {

        container =
            document.createElement(
                "div"
            );


        /*
        IMPORTANT:

        Keep all three classes because the
        meeting_room.html CSS uses them for
        the equal participant grid and
        maximize/minimize controls.
        */

        container.className =
            "video-card remote-video-card remote-video-container";


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


        /*
        Remote participant name.
        */

        const nameLabel =
            document.createElement(
                "div"
            );


        nameLabel.className =
            "video-name";


        nameLabel.textContent =
            remoteName ||
            "Participant";


        /*
        Maximize button.

        Every participant gets their own
        maximize button.
        */

        const maximizeButton =
            document.createElement(
                "button"
            );


        maximizeButton.className =
            "maximize-btn";


        maximizeButton.type =
            "button";


        maximizeButton.title =
            "Maximize video";


        maximizeButton.setAttribute(
            "aria-label",
            "Maximize video"
        );


        maximizeButton.textContent =
            "⛶";


        maximizeButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();


                toggleVideoCardMaximize(
                    container
                );

            }
        );


        container.appendChild(
            video
        );


        container.appendChild(
            nameLabel
        );


        container.appendChild(
            maximizeButton
        );


        remoteVideos.appendChild(
            container
        );


    } else {

        video =
            container.querySelector(
                "video.remote-video"
            );


        const nameLabel =
            container.querySelector(
                ".video-name"
            );


        if (
            nameLabel
        ) {

            nameLabel.textContent =
                remoteName ||
                "Participant";

        }

    }


    if (
        !video
    ) {

        return;

    }


    /*
    Only replace srcObject when necessary.
    This prevents video flickering.
    */

    if (
        video.srcObject !==
        stream
    ) {

        video.srcObject =
            stream;

    }


    video.autoplay =
        true;


    video.playsInline =
        true;


    video.muted =
        false;


    /*
    IMPORTANT FOR PHONE CAMERAS:

    contain keeps the complete remote
    camera frame visible instead of
    aggressively cropping portrait video.
    */

    video.style.objectFit =
        "contain";


    video.style.width =
        "100%";


    video.style.height =
        "100%";


    video.style.backgroundColor =
        "#000";


    video.style.display =
        "block";


    /*
    Try to start playback.
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


    if (
        emptyState
    ) {

        emptyState.style.display =
            "none";

    }


    setupVideoCardControls();

    updateVideoLayout();

}


/* =========================================================
   48. FLUSH PENDING ICE CANDIDATES
========================================================= */

async function flushPendingIceCandidates(
    remoteSocketId
) {

    const peerConnection =
        peerConnections[
            remoteSocketId
        ];


    if (
        !peerConnection
    ) {

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
    Candidates can only be added after
    the remote description exists.
    */

    if (
        !peerConnection.remoteDescription
    ) {

        return;

    }


    while (
        queue.length
    ) {

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
   49. REMOVE REMOTE PARTICIPANT
========================================================= */

function removeRemoteParticipant(
    remoteSocketId
) {

    if (
        !remoteSocketId
    ) {

        return;

    }


    console.log(
        "Removing remote participant:",
        remoteSocketId
    );


    const peerConnection =
        peerConnections[
            remoteSocketId
        ];


    if (
        peerConnection
    ) {

        try {

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
                "Peer close error:",
                error
            );

        }


        delete peerConnections[
            remoteSocketId
        ];

    }


    delete participants[
        remoteSocketId
    ];


    delete pendingIceCandidates[
        remoteSocketId
    ];


    const remoteStream =
        remoteStreams[
            remoteSocketId
        ];


    if (
        remoteStream
    ) {

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


    const container =
        document.getElementById(
            `remote-${remoteSocketId}`
        );


    if (
        container
    ) {

        container.remove();

    }


    if (
        remoteVideos &&
        remoteVideos.children.length ===
            0 &&
        emptyState
    ) {

        emptyState.style.display =
            "flex";

    }


    updateParticipantsList();

    updateParticipantCount();

    updateVideoLayout();

}


/* =========================================================
   50. PEER CONNECTION CREATION
========================================================= */

function createPeerConnection(
    remoteSocketId,
    remoteName = "Participant"
) {

    if (
        !remoteSocketId
    ) {

        return null;

    }


    /*
    IMPORTANT:

    Never create two RTCPeerConnections for
    the same Socket.IO participant.
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
    Add local media tracks.
    */

    if (
        localStream
    ) {

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
    ICE candidate handler.
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
    Remote media handler.
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


            if (
                !remoteStream
            ) {

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


            if (
                !alreadyAdded
            ) {

                remoteStream.addTrack(
                    event.track
                );

            }


            createOrUpdateRemoteVideo(
                remoteSocketId,
                remoteName,
                remoteStream
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


    /*
    Peer connection state.
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

                updateParticipantsList();

            }


            if (
                state ===
                    "failed"
            ) {

                console.warn(
                    "Peer connection failed:",
                    remoteSocketId
                );


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
   51. CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    state,
    message
) {

    if (
        connectionStatus
    ) {

        connectionStatus.classList.remove(
            "connected",
            "connecting",
            "error",
            "disconnected"
        );


        connectionStatus.classList.add(
            state
        );

    }


    if (
        connectionText
    ) {

        connectionText.textContent =
            message ||
            "";

    }

}


/* =========================================================
   52. TOAST NOTIFICATION
========================================================= */

let toastTimeout =
    null;


function showToast(
    type,
    message
) {

    if (
        !meetingToast
    ) {

        console.log(
            `[${type}]`,
            message
        );


        return;

    }


    if (
        toastTimeout
    ) {

        clearTimeout(
            toastTimeout
        );

    }


    meetingToast.classList.remove(
        "success",
        "error",
        "info",
        "warning"
    );


    meetingToast.classList.add(
        type ||
            "info"
    );


    if (
        toastMessage
    ) {

        toastMessage.textContent =
            message ||
            "";

    }


    if (
        toastIcon
    ) {

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


        } else if (
            type ===
                "warning"
        ) {

            toastIcon.textContent =
                "⚠";


        } else {

            toastIcon.textContent =
                "ℹ";

        }

    }


    meetingToast.classList.add(
        "show"
    );


    toastTimeout =
        setTimeout(
            function () {

                meetingToast.classList.remove(
                    "show"
                );

            },
            3500
        );

}


/* =========================================================
   53. CLOSE TOAST
========================================================= */

function hideToast() {

    if (
        toastTimeout
    ) {

        clearTimeout(
            toastTimeout
        );


        toastTimeout =
            null;

    }


    if (
        meetingToast
    ) {

        meetingToast.classList.remove(
            "show"
        );

    }

}


/* =========================================================
   54. CLOSE ALL PEER CONNECTIONS
========================================================= */

function closeAllPeerConnections() {

    Object.keys(
        peerConnections
    ).forEach(
        function (remoteSocketId) {

            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (
                peerConnection
            ) {

                try {

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
                        "Peer connection close failed:",
                        error
                    );

                }

            }

        }
    );


    /*
    Clear all peer-connection state.
    */

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

            const stream =
                remoteStreams[
                    key
                ];


            if (
                stream
            ) {

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

}


/* =========================================================
   55. LEAVE MEETING
========================================================= */

function leaveMeeting() {

    if (
        hasLeftMeeting
    ) {

        return;

    }


    console.log(
        "Leaving meeting..."
    );


    hasLeftMeeting =
        true;


    socketRoomJoined =
        false;


    /*
    Stop screen sharing first.
    */

    if (
        screenStream
    ) {

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

    }


    /*
    Notify the server before disconnecting.
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
                        meetingId,

                    name:
                        userName

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
    Stop local camera and microphone.
    */

    stopLocalMedia();


    /*
    Close all WebRTC connections.
    */

    closeAllPeerConnections();


    /*
    Release duplicate-session lock.
    */

    releaseDuplicateSessionLock();


    /*
    Disconnect Socket.IO.
    */

    if (
        socket
    ) {

        try {

            socket.disconnect();

        } catch (error) {}

    }


    /*
    Redirect to the meeting home page.

    Change only if your Flask route uses
    a different leave destination.
    */

    setTimeout(
        function () {

            window.location.href =
                "/";

        },
        100
    );

}


/* =========================================================
   56. LEAVE BUTTON EVENTS
========================================================= */

if (
    leaveMeetingBtn
) {

    leaveMeetingBtn.addEventListener(
        "click",
        function (event) {

            if (
                event
            ) {

                event.preventDefault();

            }


            leaveMeeting();

        }
    );

}


if (
    leaveMeetingBtn2
) {

    leaveMeetingBtn2.addEventListener(
        "click",
        function (event) {

            if (
                event
            ) {

                event.preventDefault();

            }


            leaveMeeting();

        }
    );

}


/* =========================================================
   57. BEFORE UNLOAD CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        /*
        Do not perform a redirect here.
        Only clean up resources.
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
                            meetingId,

                        name:
                            userName

                    }
                );

            } catch (error) {}

        }


        stopLocalMedia();

        closeAllPeerConnections();

        releaseDuplicateSessionLock();

    }
);


/* =========================================================
   58. PAGE HIDDEN CLEANUP
========================================================= */

document.addEventListener(
    "visibilitychange",
    function () {

        /*
        Do NOT leave the meeting merely because
        the page becomes hidden.

        Users may switch tabs or minimize the
        browser while remaining in the meeting.
        */

        if (
            document.visibilityState ===
                "visible"
        ) {

            updateVideoLayout();

            updateParticipantsList();

        }

    }
);


/* =========================================================
   59. PAGE LOAD INITIALIZATION
========================================================= */

async function initializeMeetSpaceClient() {

    if (
        meetingInitialized
    ) {

        return;

    }


    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    meetingInitialized =
        true;


    console.log(
        "Initializing MeetSpace client..."
    );


    /*
    Validate meeting ID.
    */

    if (
        !meetingId
    ) {

        console.error(
            "Meeting ID is missing."
        );


        updateConnectionStatus(
            "error",
            "Meeting ID missing"
        );


        showToast(
            "error",
            "Unable to open meeting. Meeting ID is missing."
        );


        return;

    }


    /*
    Start duplicate-session protection.
    */

    initializeDuplicateSessionProtection();


    if (
        duplicateSessionLost
    ) {

        return;

    }


    /*
    Initialize UI immediately.
    */

    updateMicrophoneButton();

    updateCameraButton();

    updateScreenShareButton(
        false
    );

    updateParticipantCount();

    updateParticipantsList();

    updateVideoLayout();


    /*
    Initialize video-card controls.
    */

    initializeVideoCardObserver();


    /*
    Start Socket.IO.
    */

    updateConnectionStatus(
        "connecting",
        "Connecting..."
    );


    await initializeSocket();


    if (
        duplicateSessionLost ||
        hasLeftMeeting
    ) {

        return;

    }


    console.log(
        "MeetSpace client initialized."
    );

}


/* =========================================================
   60. DOM READY
========================================================= */

if (
    document.readyState ===
        "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            initializeMeetSpaceClient();

        },
        {
            once:
                true
        }
    );


} else {

    initializeMeetSpaceClient();

}


/* =========================================================
   61. GLOBAL PAGE ERROR HANDLER
========================================================= */

window.addEventListener(
    "error",
    function (event) {

        console.error(
            "MeetSpace page error:",
            event.error ||
                event.message
        );

    }
);


/* =========================================================
   62. GLOBAL PROMISE ERROR HANDLER
========================================================= */

window.addEventListener(
    "unhandledrejection",
    function (event) {

        console.error(
            "MeetSpace unhandled promise rejection:",
            event.reason
        );

    }
);


/* =========================================================
   63. FINAL STATUS
========================================================= */

console.log(
    "MeetSpace meeting.js loaded successfully."
);
