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
- Duplicate session protection
- Video maximize/minimize
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


/* ---------------------------------------------------------
   VIDEO ELEMENTS
--------------------------------------------------------- */

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


/* ---------------------------------------------------------
   BUTTONS
--------------------------------------------------------- */

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


/* ---------------------------------------------------------
   CONNECTION STATUS
--------------------------------------------------------- */

const connectionStatus =
    document.getElementById(
        "connectionStatus"
    );


const connectionText =
    document.getElementById(
        "connectionText"
    );


/* ---------------------------------------------------------
   PARTICIPANTS
--------------------------------------------------------- */

const participantCount =
    document.getElementById(
        "participantCount"
    );


const participantsList =
    document.getElementById(
        "participantsList"
    );


/* ---------------------------------------------------------
   CHAT
--------------------------------------------------------- */

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


/* ---------------------------------------------------------
   SIDEBAR
--------------------------------------------------------- */

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


/* ---------------------------------------------------------
   TOAST
--------------------------------------------------------- */

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


/*
One local MediaStream.
*/
let localStream =
    null;


/*
Screen sharing MediaStream.
*/
let screenStream =
    null;


/*
Socket.IO connection.
*/
let socket =
    null;


/*
One RTCPeerConnection for every
remote Socket.IO participant.
*/
const peerConnections =
    {};


/*
Remote participant names.

Example:

participants["abc123"] = "Kishan";
*/
const participants =
    {};


/*
ICE candidates received before
the remote description is available.
*/
const pendingIceCandidates =
    {};


/*
Remote MediaStreams.

Example:

remoteStreams["abc123"] = MediaStream;
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
   INITIALIZATION STATE
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
   CHAT STATE
========================================================= */

let unreadChatCount =
    0;


let toastTimeout =
    null;


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


/* =========================================================
   WEBRTC CONFIGURATION
========================================================= */

const rtcConfiguration = {

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

};


/* =========================================================
   4. CONNECTION STATUS
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


        if (status) {

            connectionStatus.classList.add(
                status
            );

        }

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
   5. TOAST
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
        toastTimeout
    ) {

        clearTimeout(
            toastTimeout
        );

        toastTimeout =
            null;

    }


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
            "error"
        ) {

            toastIcon.textContent =
                "⚠️";

        } else if (
            type ===
            "success"
        ) {

            toastIcon.textContent =
                "✅";

        } else {

            toastIcon.textContent =
                "ℹ️";

        }

    }


    meetingToast.classList.remove(
        "error",
        "success",
        "info"
    );


    meetingToast.classList.add(
        type ||
            "info"
    );


    meetingToast.classList.add(
        "show"
    );


    toastTimeout =
        setTimeout(
            function () {

                hideToast();

            },
            3000
        );

}


/* =========================================================
   6. HIDE TOAST
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
   7. DUPLICATE SESSION KEY
========================================================= */

function getDuplicateSessionKey() {

    if (
        !meetingId
    ) {

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
        "meetspace-active-session:" +
        `${meetingId}:` +
        `${safeUserName}`
    );

}


