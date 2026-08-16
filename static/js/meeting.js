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
   LOCAL MEDIA CLEANUP
========================================================= */

function stopLocalMedia() {

    if (screenStream) {

        screenStream
            .getTracks()
            .forEach(function (track) {

                try {

                    track.stop();

                } catch (error) {

                    console.warn(
                        "Could not stop screen track:",
                        error
                    );

                }

            });

        screenStream =
            null;

    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(function (track) {

                try {

                    track.stop();

                } catch (error) {

                    console.warn(
                        "Could not stop local track:",
                        error
                    );

                }

            });

        localStream =
            null;

    }


    microphoneEnabled =
        false;


    cameraEnabled =
        false;


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


    updateMicrophoneButton();

    updateCameraButton();

    updateScreenShareButton(
        false
    );

}
/* =========================================================
   5. SOCKET.IO SCRIPT LOADING
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
   6. CREATE SOCKET
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


            /*
            The server broadcasts the message back
            to everyone in the meeting.

            We add it here only once.

            This prevents the sender from seeing
            a duplicate chat message.
            */

            addChatMessage(
                name,
                message
            );


            /*
            If chat is closed, update unread count.
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
   12. CREATE WEBRTC PEER CONNECTION
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
    IMPORTANT DUPLICATE CONNECTION PROTECTION:

    If a connection already exists for this
    Socket.IO participant, return the existing
    connection.

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
   13. CREATE / UPDATE REMOTE VIDEO
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


    if (!video) {

        return;
    }


    /*
    Only replace srcObject when necessary.
    This prevents unnecessary video
    element resets and flickering.
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
    IMPORTANT:

    contain prevents the remote camera from
    being automatically cropped/zoomed.

    This is especially useful when participants
    have different camera aspect ratios.
    */

    video.style.objectFit =
        "contain";


    video.style.width =
        "100%";


    video.style.height =
        "100%";


    video.style.backgroundColor =
        "#000";


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


    if (
        emptyState
    ) {

        emptyState.style.display =
            "none";

    }


    updateVideoLayout();

}


