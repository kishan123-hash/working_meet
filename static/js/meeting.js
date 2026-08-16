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


        /*
        FIX:
        Make dynamically-created remote participants
        behave exactly like the local video card.

        This allows the existing maximize/minimize
        system in meeting_room.html to recognize them.
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