/* =========================================================
   8. FORCE CLOSE DUPLICATE SESSION
========================================================= */

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

        if (
            lockKey
        ) {

            const currentLock =
                JSON.parse(
                    localStorage.getItem(
                        lockKey
                    ) ||
                    "null"
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

    } catch (error) {

        console.warn(
            "Could not release duplicate session lock:",
            error
        );

    }


    if (
        duplicateSessionChannel
    ) {

        try {

            duplicateSessionChannel.close();

        } catch (error) {}

        duplicateSessionChannel =
            null;

    }


    stopLocalMedia();


    closeAllPeerConnections();


    if (
        socket
    ) {

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


/* =========================================================
   9. INITIALIZE DUPLICATE SESSION PROTECTION
========================================================= */

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


    if (
        !lockKey
    ) {

        return;

    }


    /*
    BroadcastChannel gives fast communication
    between tabs of the same browser.
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
                        event?.data ||
                        {};


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
        Detect another tab taking the lock.
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
        Refresh lock every 2 seconds.
        */

        duplicateSessionHeartbeat =
            setInterval(
                function () {

                    try {

                        const currentLock =
                            JSON.parse(
                                localStorage.getItem(
                                    lockKey
                                ) ||
                                "null"
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
   10. RELEASE DUPLICATE SESSION LOCK
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


    if (
        lockKey
    ) {

        try {

            const currentLock =
                JSON.parse(
                    localStorage.getItem(
                        lockKey
                    ) ||
                    "null"
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
   11. LOAD SOCKET.IO
========================================================= */

function loadSocketIO() {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            /*
            Socket.IO already loaded.
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
            Another load is already running.
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
            Check whether the HTML already
            contains the Socket.IO script.
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
            Dynamically load Flask-SocketIO client.
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
                        "Flask Socket.IO client failed to load.",
                        error
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
   12. CREATE SOCKET
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
   13. JOIN MEETING ROOM
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
   14. INITIALIZE SOCKET
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
   15. INITIALIZE MEETING MEDIA
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
            localStream
                .getAudioTracks()
                .length >
            0;


        cameraEnabled =
            localStream
                .getVideoTracks()
                .length >
            0;


        setLocalVideoStream(
            localStream,
            cameraEnabled
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


        /*
        If camera fails, try microphone only.
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
   16. LOCAL VIDEO STREAM
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
        stream ||
        null;


    localVideo.muted =
        true;


    localVideo.playsInline =
        true;


    localVideo.autoplay =
        true;


    if (
        stream &&
        showVideo
    ) {

        localVideo.style.display =
            "block";


        localVideo.style.objectFit =
            "cover";


        if (
            localPlaceholder
        ) {

            localPlaceholder.style.display =
                "none";

        }


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
   END OF PART 1
========================================================= */

/* =========================================================
   17. CREATE WEBRTC PEER CONNECTION
========================================================= */

function createPeerConnection(
    remoteSocketId,
    remoteName = "Participant"
) {

    if (
        !remoteSocketId ||
        !socket
    ) {

        return null;

    }


    /*
    Never connect to ourselves.
    */

    if (
        remoteSocketId ===
        socket.id
    ) {

        return null;

    }


    /*
    Return the existing connection.

    This is VERY important.

    Without this protection, the same participant
    can accidentally get multiple RTCPeerConnections.
    */

    if (
        peerConnections[
            remoteSocketId
        ]
    ) {

        participants[
            remoteSocketId
        ] =
            remoteName ||
            participants[
                remoteSocketId
            ] ||
            "Participant";


        return peerConnections[
            remoteSocketId
        ];

    }


    console.log(
        "Creating WebRTC connection:",
        remoteName,
        remoteSocketId
    );


    participants[
        remoteSocketId
    ] =
        remoteName ||
        "Participant";


    /*
    Create a new WebRTC peer connection.
    */

    let peerConnection;

    try {

        peerConnection =
            new RTCPeerConnection(
                rtcConfiguration
            );

    } catch (error) {

        console.error(
            "RTCPeerConnection creation failed:",
            error
        );


        return null;

    }


    peerConnections[
        remoteSocketId
    ] =
        peerConnection;


    /*
    Make sure ICE queue exists.
    */

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


    /*
    Add our local audio/video tracks.

    Screen sharing later replaces only
    the video sender track.
    */

    if (
        localStream
    ) {

        const localTracks =
            localStream.getTracks();


        localTracks.forEach(
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
    ---------------------------------------------------------
    ICE CANDIDATE
    ---------------------------------------------------------

    Send every ICE candidate through Socket.IO.
    */

    peerConnection.onicecandidate =
        function (event) {

            if (
                !event.candidate
            ) {

                return;

            }


            if (
                !socket ||
                !socket.connected
            ) {

                return;

            }


            try {

                socket.emit(
                    "ice-candidate",
                    {

                        target:
                            remoteSocketId,

                        candidate:
                            event.candidate,

                        name:
                            userName

                    }
                );


            } catch (error) {

                console.error(
                    "Failed to send ICE candidate:",
                    error
                );

            }

        };


    /*
    ---------------------------------------------------------
    REMOTE TRACK
    ---------------------------------------------------------

    This receives the remote participant's
    camera, microphone or screen.
    */

    peerConnection.ontrack =
        function (event) {

            console.log(
                "REMOTE TRACK RECEIVED:",
                remoteSocketId,
                event.track?.kind
            );


            if (
                !event.streams ||
                !event.streams.length
            ) {

                console.warn(
                    "Remote track has no MediaStream."
                );


                return;

            }


            const remoteStream =
                event.streams[0];


            remoteStreams[
                remoteSocketId
            ] =
                remoteStream;


            createOrUpdateRemoteVideo(
                remoteSocketId,
                remoteName,
                remoteStream
            );


            updateParticipantCount();

            updateParticipantsList();

        };


    /*
    ---------------------------------------------------------
    CONNECTION STATE
    ---------------------------------------------------------
    */

    peerConnection.onconnectionstatechange =
        function () {

            const state =
                peerConnection.connectionState;


            console.log(
                "WebRTC connection state:",
                remoteSocketId,
                state
            );


            if (
                state ===
                "connected"
            ) {

                updateRemoteVideoStatus(
                    remoteSocketId,
                    "Connected"
                );


            } else if (
                state ===
                    "connecting"
            ) {

                updateRemoteVideoStatus(
                    remoteSocketId,
                    "Connecting..."
                );


            } else if (
                state ===
                    "disconnected"
            ) {

                updateRemoteVideoStatus(
                    remoteSocketId,
                    "Disconnected"
                );


                /*
                Do not immediately destroy the connection.

                Browser/network interruptions can recover.
                */

                setTimeout(
                    function () {

                        const currentConnection =
                            peerConnections[
                                remoteSocketId
                            ];


                        if (
                            currentConnection &&
                            currentConnection.connectionState ===
                                "disconnected"
                        ) {

                            removeRemoteParticipant(
                                remoteSocketId
                            );

                        }

                    },
                    5000
                );


            } else if (
                state ===
                    "failed"
            ) {

                console.warn(
                    "WebRTC connection failed:",
                    remoteSocketId
                );


                /*
                Try an ICE restart.
                */

                attemptIceRestart(
                    remoteSocketId
                );


            } else if (
                state ===
                    "closed"
            ) {

                removeRemoteParticipant(
                    remoteSocketId
                );

            }

        };


    /*
    ---------------------------------------------------------
    ICE CONNECTION STATE
    ---------------------------------------------------------
    */

    peerConnection.oniceconnectionstatechange =
        function () {

            const state =
                peerConnection.iceConnectionState;


            console.log(
                "ICE connection state:",
                remoteSocketId,
                state
            );


            if (
                state ===
                    "failed"
            ) {

                attemptIceRestart(
                    remoteSocketId
                );

            }

        };


    /*
    ---------------------------------------------------------
    NEGOTIATION NEEDED
    ---------------------------------------------------------
    */

    peerConnection.onnegotiationneeded =
        function () {

            /*
            We normally create offers explicitly
            when participants join.

            Therefore do not automatically create
            another offer here.

            This prevents offer collisions.
            */

            console.log(
                "WebRTC negotiation needed:",
                remoteSocketId
            );

        };


    return peerConnection;

}


/* =========================================================
   18. FLUSH PENDING ICE CANDIDATES
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


    if (
        !peerConnection.remoteDescription
    ) {

        return;

    }


    const candidates =
        pendingIceCandidates[
            remoteSocketId
        ] ||
        [];


    if (
        !candidates.length
    ) {

        return;

    }


    /*
    Copy the array before clearing it.
    */

    pendingIceCandidates[
        remoteSocketId
    ] =
        [];


    for (
        const candidate
            of candidates
    ) {

        try {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

        } catch (error) {

            console.warn(
                "Could not add queued ICE candidate:",
                error
            );

        }

    }

}


/* =========================================================
   19. CREATE REMOTE VIDEO
========================================================= */

function createOrUpdateRemoteVideo(
    remoteSocketId,
    remoteName,
    stream
) {

    if (
        !remoteVideos ||
        !stream
    ) {

        return;

    }


    /*
    Look for an existing remote tile.
    */

    let tile =
        document.querySelector(
            `[data-remote-id="${CSS.escape(
                remoteSocketId
            )}"]`
        );


    /*
    If tile does not exist, create it.
    */

    if (
        !tile
    ) {

        tile =
            document.createElement(
                "div"
            );


        tile.className =
            "remote-video-container";


        tile.dataset.remoteId =
            remoteSocketId;


        /*
        -----------------------------------------------------
        VIDEO
        -----------------------------------------------------
        */

        const video =
            document.createElement(
                "video"
            );


        video.className =
            "remote-video";


        video.autoplay =
            true;


        video.playsInline =
            true;


        video.controls =
            false;


        video.muted =
            false;


        video.dataset.remoteId =
            remoteSocketId;


        /*
        -----------------------------------------------------
        PLACEHOLDER
        -----------------------------------------------------
        */

        const placeholder =
            document.createElement(
                "div"
            );


        placeholder.className =
            "remote-video-placeholder";


        placeholder.dataset.remotePlaceholder =
            remoteSocketId;


        /*
        Avatar
        */

        const avatar =
            document.createElement(
                "div"
            );


        avatar.className =
            "remote-avatar";


        avatar.textContent =
            String(
                remoteName ||
                "Participant"
            )
                .charAt(0)
                .toUpperCase();


        /*
        Name
        */

        const placeholderName =
            document.createElement(
                "div"
            );


        placeholderName.className =
            "remote-placeholder-name";


        placeholderName.textContent =
            remoteName ||
            "Participant";


        placeholder.appendChild(
            avatar
        );


        placeholder.appendChild(
            placeholderName
        );


        /*
        -----------------------------------------------------
        NAME LABEL
        -----------------------------------------------------
        */

        const nameLabel =
            document.createElement(
                "div"
            );


        nameLabel.className =
            "remote-name-label";


        nameLabel.textContent =
            remoteName ||
            "Participant";


        /*
        -----------------------------------------------------
        CONNECTION STATUS
        -----------------------------------------------------
        */

        const statusLabel =
            document.createElement(
                "div"
            );


        statusLabel.className =
            "remote-status-label";


        statusLabel.dataset.remoteStatus =
            remoteSocketId;


        statusLabel.textContent =
            "Connecting...";


        /*
        -----------------------------------------------------
        MAXIMIZE BUTTON
        -----------------------------------------------------
        */

        const maximizeButton =
            document.createElement(
                "button"
            );


        maximizeButton.type =
            "button";


        maximizeButton.className =
            "remote-maximize-btn";


        maximizeButton.title =
            "Maximize video";


        maximizeButton.textContent =
            "⛶";


        maximizeButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();


                maximizeVideoTile(
                    tile
                );

            }
        );


        /*
        -----------------------------------------------------
        MINIMIZE BUTTON
        -----------------------------------------------------
        */

        const minimizeButton =
            document.createElement(
                "button"
            );


        minimizeButton.type =
            "button";


        minimizeButton.className =
            "remote-minimize-btn";


        minimizeButton.title =
            "Minimize video";


        minimizeButton.textContent =
            "−";


        minimizeButton.style.display =
            "none";


        minimizeButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();


                minimizeVideoTile(
                    tile
                );

            }
        );


        /*
        -----------------------------------------------------
        APPEND EVERYTHING
        -----------------------------------------------------
        */

        tile.appendChild(
            video
        );


        tile.appendChild(
            placeholder
        );


        tile.appendChild(
            nameLabel
        );


        tile.appendChild(
            statusLabel
        );


        tile.appendChild(
            maximizeButton
        );


        tile.appendChild(
            minimizeButton
        );


        remoteVideos.appendChild(
            tile
        );


        /*
        Make sure empty state disappears.
        */

        updateEmptyState();


        /*
        Attach stream.
        */

        video.srcObject =
            stream;


        video.muted =
            false;


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

    } else {

        /*
        Existing tile.

        Find the video and update its stream.
        */

        const video =
            tile.querySelector(
                ".remote-video"
            );


        if (
            video
        ) {

            if (
                video.srcObject !==
                stream
            ) {

                video.srcObject =
                    stream;

            }


            video.muted =
                false;


            const playPromise =
                video.play();


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


        /*
        Update displayed name.
        */

        const nameLabel =
            tile.querySelector(
                ".remote-name-label"
            );


        if (
            nameLabel
        ) {

            nameLabel.textContent =
                remoteName ||
                "Participant";

        }


        const placeholderName =
            tile.querySelector(
                ".remote-placeholder-name"
            );


        if (
            placeholderName
        ) {

            placeholderName.textContent =
                remoteName ||
                "Participant";

        }

    }


    /*
    If a real video stream exists,
    hide the placeholder.
    */

    updateRemotePlaceholder(
        remoteSocketId,
        stream
    );


    updateRemoteVideoStatus(
        remoteSocketId,
        "Connected"
    );

}


/* =========================================================
   20. UPDATE REMOTE PLACEHOLDER
========================================================= */

function updateRemotePlaceholder(
    remoteSocketId,
    stream
) {

    const tile =
        document.querySelector(
            `[data-remote-id="${CSS.escape(
                remoteSocketId
            )}"]`
        );


    if (
        !tile
    ) {

        return;

    }


    const video =
        tile.querySelector(
            ".remote-video"
        );


    const placeholder =
        tile.querySelector(
            ".remote-video-placeholder"
        );


    if (
        !video ||
        !placeholder
    ) {

        return;

    }


    const hasVideo =
        stream &&
        stream.getVideoTracks()
            .some(
                function (track) {

                    return (
                        track.readyState !==
                        "ended"
                    );

                }
            );


    if (
        hasVideo
    ) {

        video.style.display =
            "block";


        placeholder.style.display =
            "none";

    } else {

        video.style.display =
            "none";


        placeholder.style.display =
            "flex";

    }

}


/* =========================================================
   21. UPDATE REMOTE VIDEO STATUS
========================================================= */

function updateRemoteVideoStatus(
    remoteSocketId,
    status
) {

    const statusElement =
        document.querySelector(
            `[data-remote-status="${CSS.escape(
                remoteSocketId
            )}"]`
        );


    if (
        statusElement
    ) {

        statusElement.textContent =
            status ||
            "";

    }

}


/* =========================================================
   22. REMOVE REMOTE PARTICIPANT
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
                "Error closing peer connection:",
                error
            );

        }


        delete peerConnections[
            remoteSocketId
        ];

    }


    /*
    Remove queued ICE candidates.
    */

    delete pendingIceCandidates[
        remoteSocketId
    ];


    /*
    Remove remote stream.
    */

    const remoteStream =
        remoteStreams[
            remoteSocketId
        ];


    if (
        remoteStream
    ) {

        /*
        Do NOT stop remote tracks unnecessarily
        because the browser owns the remote stream.

        Just release our reference.
        */

        delete remoteStreams[
            remoteSocketId
        ];

    }


    /*
    Remove participant information.
    */

    delete participants[
        remoteSocketId
    ];


    /*
    Remove the HTML video tile.
    */

    const tile =
        document.querySelector(
            `[data-remote-id="${CSS.escape(
                remoteSocketId
            )}"]`
        );


    if (
        tile
    ) {

        tile.remove();

    }


    updateEmptyState();

    updateParticipantCount();

    updateParticipantsList();

}


/* =========================================================
   23. UPDATE EMPTY STATE
========================================================= */

function updateEmptyState() {

    if (
        !emptyState
    ) {

        return;

    }


    const remoteCount =
        Object.keys(
            peerConnections
        ).length;


    if (
        remoteCount ===
        0
    ) {

        emptyState.style.display =
            "flex";

    } else {

        emptyState.style.display =
            "none";

    }

}


/* =========================================================
   24. UPDATE PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    if (
        !participantCount
    ) {

        return;

    }


    /*
    Current user + connected remote participants.
    */

    const remoteCount =
        Object.keys(
            participants
        ).length;


    const totalCount =
        1 +
        remoteCount;


    participantCount.textContent =
        String(
            Math.max(
                1,
                totalCount
            )
        );

}


/* =========================================================
   25. UPDATE PARTICIPANTS LIST
========================================================= */

function updateParticipantsList() {

    if (
        !participantsList
    ) {

        return;

    }


    /*
    Clear existing list.
    */

    participantsList.innerHTML =
        "";


    /*
    Add current user.
    */

    addParticipantToList(
        `${userName} (You)`,
        "You"
    );


    /*
    Add remote users.
    */

    Object.keys(
        participants
    ).forEach(
        function (remoteSocketId) {

            const name =
                participants[
                    remoteSocketId
                ] ||
                "Participant";


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            let status =
                "Connecting";


            if (
                peerConnection
            ) {

                if (
                    peerConnection.connectionState ===
                    "connected"
                ) {

                    status =
                        "Connected";

                } else if (
                    peerConnection.connectionState ===
                    "failed"
                ) {

                    status =
                        "Connection failed";

                } else if (
                    peerConnection.connectionState ===
                    "disconnected"
                ) {

                    status =
                        "Disconnected";

                }

            }


            addParticipantToList(
                name,
                status
            );

        }
    );

}


/* =========================================================
   26. ADD PARTICIPANT TO LIST
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
   27. ICE RESTART
========================================================= */

async function attemptIceRestart(
    remoteSocketId
) {

    const peerConnection =
        peerConnections[
            remoteSocketId
        ];


    if (
        !peerConnection ||
        !socket ||
        !socket.connected
    ) {

        return;

    }


    /*
    Avoid trying to restart a closed connection.
    */

    if (
        peerConnection.connectionState ===
            "closed"
    ) {

        return;

    }


    /*
    Only the existing offerer should normally
    perform the restart.

    Our architecture makes the user who sees
    an existing participant create the offer.
    */

    try {

        console.log(
            "Attempting ICE restart:",
            remoteSocketId
        );


        const offer =
            await peerConnection.createOffer({

                iceRestart:
                    true,

                offerToReceiveAudio:
                    true,

                offerToReceiveVideo:
                    true

            });


        await peerConnection.setLocalDescription(
            offer
        );


        socket.emit(
            "offer",
            {

                target:
                    remoteSocketId,

                offer:
                    peerConnection.localDescription,

                name:
                    userName

            }
        );


    } catch (error) {

        console.warn(
            "ICE restart failed:",
            remoteSocketId,
            error
        );

    }

}


/* =========================================================
   28. HANDLE EXISTING PARTICIPANTS
========================================================= */

async function handleExistingParticipants(
    data
) {

    console.log(
        "Existing participants:",
        data
    );


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
        const participant
            of list
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
        Some servers may send only the socket ID.
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


        if (
            socket &&
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


        if (
            !peerConnection
        ) {

            continue;

        }


        /*
        We are the new participant,
        therefore create the offer.
        */

        try {

            const offer =
                await peerConnection.createOffer({

                    offerToReceiveAudio:
                        true,

                    offerToReceiveVideo:
                        true

                });


            await peerConnection.setLocalDescription(
                offer
            );


            socket.emit(
                "offer",
                {

                    target:
                        remoteSocketId,

                    offer:
                        peerConnection.localDescription,

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


/* =========================================================
   END OF PART 2
========================================================= */

/* =========================================================
   29. STOP LOCAL MEDIA
========================================================= */

function stopLocalMedia() {

    /*
    Stop screen sharing tracks first.
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
    Stop camera and microphone tracks.
    */

    if (
        localStream
    ) {

        localStream
            .getTracks()
            .forEach(
                function (track) {

                    try {

                        track.stop();

                    } catch (error) {}

                }
            );


        localStream =
            null;

    }


    /*
    Clear local video.
    */

    if (
        localVideo
    ) {

        localVideo.srcObject =
            null;


        localVideo.style.display =
            "none";

    }


    if (
        localPlaceholder
    ) {

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

}


/* =========================================================
   30. MICROPHONE BUTTON UI
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


        micBtn.setAttribute(
            "aria-label",
            "Mute microphone"
        );


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


        micBtn.setAttribute(
            "aria-label",
            "Unmute microphone"
        );


        if (
            icon
        ) {

            icon.textContent =
                "🔇";

        }

    }

}


/* =========================================================
   31. TOGGLE MICROPHONE
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
   32. CAMERA BUTTON UI
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


        cameraBtn.setAttribute(
            "aria-label",
            "Turn camera off"
        );


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


        cameraBtn.setAttribute(
            "aria-label",
            "Turn camera on"
        );


        if (
            icon
        ) {

            icon.textContent =
                "📷";

        }

    }

}


/* =========================================================
   33. TOGGLE CAMERA
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
    Keep the local placeholder synchronized.
    */

    setLocalVideoStream(
        localStream,
        cameraEnabled
    );


    updateCameraButton();


    showToast(
        "info",
        cameraEnabled
            ? "Camera turned on."
            : "Camera turned off."
    );

}


/* =========================================================
   34. CAMERA / MICROPHONE BUTTON EVENTS
========================================================= */

if (
    micBtn
) {

    micBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


            toggleMicrophone();

        }
    );

}


if (
    cameraBtn
) {

    cameraBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


            toggleCamera();

        }
    );

}


/* =========================================================
   35. SCREEN SHARE BUTTON UI
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


        screenShareBtn.classList.remove(
            "off"
        );


        screenShareBtn.title =
            "Stop screen sharing";


        screenShareBtn.setAttribute(
            "aria-label",
            "Stop screen sharing"
        );


        screenShareBtn.setAttribute(
            "aria-pressed",
            "true"
        );


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


        screenShareBtn.classList.remove(
            "off"
        );


        screenShareBtn.title =
            "Share your screen";


        screenShareBtn.setAttribute(
            "aria-label",
            "Share your screen"
        );


        screenShareBtn.setAttribute(
            "aria-pressed",
            "false"
        );


        if (
            icon
        ) {

            icon.textContent =
                "🖥️";

        }

    }

}


/* =========================================================
   36. START SCREEN SHARE
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
        typeof navigator.mediaDevices
            .getDisplayMedia !==
            "function"
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


        /*
        Ask the browser for the screen/window/tab.
        */

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
            screenStream
                .getVideoTracks()[0];


        if (
            !screenTrack
        ) {

            screenStream =
                null;


            throw new Error(
                "No screen video track returned."
            );

        }


        /*
        Replace the camera video sender
        in EVERY active peer connection.
        */

        const replacementPromises =
            [];


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


                const videoSender =
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
                        );


                if (
                    videoSender
                ) {

                    replacementPromises.push(
                        videoSender
                            .replaceTrack(
                                screenTrack
                            )
                            .catch(
                                function (error) {

                                    console.warn(
                                        "Could not replace video track:",
                                        remoteSocketId,
                                        error
                                    );

                                }
                            )
                    );

                }

            }
        );


        await Promise.all(
            replacementPromises
        );


        /*
        Show the shared screen locally.
        */

        if (
            localVideo
        ) {

            localVideo.srcObject =
                screenStream;


            localVideo.style.display =
                "block";


            localVideo.style.objectFit =
                "contain";


            localVideo.muted =
                true;


            if (
                localPlaceholder
            ) {

                localPlaceholder.style.display =
                    "none";

            }


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
                            "Screen preview playback blocked:",
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
            "success",
            "Screen sharing started."
        );


        /*
        The browser fires onended when the
        user clicks the browser's "Stop sharing"
        button.
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


        if (
            screenStream
        ) {

            screenStream
                .getTracks()
                .forEach(
                    function (track) {

                        try {

                            track.stop();

                        } catch (stopError) {}

                    }
                );

        }


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
   37. STOP SCREEN SHARE
========================================================= */

async function stopScreenShare() {

    if (
        !screenStream
    ) {

        updateScreenShareButton(
            false
        );


        /*
        Restore normal camera preview
        if necessary.
        */

        if (
            localStream &&
            cameraEnabled
        ) {

            setLocalVideoStream(
                localStream,
                true
            );

        }


        return;

    }


    console.log(
        "Stopping screen sharing..."
    );


    /*
    Save the screen stream before
    clearing the variable.
    */

    const currentScreenStream =
        screenStream;


    /*
    Stop the screen tracks.
    */

    currentScreenStream
        .getTracks()
        .forEach(
            function (track) {

                try {

                    track.stop();

                } catch (error) {}

            }
        );


    /*
    Find the original camera track.
    */

    let cameraTrack =
        null;


    if (
        localStream &&
        cameraEnabled
    ) {

        const cameraTracks =
            localStream.getVideoTracks();


        if (
            cameraTracks.length
        ) {

            cameraTrack =
                cameraTracks[0];

        }

    }


    /*
    Restore camera track in every
    WebRTC peer connection.
    */

    const replacementPromises =
        [];


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


            const videoSender =
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
                    );


            if (
                videoSender
            ) {

                replacementPromises.push(
                    videoSender
                        .replaceTrack(
                            cameraTrack
                        )
                        .catch(
                            function (error) {

                                console.warn(
                                    "Could not restore camera track:",
                                    remoteSocketId,
                                    error
                                );

                            }
                        )
                );

            }

        }
    );


    await Promise.all(
        replacementPromises
    );


    screenStream =
        null;


    /*
    Restore local preview.
    */

    if (
        localStream &&
        cameraEnabled
    ) {

        setLocalVideoStream(
            localStream,
            true
        );


        if (
            localVideo
        ) {

            localVideo.style.objectFit =
                "cover";

        }


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
   38. SCREEN SHARE BUTTON EVENT
========================================================= */

if (
    screenShareBtn
) {

    screenShareBtn.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();

            event.stopPropagation();


            if (
                screenStream
            ) {

                await stopScreenShare();


            } else {

                await startScreenShare();

            }

        }
    );

}


/* =========================================================
   39. SCREEN SHARE TRACK SAFETY
========================================================= */

function restoreCameraAfterScreenShareEnds() {

    if (
        screenStream
    ) {

        return;

    }


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

}


/* =========================================================
   40. LOCAL MEDIA DEVICE CHANGE
========================================================= */

if (
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.addEventListener ===
        "function"
) {

    navigator.mediaDevices.addEventListener(
        "devicechange",
        function () {

            console.log(
                "Media device list changed."
            );

        }
    );

}


/* =========================================================
   END OF PART 3
========================================================= */

/* =========================================================
   41. CHAT UNREAD COUNT
========================================================= */

function updateUnreadChatBadge() {

    /*
    Look for an existing badge first.
    */

    let badge =
        document.getElementById(
            "chatUnreadCount"
        );


    /*
    Create one if the HTML does not already
    contain it.
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
   42. INCREASE UNREAD CHAT COUNT
========================================================= */

function increaseUnreadChatCount() {

    unreadChatCount +=
        1;


    updateUnreadChatBadge();

}


/* =========================================================
   43. CLEAR UNREAD CHAT COUNT
========================================================= */

function clearUnreadChatCount() {

    unreadChatCount =
        0;


    updateUnreadChatBadge();

}


/* =========================================================
   44. ADD CHAT MESSAGE
========================================================= */

function addChatMessage(
    name,
    message,
    isOwnMessage = false
) {

    if (
        !chatMessages
    ) {

        console.warn(
            "Chat messages container not found."
        );


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
    Create message wrapper.
    */

    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        "chat-message";


    if (
        isOwnMessage
    ) {

        messageElement.classList.add(
            "own-message"
        );

    }


    /*
    Message header.
    */

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "chat-message-header";


    /*
    Sender name.
    */

    const nameElement =
        document.createElement(
            "span"
        );


    nameElement.className =
        "chat-message-name";


    nameElement.textContent =
        isOwnMessage
            ? "You"
            : cleanName;


    /*
    Message time.
    */

    const timeElement =
        document.createElement(
            "span"
        );


    timeElement.className =
        "chat-message-time";


    timeElement.textContent =
        new Date()
            .toLocaleTimeString(
                [],
                {
                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );


    /*
    Message text.
    */

    const textElement =
        document.createElement(
            "div"
        );


    textElement.className =
        "chat-message-text";


    /*
    textContent is intentional.

    It prevents HTML entered into chat
    from being interpreted as HTML.
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
    Automatically scroll to the newest message.
    */

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


/* =========================================================
   45. SEND CHAT MESSAGE
========================================================= */

function sendChatMessage() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


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


    /*
    Socket must be connected.
    */

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
    Display our message immediately.

    The server may also broadcast the same
    message back to us, so the receiving
    handler below detects and avoids duplicates.
    */

    addChatMessage(
        userName,
        message,
        true
    );


    /*
    Send message to Flask-SocketIO.
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
    Clear input.
    */

    chatInput.value =
        "";


    chatInput.focus();

}


/* =========================================================
   46. CHAT FORM
========================================================= */

if (
    chatForm
) {

    chatForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


            sendChatMessage();

        }
    );

}


/* =========================================================
   47. CHAT INPUT
========================================================= */

if (
    chatInput
) {

    chatInput.addEventListener(
        "keydown",
        function (event) {

            /*
            Enter sends the message.

            Shift + Enter remains available
            for a newline where supported.
            */

            if (
                event.key ===
                    "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                sendChatMessage();

            }

        }
    );

}


/* =========================================================
   48. HANDLE INCOMING CHAT MESSAGE
========================================================= */

function handleIncomingChatMessage(
    data
) {

    if (
        !data
    ) {

        return;

    }


    const name =
        data.name ||
        data.username ||
        "Participant";


    const message =
        data.message ||
        "";


    if (
        !String(
            message
        ).trim()
    ) {

        return;

    }


    /*
    If this message came back from the server
    from the current user, do not create a
    second copy.

    We already displayed it immediately
    inside sendChatMessage().
    */

    const isOwnMessage =
        String(
            name
        ).trim() ===
        String(
            userName
        ).trim();


    if (
        isOwnMessage
    ) {

        /*
        The sender already sees the message.

        Do not add a duplicate.
        */

        return;

    }


    addChatMessage(
        name,
        message,
        false
    );


    /*
    If chat sidebar is closed, show unread count.
    */

    const sidebarIsOpen =
        meetingSidebar &&
        meetingSidebar.classList.contains(
            "open"
        );


    if (
        !sidebarIsOpen
    ) {

        increaseUnreadChatCount();

    }

}


/* =========================================================
   49. OPEN SIDEBAR
========================================================= */

function openSidebar(
    section = "chat"
) {

    if (
        !meetingSidebar
    ) {

        console.warn(
            "Meeting sidebar not found."
        );


        return;

    }


    /*
    Open sidebar.
    */

    meetingSidebar.classList.add(
        "open"
    );


    meetingSidebar.classList.remove(
        "closed"
    );


    /*
    Find sections.

    We support several possible IDs so this
    works with the existing meeting_room.html
    structure.
    */

    const chatSection =
        document.getElementById(
            "chatSection"
        );


    const participantsSection =
        document.getElementById(
            "participantsSection"
        );


    /*
    Hide both sections first.
    */

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
    Open requested section.
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


        /*
        Scroll chat to bottom.
        */

        if (
            chatMessages
        ) {

            setTimeout(
                function () {

                    chatMessages.scrollTop =
                        chatMessages.scrollHeight;

                },
                0
            );

        }

    }

}


/* =========================================================
   50. CLOSE SIDEBAR
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
   51. OPEN CHAT
========================================================= */

function openChatSidebar(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

        event.stopPropagation();

    }


    openSidebar(
        "chat"
    );

}