/* =========================================================
   14. FLUSH PENDING ICE CANDIDATES
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
   15. REMOVE REMOTE PARTICIPANT
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


    /*
    Close WebRTC connection.
    */

    const peerConnection =
        peerConnections[
            remoteSocketId
        ];


    if (
        peerConnection
    ) {

        try {

            /*
            Remove event handlers first.

            This prevents cleanup events from
            triggering additional unwanted
            participant updates.
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


    /*
    Remove the remote video card.
    */

    const container =
        document.getElementById(
            `remote-${remoteSocketId}`
        );


    if (
        container
    ) {

        container.remove();

    }


    /*
    Show empty state when no remote
    participants remain.
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


    updateParticipantsList();

    updateParticipantCount();

    updateVideoLayout();

}


/* =========================================================
   16. MICROPHONE BUTTON
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
   17. TOGGLE MICROPHONE
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
   18. CAMERA BUTTON
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
   19. TOGGLE CAMERA
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


    /*
    Keep local preview synchronized.
    */

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
   20. CAMERA / MICROPHONE BUTTON EVENTS
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
   21. SCREEN SHARE BUTTON
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
   START SCREEN SHARE
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
        Replace camera video track in every
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
        Show shared screen locally.
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
        Browser fires onended when the user
        presses "Stop sharing".
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
   STOP SCREEN SHARE
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
    Restore camera track.
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
    Replace screen track with camera track.
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
    Restore local camera preview.
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
   SCREEN SHARE BUTTON EVENT
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
   22. PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    if (
        !participantCount
    ) {

        return;
    }


    /*
    Count unique active Socket.IO IDs.

    This is important because the same person must
    never increase the count more than once.
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
    Include the current/local participant.
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
   23. UPDATE PARTICIPANTS LIST
========================================================= */

function updateParticipantsList() {

    if (
        !participantsList
    ) {

        return;
    }


    /*
    Always rebuild the list.

    This prevents old participant entries from
    remaining after someone leaves or reconnects.
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
    Keep track of Socket.IO IDs already added.
    */

    const addedSocketIds =
        new Set();


    Object.keys(
        participants
    ).forEach(
        function (remoteSocketId) {

            /*
            Never add the same Socket.IO ID twice.
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
            Do not show a participant if the
            WebRTC connection has already closed.
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
   ADD PARTICIPANT TO LIST
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
    Do not create a second visible entry
    for the same displayed participant name.

    Socket.IO ID remains the real identity,
    while this is an additional UI safeguard.
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


    /*
    Use textContent instead of innerHTML.

    This prevents HTML from being injected
    through a participant name.
    */

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

    /*
    Try the existing unread badge first.
    */

    let badge =
        document.getElementById(
            "chatUnreadCount"
        );


    /*
    If your HTML doesn't already contain one,
    create it on the chat button.
    */

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


    /*
    Duplicate-message protection.

    The server normally broadcasts each message once,
    but this extra check prevents accidental duplicate
    rendering if the same Socket.IO event arrives twice.
    */

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

            /*
            Do not blindly reject identical messages
            because two separate messages can technically
            have the same text.

            Only reject when they were added within
            a very short time window.
            */

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


    /*
    textContent is intentionally used here.

    A user can send arbitrary chat text without
    injecting HTML/JavaScript into the page.
    */

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


    /*
    Keep the newest message visible.
    */

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


/* =========================================================
   26. SEND CHAT MESSAGE
========================================================= */

function sendChatMessage(
    message
) {

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


    if (
        !socketRoomJoined
    ) {

        showToast(
            "error",
            "You are not connected to the meeting yet."
        );


        return;

    }


    /*
    IMPORTANT:

    Do NOT call addChatMessage() here.

    The server broadcasts the message back through
    the "chat-message" event. That event adds it
    to the UI exactly once.

    This prevents the sender from seeing the same
    message twice.
    */

    socket.emit(
        "chat-message",
        {

            meeting_id:
                meetingId,

            message:
                cleanMessage,

            name:
                userName

        }
    );


    /*
    Clear the input after sending.
    */

    if (
        chatInput
    ) {

        chatInput.value =
            "";

    }

}


/* =========================================================
   27. CHAT FORM
========================================================= */

if (
    chatForm
) {

    chatForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            if (
                !chatInput
            ) {

                return;

            }


            const message =
                chatInput.value.trim();


            if (
                !message
            ) {

                return;

            }


            sendChatMessage(
                message
            );

        }
    );

}


/* =========================================================
   28. CHAT INPUT ENTER KEY
========================================================= */

if (
    chatInput
) {

    chatInput.addEventListener(
        "keydown",
        function (event) {

            /*
            Enter sends the message.

            Shift + Enter creates a new line.
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

                    chatForm.requestSubmit();

                }

            }

        }
    );

}


/* =========================================================
   29. SIDEBAR
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


    /*
    Show requested section.
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
            section === "chat"
                ? "flex"
                : "none";

    }


    if (
        participantsSection
    ) {

        participantsSection.style.display =
            section === "participants"
                ? "flex"
                : "none";

    }


    /*
    Clear unread chat count when
    opening the chat panel.
    */

    if (
        section ===
        "chat"
    ) {

        clearUnreadChatCount();


        if (
            chatInput
        ) {

            setTimeout(
                function () {

                    chatInput.focus();

                },
                100
            );

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

}
/* =========================================================
   CHAT BUTTON
========================================================= */

if (
    chatBtn
) {

    chatBtn.addEventListener(
        "click",
        function () {

            openSidebar(
                "chat"
            );

        }
    );

}


if (
    meetingChatBtn
) {

    meetingChatBtn.addEventListener(
        "click",
        function () {

            openSidebar(
                "chat"
            );

        }
    );

}


/* =========================================================
   PARTICIPANTS BUTTON
========================================================= */

if (
    participantsBtn
) {

    participantsBtn.addEventListener(
        "click",
        function () {

            updateParticipantsList();


            openSidebar(
                "participants"
            );

        }
    );

}


if (
    meetingParticipantsBtn
) {

    meetingParticipantsBtn.addEventListener(
        "click",
        function () {

            updateParticipantsList();


            openSidebar(
                "participants"
            );

        }
    );

}


/* =========================================================
   SIDEBAR CLOSE BUTTON
========================================================= */

if (
    sidebarClose
) {

    sidebarClose.addEventListener(
        "click",
        closeSidebar
    );

}


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key ===
            "Escape"
        ) {

            closeSidebar();

        }

    }
);


/* =========================================================
   30. LEAVE MEETING
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


    /*
    Release duplicate-session lock.
    */

    releaseDuplicateSessionLock();


    /*
    Tell the server that this user is leaving.
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
                        meetingId,

                    name:
                        userName

                }
            );


        } catch (error) {

            console.warn(
                "Could not send leave event:",
                error
            );

        }

    }


    /*
    Stop camera, microphone and screen sharing.
    */

    stopLocalMedia();


    /*
    Close all WebRTC connections.
    */

    closeAllPeerConnections();


    /*
    Disconnect Socket.IO.
    */

    if (
        socket
    ) {

        try {

            socket.disconnect();

        } catch (error) {

            console.warn(
                "Socket disconnect error:",
                error
            );

        }

    }


    socketRoomJoined =
        false;


    updateConnectionStatus(
        "disconnected",
        "You left the meeting"
    );


    /*
    Redirect after cleanup.
    */

    setTimeout(
        function () {

            window.location.href =
                "/";

        },
        300
    );

}


/* =========================================================
   31. LEAVE BUTTON EVENTS
========================================================= */

if (
    leaveMeetingBtn
) {

    leaveMeetingBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

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

            event.preventDefault();

            leaveMeeting();

        }
    );

}


/* =========================================================
   32. TOAST MESSAGE
========================================================= */

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
        toastMessage
    ) {

        toastMessage.textContent =
            String(
                message ||
                ""
            );

    }


    if (
        toastIcon
    ) {

        if (
            type ===
            "error"
        ) {

            toastIcon.textContent =
                "⚠️";


        } else if (
            type ===
            "success"
        ) {

            toastIcon.textContent =
                "✓";


        } else {

            toastIcon.textContent =
                "ℹ️";

        }

    }


    meetingToast.classList.remove(
        "error",
        "success",
        "info",
        "show"
    );


    meetingToast.classList.add(
        type ||
        "info"
    );


    /*
    Force reflow so repeated toast
    messages animate correctly.
    */

    void meetingToast.offsetWidth;


    meetingToast.classList.add(
        "show"
    );


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
   33. CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    status,
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
            status
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
   34. RESIZE / VIDEO LAYOUT