/* =========================================================
   52. OPEN PARTICIPANTS
========================================================= */

function openParticipantsSidebar(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

        event.stopPropagation();

    }


    openSidebar(
        "participants"
    );

}


/* =========================================================
   53. CHAT BUTTON EVENTS
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


/* =========================================================
   54. PARTICIPANTS BUTTON EVENTS
========================================================= */

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


/* =========================================================
   55. SIDEBAR CLOSE BUTTON
========================================================= */

if (
    sidebarClose
) {

    sidebarClose.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


            closeSidebar();

        }
    );

}


/* =========================================================
   56. ESCAPE CLOSES SIDEBAR
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
   57. CHAT SOCKET EVENT
========================================================= */

function registerChatSocketHandler() {

    if (
        !socket
    ) {

        return;

    }


    /*
    Prevent duplicate registration.
    */

    if (
        socket.__meetspaceChatHandlerRegistered
    ) {

        return;

    }


    socket.__meetspaceChatHandlerRegistered =
        true;


    socket.on(
        "chat-message",
        function (data) {

            console.log(
                "CHAT MESSAGE RECEIVED:",
                data
            );


            handleIncomingChatMessage(
                data
            );

        }
    );

}


/* =========================================================
   58. INITIALIZE CHAT UI
========================================================= */

function initializeChatUI() {

    updateUnreadChatBadge();


    /*
    Make sure the sidebar starts closed
    unless the HTML explicitly opened it.
    */

    if (
        meetingSidebar &&
        !meetingSidebar.classList.contains(
            "open"
        )
    ) {

        meetingSidebar.classList.add(
            "closed"
        );

    }


    /*
    Register chat Socket.IO event if
    the socket already exists.
    */

    registerChatSocketHandler();

}


/* =========================================================
   59. PARTICIPANT LIST REFRESH
========================================================= */

function refreshParticipantUI() {

    updateParticipantsList();

    updateParticipantCount();

    updateEmptyState();

}


/* =========================================================
   60. CHAT AUTO FOCUS
========================================================= */

function focusChatInput() {

    if (
        chatInput &&
        meetingSidebar &&
        meetingSidebar.classList.contains(
            "open"
        )
    ) {

        setTimeout(
            function () {

                try {

                    chatInput.focus();

                } catch (error) {}

            },
            100
        );

    }

}


/* =========================================================
   61. WINDOW CLICK SAFETY
========================================================= */

document.addEventListener(
    "click",
    function (event) {

        /*
        Do not let clicks on meeting controls
        accidentally trigger unrelated handlers.
        */

        const target =
            event.target;


        if (
            target &&
            target.closest &&
            target.closest(
                ".meeting-control"
            )
        ) {

            event.stopPropagation();

        }

    },
    true
);