========================================================= */

function updateVideoLayout() {

    if (
        !remoteVideos
    ) {

        return;

    }


    const videoCards =
        remoteVideos.querySelectorAll(
            ".remote-video-container"
        );


    /*
    Keep the layout responsive.

    Do not change the actual camera stream.
    */

    videoCards.forEach(
        function (container) {

            const video =
                container.querySelector(
                    "video.remote-video"
                );


            if (
                !video
            ) {

                return;

            }


            /*
            IMPORTANT:

            contain prevents the participant's
            camera image from being cropped.

            This fixes the automatic zoom/cropping
            problem seen in the meeting room.
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

        }
    );

}


/* =========================================================
   WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    function () {

        updateVideoLayout();

    }
);


/* =========================================================
   OBSERVE REMOTE VIDEO CHANGES
========================================================= */

if (
    remoteVideos
) {

    const videoObserver =
        new MutationObserver(
            function () {

                updateVideoLayout();

            }
        );


    videoObserver.observe(
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
   35. CLOSE ALL PEER CONNECTIONS
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


            if (
                !peerConnection
            ) {

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
                remoteSocketId
            ];

        }
    );


    /*
    Remove remote video cards.
    */

    if (
        remoteVideos
    ) {

        remoteVideos.innerHTML =
            "";

    }


    if (
        emptyState
    ) {

        emptyState.style.display =
            "flex";

    }


    updateParticipantCount();

}


/* =========================================================
   36. MEETING INITIALIZATION
========================================================= */

async function startMeetingApplication() {

    if (
        meetingInitialized
    ) {

        return;

    }


    if (
        !meetingId
    ) {

        console.error(
            "MeetSpace: Meeting ID is missing."
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


    meetingInitialized =
        true;


    console.log(
        "================================="
    );


    console.log(
        "STARTING MEETSPACE MEETING"
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
    Start duplicate-session protection
    before connecting to the meeting.
    */

    initializeDuplicateSessionProtection();


    if (
        duplicateSessionLost
    ) {

        return;

    }


    /*
    Start Socket.IO.

    initializeSocket() will:

    1. Load Socket.IO
    2. Create connection
    3. Register events
    4. Initialize camera/microphone
    5. Join the meeting room
    */

    await initializeSocket();


    updateParticipantsList();

    updateParticipantCount();

    updateVideoLayout();

}


/* =========================================================
   37. START APPLICATION
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            startMeetingApplication();

        }
    );


} else {

    startMeetingApplication();

}


/* =========================================================
   38. PAGE CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        /*
        Don't emit unnecessary Socket.IO events
        during a duplicate-session shutdown.
        */

        if (
            !hasLeftMeeting
        ) {

            hasLeftMeeting =
                true;

        }


        releaseDuplicateSessionLock();


        /*
        Stop local media immediately.
        */

        stopLocalMedia();


        /*
        Close WebRTC connections.
        */

        closeAllPeerConnections();


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

    }
);