/* =========================================================
   END OF PART 4
========================================================= */

/* =========================================================
   62. UPDATE VIDEO LAYOUT
========================================================= */

function updateVideoLayout() {

    if (
        !remoteVideos
    ) {

        return;

    }


    const tiles =
        remoteVideos.querySelectorAll(
            ".remote-video-container"
        );


    const count =
        tiles.length;


    /*
    Remove old layout classes.
    */

    remoteVideos.classList.remove(
        "single-participant",
        "two-participants",
        "three-participants",
        "many-participants"
    );


    /*
    Apply layout based on participant count.
    */

    if (
        count ===
        0
    ) {

        remoteVideos.classList.add(
            "single-participant"
        );


    } else if (
        count ===
        1
    ) {

        remoteVideos.classList.add(
            "single-participant"
        );


    } else if (
        count ===
        2
    ) {

        remoteVideos.classList.add(
            "two-participants"
        );


    } else if (
        count ===
        3
    ) {

        remoteVideos.classList.add(
            "three-participants"
        );


    } else {

        remoteVideos.classList.add(
            "many-participants"
        );

    }


    /*
    Make sure every tile remains visible.
    */

    tiles.forEach(
        function (tile) {

            tile.style.display =
                "flex";

        }
    );

}


/* =========================================================
   63. MAXIMIZE VIDEO TILE
========================================================= */

function maximizeVideoTile(
    tile
) {

    if (
        !tile
    ) {

        return;

    }


    /*
    Close any previously maximized tile.
    */

    document
        .querySelectorAll(
            ".remote-video-container.maximized"
        )
        .forEach(
            function (existingTile) {

                if (
                    existingTile !==
                    tile
                ) {

                    minimizeVideoTile(
                        existingTile
                    );

                }

            }
        );


    tile.classList.add(
        "maximized"
    );


    document.body.classList.add(
        "video-maximized"
    );


    /*
    Find buttons.
    */

    const maximizeButton =
        tile.querySelector(
            ".remote-maximize-btn"
        );


    const minimizeButton =
        tile.querySelector(
            ".remote-minimize-btn"
        );


    if (
        maximizeButton
    ) {

        maximizeButton.style.display =
            "none";

    }


    if (
        minimizeButton
    ) {

        minimizeButton.style.display =
            "flex";

    }


    /*
    If the browser supports fullscreen,
    do not automatically request it.

    Maximized here means application-level
    maximize, not browser fullscreen.
    */

    updateVideoLayout();

}


/* =========================================================
   64. MINIMIZE VIDEO TILE
========================================================= */

function minimizeVideoTile(
    tile
) {

    if (
        !tile
    ) {

        return;

    }


    tile.classList.remove(
        "maximized"
    );


    /*
    Only remove body class if there
    are no other maximized tiles.
    */

    const anotherMaximizedTile =
        document.querySelector(
            ".remote-video-container.maximized"
        );


    if (
        !anotherMaximizedTile
    ) {

        document.body.classList.remove(
            "video-maximized"
        );

    }


    const maximizeButton =
        tile.querySelector(
            ".remote-maximize-btn"
        );


    const minimizeButton =
        tile.querySelector(
            ".remote-minimize-btn"
        );


    if (
        maximizeButton
    ) {

        maximizeButton.style.display =
            "flex";

    }


    if (
        minimizeButton
    ) {

        minimizeButton.style.display =
            "none";

    }


    updateVideoLayout();

}


/* =========================================================
   65. LOCAL VIDEO MAXIMIZE
========================================================= */

function maximizeLocalVideo() {

    if (
        !localVideo
    ) {

        return;

    }


    const localContainer =
        localVideo.closest(
            ".local-video-container"
        );


    if (
        localContainer
    ) {

        maximizeVideoTile(
            localContainer
        );

    }

}


/* =========================================================
   66. LOCAL VIDEO CLICK
========================================================= */

if (
    localVideo
) {

    localVideo.addEventListener(
        "dblclick",
        function (event) {

            event.preventDefault();


            const container =
                localVideo.closest(
                    ".local-video-container"
                );


            if (
                container
            ) {

                if (
                    container.classList.contains(
                        "maximized"
                    )
                ) {

                    minimizeVideoTile(
                        container
                    );


                } else {

                    maximizeVideoTile(
                        container
                    );

                }

            }

        }
    );

}


/* =========================================================
   67. REMOTE VIDEO DOUBLE CLICK
========================================================= */

if (
    remoteVideos
) {

    remoteVideos.addEventListener(
        "dblclick",
        function (event) {

            const tile =
                event.target.closest(
                    ".remote-video-container"
                );


            if (
                !tile
            ) {

                return;

            }


            if (
                tile.classList.contains(
                    "maximized"
                )
            ) {

                minimizeVideoTile(
                    tile
                );


            } else {

                maximizeVideoTile(
                    tile
                );

            }

        }
    );

}


/* =========================================================
   68. EXIT MAXIMIZED VIDEO WITH ESCAPE
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


        const maximizedTile =
            document.querySelector(
                ".remote-video-container.maximized"
            );


        if (
            maximizedTile
        ) {

            minimizeVideoTile(
                maximizedTile
            );


            return;

        }


        const maximizedLocal =
            document.querySelector(
                ".local-video-container.maximized"
            );


        if (
            maximizedLocal
        ) {

            minimizeVideoTile(
                maximizedLocal
            );

        }

    }
);


/* =========================================================
   69. INITIALIZE VIDEO CARD OBSERVER
========================================================= */

function initializeVideoCardObserver() {

    if (
        !remoteVideos
    ) {

        return;

    }


    /*
    MutationObserver automatically updates
    the layout whenever a remote video tile
    is added or removed.
    */

    if (
        remoteVideos.__meetspaceObserver
    ) {

        return;

    }


    if (
        typeof MutationObserver ===
        "function"
    ) {

        const observer =
            new MutationObserver(
                function () {

                    updateVideoLayout();

                    updateEmptyState();

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


        remoteVideos.__meetspaceObserver =
            observer;

    }


    updateVideoLayout();

}


/* =========================================================
   70. VIDEO TILE FULLSCREEN
========================================================= */

async function toggleVideoFullscreen(
    tile
) {

    if (
        !tile
    ) {

        return;

    }


    try {

        /*
        If already fullscreen, exit.
        */

        if (
            document.fullscreenElement
        ) {

            await document.exitFullscreen();

            return;

        }


        /*
        Request fullscreen on the video tile.
        */

        if (
            tile.requestFullscreen
        ) {

            await tile.requestFullscreen();

        }

    } catch (error) {

        console.warn(
            "Fullscreen request failed:",
            error
        );

    }

}


/* =========================================================
   71. FULLSCREEN CHANGE
========================================================= */

document.addEventListener(
    "fullscreenchange",
    function () {

        /*
        Keep application layout synchronized
        with browser fullscreen.
        */

        updateVideoLayout();

    }
);


/* =========================================================
   72. CLEAN REMOTE VIDEO ELEMENT
========================================================= */

function cleanRemoteVideoElement(
    tile
) {

    if (
        !tile
    ) {

        return;

    }


    const video =
        tile.querySelector(
            ".remote-video"
        );


    if (
        video
    ) {

        try {

            video.pause();

        } catch (error) {}


        video.srcObject =
            null;

    }


    tile.remove();

}


/* =========================================================
   73. CLOSE ALL PEER CONNECTIONS
========================================================= */

function closeAllPeerConnections() {

    /*
    Close every WebRTC connection.
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

                peerConnection.ontrack =
                    null;

                peerConnection.onicecandidate =
                    null;

                peerConnection.onconnectionstatechange =
                    null;

                peerConnection.oniceconnectionstatechange =
                    null;

                peerConnection.onnegotiationneeded =
                    null;


                peerConnection.close();


            } catch (error) {

                console.warn(
                    "Peer connection close failed:",
                    remoteSocketId,
                    error
                );

            }

        }
    );


    /*
    Remove remote video elements.
    */

    if (
        remoteVideos
    ) {

        remoteVideos
            .querySelectorAll(
                ".remote-video-container"
            )
            .forEach(
                function (tile) {

                    cleanRemoteVideoElement(
                        tile
                    );

                }
            );

    }


    /*
    Clear all WebRTC state.
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


    updateParticipantCount();

    updateParticipantsList();

    updateEmptyState();

    updateVideoLayout();

}


/* =========================================================
   74. STOP ALL MEDIA TRACKS SAFELY
========================================================= */

function stopAllMediaTracks(
    stream
) {

    if (
        !stream
    ) {

        return;

    }


    stream
        .getTracks()
        .forEach(
            function (track) {

                try {

                    track.stop();

                } catch (error) {

                    console.warn(
                        "Could not stop media track:",
                        error
                    );

                }

            }
        );

}


/* =========================================================
   75. PAGE VISIBILITY
========================================================= */

document.addEventListener(
    "visibilitychange",
    function () {

        /*
        DO NOT leave the meeting just because
        the user switches tabs.

        This was intentionally designed this way
        so the meeting continues in the background.
        */

        if (
            document.visibilityState ===
            "visible"
        ) {

            updateVideoLayout();

            updateParticipantsList();

            updateParticipantCount();

        }

    }
);


/* =========================================================
   76. WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    function () {

        updateVideoLayout();

    }
);


/* =========================================================
   77. BEFORE UNLOAD RESOURCE CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        /*
        Release local media.
        */

        stopAllMediaTracks(
            screenStream
        );


        stopAllMediaTracks(
            localStream
        );


        /*
        Close WebRTC connections.
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
                    peerConnection
                ) {

                    try {

                        peerConnection.close();

                    } catch (error) {}

                }

            }
        );


        /*
        Release duplicate session lock.
        */

        releaseDuplicateSessionLock();

    }
);


/* =========================================================
   78. PAGE HIDDEN RESOURCE SAFETY
========================================================= */

window.addEventListener(
    "pagehide",
    function () {

        /*
        Stop media only when the actual page
        is being unloaded.

        Do NOT stop media on normal tab switching.
        */

        stopAllMediaTracks(
            screenStream
        );


        stopAllMediaTracks(
            localStream
        );

    }
);


/* =========================================================
   79. VIDEO TRACK ENDED SAFETY
========================================================= */

function attachLocalTrackSafety() {

    if (
        !localStream
    ) {

        return;

    }


    localStream
        .getTracks()
        .forEach(
            function (track) {

                if (
                    track.__meetspaceSafetyAttached
                ) {

                    return;

                }


                track.__meetspaceSafetyAttached =
                    true;


                track.addEventListener(
                    "ended",
                    function () {

                        if (
                            track.kind ===
                            "video"
                        ) {

                            cameraEnabled =
                                false;


                            updateCameraButton();

                            setLocalVideoStream(
                                localStream,
                                false
                            );

                        }


                        if (
                            track.kind ===
                            "audio"
                        ) {

                            microphoneEnabled =
                                false;


                            updateMicrophoneButton();

                        }

                    }
                );

            }
        );

}


/* =========================================================
   80. UPDATE LOCAL TRACK STATE
========================================================= */

function synchronizeLocalMediaState() {

    if (
        !localStream
    ) {

        microphoneEnabled =
            false;


        cameraEnabled =
            false;


        updateMicrophoneButton();

        updateCameraButton();


        return;

    }


    const audioTracks =
        localStream.getAudioTracks();


    const videoTracks =
        localStream.getVideoTracks();


    microphoneEnabled =
        audioTracks.some(
            function (track) {

                return track.enabled;

            }
        );


    cameraEnabled =
        videoTracks.some(
            function (track) {

                return track.enabled;

            }
        );


    updateMicrophoneButton();

    updateCameraButton();

}


/* =========================================================
   81. END OF PART 5
========================================================= */

/* =========================================================
   82. REGISTER SOCKET EVENTS
========================================================= */

function registerSocketEvents() {

    if (
        !socket
    ) {

        return;

    }


    /*
    Prevent registering all Socket.IO handlers twice.
    */

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


            if (
                duplicateSessionLost
            ) {

                return;

            }


            hasLeftMeeting =
                false;


            socketRoomJoined =
                false;


            updateConnectionStatus(
                "connecting",
                "Connected to server"
            );


            /*
            Initialize camera/microphone.

            If media was already initialized,
            initializeMeeting() safely returns.
            */

            await initializeMeeting();


            attachLocalTrackSafety();

            synchronizeLocalMediaState();


            /*
            Join only after Socket.IO is connected.
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


            socketRoomJoined =
                false;


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
       SOCKET RECONNECT ATTEMPT
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


        socket.io.on(
            "reconnect_error",
            function (error) {

                console.warn(
                    "Socket reconnect error:",
                    error
                );

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
                !hasLeftMeeting &&
                !duplicateSessionLost
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


            if (
                hasLeftMeeting ||
                duplicateSessionLost
            ) {

                return;

            }


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


            /*
            Create an offer to every participant
            who was already in the room.
            */

            for (
                const participant
                    of list
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
                Some backend versions may send
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


                if (
                    !peerConnection
                ) {

                    continue;

                }


                try {

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


            refreshParticipantUI();

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


            if (
                hasLeftMeeting ||
                duplicateSessionLost
            ) {

                return;

            }


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
            IMPORTANT:

            Do NOT create an offer here.

            The new participant will receive
            our offer through the existing-participants
            flow.

            Creating offers from both sides can
            create an offer collision.
            */

            createPeerConnection(
                remoteSocketId,
                remoteName
            );


            refreshParticipantUI();

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


            refreshParticipantUI();

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
            Prefer our locally calculated count
            because it is synchronized with the
            actual WebRTC participant list.
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


            if (
                hasLeftMeeting ||
                duplicateSessionLost
            ) {

                return;

            }


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


            if (
                !peerConnection
            ) {

                return;

            }


            try {

                /*
                Set remote offer first.
                */

                await peerConnection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            offer
                        )
                    );


                /*
                ICE candidates that arrived
                before the offer are now safe
                to add.
                */

                await flushPendingIceCandidates(
                    remoteSocketId
                );


                /*
                Create answer.
                */

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


                /*
                Send answer back to offerer.
                */

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


                refreshParticipantUI();


            } catch (error) {

                console.error(
                    "Offer handling failed:",
                    error
                );


                showToast(
                    "error",
                    "Could not establish video connection."
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


            if (
                hasLeftMeeting ||
                duplicateSessionLost
            ) {

                return;

            }


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

                console.warn(
                    "Invalid answer received."
                );


                return;

            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (
                !peerConnection
            ) {

                console.warn(
                    "Answer received for unknown peer:",
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
                    "REMOTE ANSWER APPLIED ->",
                    remoteSocketId
                );


                refreshParticipantUI();


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


            if (
                hasLeftMeeting ||
                duplicateSessionLost
            ) {

                return;

            }


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


            /*
            If the peer connection does not
            exist yet, save the candidate.

            It will be added after the remote
            description arrives.
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

                /*
                Remote description is already available.
                */

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

                    /*
                    Otherwise queue it.
                    */

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


            /*
            The sender already displays its own
            message immediately inside sendChatMessage().

            Therefore only display messages from
            other participants here.
            */

            const name =
                data?.name ||
                data?.username ||
                "Participant";


            const message =
                data?.message ||
                "";


            if (
                !String(
                    message
                ).trim()
            ) {

                return;

            }


            const senderIsCurrentUser =
                String(
                    name
                ).trim() ===
                String(
                    userName
                ).trim();


            if (
                senderIsCurrentUser
            ) {

                return;

            }


            addChatMessage(
                name,
                message,
                false
            );


            /*
            Show unread count only when
            the chat sidebar is closed.
            */

            const sidebarIsOpen =
                meetingSidebar &&
                meetingSidebar.classList.contains(
                    "open"
                );


            if (
                !sidebarIsOpen
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


            showToast(
                "error",
                data?.message ||
                "Meeting server error."
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


            refreshParticipantUI();

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


            refreshParticipantUI();

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


            refreshParticipantUI();

        }
    );

}


/* =========================================================
   83. CREATE SOCKET
========================================================= */

function createSocket() {

    if (
        socket
    ) {

        /*
        Socket already exists.
        */

        return;

    }


    if (
        typeof window.io !==
        "function"
    ) {

        console.error(
            "Socket.IO io() is not available."
        );


        updateConnectionStatus(
            "error",
            "Socket.IO unavailable"
        );


        return;

    }


    try {

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


        /*
        Register ALL Socket.IO handlers immediately.
        */

        registerSocketEvents();


        /*
        Register chat UI is safe because
        Part 4 only creates the helper and
        does not register a second socket event.
        */

        initializeChatUI();


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


        showToast(
            "error",
            "Could not create meeting connection."
        );

    }

}


/* =========================================================
   84. LEAVE MEETING
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


    updateConnectionStatus(
        "disconnected",
        "Leaving meeting..."
    );


    /*
    Tell the Flask-SocketIO server
    that this participant is leaving.
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
                "Could not send leave-meeting event:",
                error
            );

        }

    }


    /*
    Stop screen sharing.
    */

    if (
        screenStream
    ) {

        stopAllMediaTracks(
            screenStream
        );


        screenStream =
            null;

    }


    /*
    Stop camera and microphone.
    */

    stopLocalMedia();


    /*
    Close every WebRTC connection.
    */

    closeAllPeerConnections();


    /*
    Release duplicate-tab lock.
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

        } catch (error) {

            console.warn(
                "Socket disconnect failed:",
                error
            );

        }

    }


    /*
    Redirect after cleanup.

    This keeps the user out of a meeting
    whose connection has already been closed.
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
   85. LEAVE BUTTON
========================================================= */

if (
    leaveMeetingBtn
) {

    leaveMeetingBtn.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


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

            event.stopPropagation();


            leaveMeeting();

        }
    );

}


/* =========================================================
   86. BEFORE UNLOAD SOCKET CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        /*
        Do not redirect from beforeunload.

        Just notify the server and release
        browser resources.
        */

        if (
            socket &&
            socket.connected &&
            !hasLeftMeeting
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


        stopAllMediaTracks(
            screenStream
        );


        stopAllMediaTracks(
            localStream
        );


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

                        peerConnection.close();

                    } catch (error) {}

                }

            }
        );


        releaseDuplicateSessionLock();

    }
);


/* =========================================================
   87. INITIALIZE MEETSPACE CLIENT
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
        "================================="
    );


    console.log(
        "INITIALIZING MEETSPACE"
    );


    console.log(
        "================================="
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
    Duplicate-tab protection.
    */

    initializeDuplicateSessionProtection();


    if (
        duplicateSessionLost
    ) {

        return;

    }


    /*
    Initial UI state.
    */

    updateMicrophoneButton();

    updateCameraButton();

    updateScreenShareButton(
        false
    );

    updateUnreadChatBadge();

    updateParticipantCount();

    updateParticipantsList();

    updateEmptyState();

    updateVideoLayout();

    initializeVideoCardObserver();


    /*
    Focus on Socket.IO initialization.

    Camera/microphone will be initialized
    after Socket.IO connects.
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
        "MeetSpace initialization complete."
    );

}


/* =========================================================
   88. DOM READY
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
   89. GLOBAL ERROR HANDLER
========================================================= */

window.addEventListener(
    "error",
    function (event) {

        console.error(
            "MeetSpace JavaScript error:",
            event.error ||
            event.message
        );

    }
);


/* =========================================================
   90. GLOBAL PROMISE ERROR HANDLER
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
   91. FINAL LOAD MESSAGE
========================================================= */

console.log(
    "================================="
);


console.log(
    "MeetSpace meeting.js loaded successfully."
);


console.log(
    "================================="
);


/* =========================================================
   END OF MEETING.JS
========================================================= */
