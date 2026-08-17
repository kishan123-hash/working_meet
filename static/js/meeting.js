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


/*
Temporary record of messages sent by this client.

This prevents a server echo from displaying
the same message twice while still allowing
the message to appear immediately.
*/
const pendingLocalChatMessages =
    new Map();


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

        // Google STUN
        {
            urls:
                "stun:stun.l.google.com:19302"
        },

        {
            urls:
                "stun:stun1.l.google.com:19302"
        },

        // TURN server
        {
            urls:
                "turn:YOUR_TURN_SERVER:3478",
            username:
                "YOUR_TURN_USERNAME",
            credential:
                "YOUR_TURN_PASSWORD"
        },

        // TURN over TLS
        {
            urls:
                "turns:YOUR_TURN_SERVER:5349",
            username:
                "YOUR_TURN_USERNAME",
            credential:
                "YOUR_TURN_PASSWORD"
        }

    ],

    iceTransportPolicy:
        "all",

    bundlePolicy:
        "max-bundle",

    rtcpMuxPolicy:
        "require",

    /*
    Pre-gather ICE candidates.
    This can reduce connection setup
    time for newly joined participants.
    */
    iceCandidatePoolSize:
        10

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

    /*
    Socket.IO is loaded by meeting_room.html from the CDN
    BEFORE meeting.js.

    Do NOT load /socket.io/socket.io.js here.
    That endpoint was returning HTTP 400 on the deployed
    MeetSpace server and caused the initialization failure.
    */

    return new Promise(
        function (
            resolve,
            reject
        ) {

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

            console.error(
                "Socket.IO client is not available."
            );

            reject(
                new Error(
                    "Socket.IO client is not available. Check meeting_room.html."
                )
            );

        }
    );

}

/* Socket creation is defined once in Section 83 below. */
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


            /*
            Keep the meeting usable even when
            camera and microphone permissions fail.
            */

            localStream =
                new MediaStream();


            setLocalVideoStream(
                localStream,
                false
            );


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
   16. SET LOCAL VIDEO STREAM
========================================================= */

function setLocalVideoStream(
    stream,
    showVideo
) {

    if (
        !localVideo
    ) {

        return;

    }


    if (
        stream
    ) {

        localVideo.srcObject =
            stream;

    } else {

        localVideo.srcObject =
            null;

    }


    localVideo.muted =
        true;


    localVideo.autoplay =
        true;


    localVideo.playsInline =
        true;


    if (
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


        /*
        Browsers may block autoplay.
        */

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
                        "Local video autoplay prevented:",
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
   17. STOP ALL MEDIA TRACKS
========================================================= */

function stopAllMediaTracks(
    stream
) {

    if (
        !stream
    ) {

        return;

    }


    try {

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

    } catch (error) {

        console.warn(
            "Could not stop media stream:",
            error
        );

    }

}


/* =========================================================
   18. STOP LOCAL MEDIA
========================================================= */

function stopLocalMedia() {

    if (
        localStream
    ) {

        stopAllMediaTracks(
            localStream
        );

        localStream =
            null;

    }


    if (
        localVideo
    ) {

        localVideo.srcObject =
            null;

    }


    microphoneEnabled =
        false;


    cameraEnabled =
        false;


    updateMicrophoneButton();

    updateCameraButton();

}


/* =========================================================
   19. GET LOCAL AUDIO TRACK
========================================================= */

function getLocalAudioTrack() {

    if (
        !localStream
    ) {

        return null;

    }


    const tracks =
        localStream.getAudioTracks();


    if (
        !tracks.length
    ) {

        return null;

    }


    return tracks[0];

}


/* =========================================================
   20. GET LOCAL VIDEO TRACK
========================================================= */

function getLocalVideoTrack() {

    if (
        !localStream
    ) {

        return null;

    }


    const tracks =
        localStream.getVideoTracks();


    if (
        !tracks.length
    ) {

        return null;

    }


    return tracks[0];

}


/* =========================================================
   21. UPDATE MICROPHONE BUTTON
========================================================= */

function updateMicrophoneButton() {

    if (
        !micBtn
    ) {

        return;

    }


    const audioTrack =
        getLocalAudioTrack();


    const enabled =
        Boolean(
            audioTrack &&
            audioTrack.enabled
        );


    microphoneEnabled =
        enabled;


    micBtn.classList.toggle(
        "active",
        enabled
    );


    micBtn.classList.toggle(
        "muted",
        !enabled
    );


    micBtn.setAttribute(
        "aria-pressed",
        String(enabled)
    );


    micBtn.title =
        enabled
            ? "Mute microphone"
            : "Unmute microphone";


    /*
    Keep common icon/text elements working
    without changing the existing UI structure.
    */

    const icon =
        micBtn.querySelector(
            "i"
        );


    if (
        icon
    ) {

        icon.classList.toggle(
            "fa-microphone",
            enabled
        );


        icon.classList.toggle(
            "fa-microphone-slash",
            !enabled
        );

    }


    const label =
        micBtn.querySelector(
            ".control-label"
        );


    if (
        label
    ) {

        label.textContent =
            enabled
                ? "Mute"
                : "Unmute";

    }

}


/* =========================================================
   22. UPDATE CAMERA BUTTON
========================================================= */

function updateCameraButton() {

    if (
        !cameraBtn
    ) {

        return;

    }


    const videoTrack =
        getLocalVideoTrack();


    const enabled =
        Boolean(
            videoTrack &&
            videoTrack.enabled
        );


    cameraEnabled =
        enabled;


    cameraBtn.classList.toggle(
        "active",
        enabled
    );


    cameraBtn.classList.toggle(
        "muted",
        !enabled
    );


    cameraBtn.setAttribute(
        "aria-pressed",
        String(enabled)
    );


    cameraBtn.title =
        enabled
            ? "Turn camera off"
            : "Turn camera on";


    const icon =
        cameraBtn.querySelector(
            "i"
        );


    if (
        icon
    ) {

        icon.classList.toggle(
            "fa-video",
            enabled
        );


        icon.classList.toggle(
            "fa-video-slash",
            !enabled
        );

    }


    const label =
        cameraBtn.querySelector(
            ".control-label"
        );


    if (
        label
    ) {

        label.textContent =
            enabled
                ? "Camera"
                : "Camera Off";

    }

}


/* =========================================================
   23. TOGGLE MICROPHONE
========================================================= */

function toggleMicrophone() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    const audioTrack =
        getLocalAudioTrack();


    if (
        !audioTrack
    ) {

        showToast(
            "error",
            "Microphone is not available."
        );


        return;

    }


    audioTrack.enabled =
        !audioTrack.enabled;


    microphoneEnabled =
        audioTrack.enabled;


    updateMicrophoneButton();


    synchronizeLocalMediaState();


    console.log(
        "Microphone:",
        microphoneEnabled
            ? "ON"
            : "OFF"
    );

}


/* =========================================================
   24. TOGGLE CAMERA
========================================================= */

async function toggleCamera() {

    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    let videoTrack =
        getLocalVideoTrack();


    /*
    If the user previously had no camera track,
    try to acquire one when pressing the camera button.
    */

    if (
        !videoTrack
    ) {

        try {

            const newStream =
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

                        audio: false

                    });


            videoTrack =
                newStream.getVideoTracks()[0];


            if (
                !videoTrack
            ) {

                throw new Error(
                    "No camera track returned."
                );

            }


            if (
                !localStream
            ) {

                localStream =
                    new MediaStream();

            }


            localStream.addTrack(
                videoTrack
            );


            /*
            Add the new camera track to
            every existing peer connection.
            */

            Object.keys(
                peerConnections
            ).forEach(
                function (
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


                    try {

                        const sender =
                            peerConnection
                                .getSenders()
                                .find(
                                    function (
                                        item
                                    ) {

                                        return (
                                            item.track &&
                                            item.track.kind ===
                                                "video"
                                        );

                                    }
                                );


                        if (
                            sender
                        ) {

                            sender.replaceTrack(
                                videoTrack
                            );

                        } else {

                            peerConnection.addTrack(
                                videoTrack,
                                localStream
                            );

                        }

                    } catch (error) {

                        console.warn(
                            "Could not add camera track to peer:",
                            error
                        );

                    }

                }
            );


            videoTrack.enabled =
                true;


            cameraEnabled =
                true;


            setLocalVideoStream(
                localStream,
                true
            );


            updateCameraButton();

            synchronizeLocalMediaState();


            console.log(
                "Camera enabled."
            );


            return;


        } catch (error) {

            console.error(
                "Could not start camera:",
                error
            );


            showToast(
                "error",
                "Unable to access camera."
            );


            return;

        }

    }


    videoTrack.enabled =
        !videoTrack.enabled;


    cameraEnabled =
        videoTrack.enabled;


    setLocalVideoStream(
        localStream,
        cameraEnabled
    );


    /*
    Keep every existing WebRTC sender
    synchronized with the camera state.
    */

    Object.keys(
        peerConnections
    ).forEach(
        function (
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


            const sender =
                peerConnection
                    .getSenders()
                    .find(
                        function (
                            item
                        ) {

                            return (
                                item.track &&
                                item.track.kind ===
                                    "video"
                            );

                        }
                    );


            if (
                sender &&
                videoTrack
            ) {

                try {

                    sender.replaceTrack(
                        videoTrack
                    );

                } catch (error) {

                    console.warn(
                        "Camera sender synchronization failed:",
                        error
                    );

                }

            }

        }
    );


    updateCameraButton();


    synchronizeLocalMediaState();


    console.log(
        "Camera:",
        cameraEnabled
            ? "ON"
            : "OFF"
    );

}


/* =========================================================
   25. SYNCHRONIZE LOCAL MEDIA STATE
========================================================= */

function synchronizeLocalMediaState() {

    const audioTrack =
        getLocalAudioTrack();


    const videoTrack =
        getLocalVideoTrack();


    microphoneEnabled =
        Boolean(
            audioTrack &&
            audioTrack.enabled
        );


    cameraEnabled =
        Boolean(
            videoTrack &&
            videoTrack.enabled
        );


    updateMicrophoneButton();

    updateCameraButton();

}


/* =========================================================
   26. ATTACH LOCAL TRACK SAFETY
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
            function (
                track
            ) {

                track.onended =
                    function () {

                        if (
                            track.kind ===
                            "audio"
                        ) {

                            microphoneEnabled =
                                false;


                            updateMicrophoneButton();

                        }


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

                    };

            }
        );

}

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


    /*
    ICE candidates can only safely be added after
    the remote description has been set.
    */

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
   19. CREATE / UPDATE REMOTE VIDEO
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
    Find an existing participant tile.
    */

    let tile =
        null;


    try {

        tile =
            remoteVideos.querySelector(
                `[data-remote-id="${CSS.escape(
                    remoteSocketId
                )}"]`
            );

    } catch (error) {

        /*
        CSS.escape may not exist in some older browsers.
        Fall back to checking the children manually.
        */

        const tiles =
            remoteVideos.querySelectorAll(
                "[data-remote-id]"
            );


        for (
            const item of tiles
        ) {

            if (
                item.dataset.remoteId ===
                remoteSocketId
            ) {

                tile =
                    item;

                break;

            }

        }

    }


    /*
    ---------------------------------------------------------
    CREATE TILE IF IT DOES NOT EXIST
    ---------------------------------------------------------
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
        Keep the remote video from being blocked
        by autoplay policies where possible.
        */

        video.setAttribute(
            "autoplay",
            ""
        );


        video.setAttribute(
            "playsinline",
            ""
        );


        /*
        -----------------------------------------------------
        VIDEO PLACEHOLDER
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
        Participant name
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


        statusLabel.textContent =
            "Connecting...";


        statusLabel.dataset.remoteStatus =
            remoteSocketId;


        /*
        -----------------------------------------------------
        APPEND ELEMENTS
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


        remoteVideos.appendChild(
            tile
        );


        /*
Save the stream on the video element.
*/

video.srcObject =
    stream;


/*
Start remote video as soon as
the video element is ready.
*/

const startRemotePlayback =
    function () {

        try {

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
                            "Remote video autoplay prevented:",
                            error
                        );

                    }
                );

            }

        } catch (error) {

            console.warn(
                "Remote video playback failed:",
                error
            );

        }

    };


/*
If the video is already ready,
play immediately.
*/

if (
    video.readyState >= 1
) {

    startRemotePlayback();

} else {

    /*
    Wait until the remote video's
    metadata is ready.
    */

    video.addEventListener(
        "loadedmetadata",
        startRemotePlayback,
        {
            once: true
        }
    );

}

        /*
        A remote video may initially have no video track.
        Show the placeholder in that situation.
        */

        updateRemoteVideoPlaceholder(
            remoteSocketId,
            stream
        );


        updateRemoteVideoStatus(
            remoteSocketId,
            "Connected"
        );


    } else {

        /*
        -----------------------------------------------------
        UPDATE EXISTING TILE
        -----------------------------------------------------
        */

        const video =
            tile.querySelector(
                "video.remote-video"
            );


        if (
            video
        ) {

            /*
            Only replace the MediaStream when needed.
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


            try {

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

            } catch (error) {}

        }


        /*
        Update participant name.
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


        /*
        Update avatar.
        */

        const avatar =
            tile.querySelector(
                ".remote-avatar"
            );


        if (
            avatar
        ) {

            avatar.textContent =
                String(
                    remoteName ||
                    "Participant"
                )
                    .charAt(0)
                    .toUpperCase();

        }


        updateRemoteVideoPlaceholder(
            remoteSocketId,
            stream
        );


        updateRemoteVideoStatus(
            remoteSocketId,
            "Connected"
        );

    }


    /*
    Store stream.
    */

    remoteStreams[
        remoteSocketId
    ] =
        stream;


    /*
    Keep participant UI synchronized.
    */

    updateParticipantCount();

    updateParticipantsList();

    updateEmptyState();

    updateVideoLayout();

}


/* =========================================================
   20. UPDATE REMOTE VIDEO PLACEHOLDER
========================================================= */

function updateRemoteVideoPlaceholder(
    remoteSocketId,
    stream
) {

    if (
        !remoteVideos
    ) {

        return;

    }


    const tile =
        remoteVideos.querySelector(
            `[data-remote-id="${CSS.escape(
                remoteSocketId
            )}"]`
        );


    if (
        !tile
    ) {

        return;

    }


    const placeholder =
        tile.querySelector(
            ".remote-video-placeholder"
        );


    const video =
        tile.querySelector(
            "video.remote-video"
        );


    if (
        !placeholder
    ) {

        return;

    }


    const hasVideoTrack =
        Boolean(
            stream &&
            stream.getVideoTracks()
                .some(
                    function (
                        track
                    ) {

                        return (
                            track.readyState !==
                                "ended"
                        );

                    }
                )
        );


    /*
    If remote camera is available,
    show video and hide placeholder.
    */

    if (
        hasVideoTrack
    ) {

        placeholder.style.display =
            "none";


        if (
            video
        ) {

            video.style.display =
                "block";

        }

    } else {

        placeholder.style.display =
            "flex";


        if (
            video
        ) {

            video.style.display =
                "none";

        }

    }

}


/* =========================================================
   21. UPDATE REMOTE VIDEO STATUS
========================================================= */

function updateRemoteVideoStatus(
    remoteSocketId,
    status
) {

    if (
        !remoteVideos
    ) {

        return;

    }


    const statusLabel =
        remoteVideos.querySelector(
            `[data-remote-status="${CSS.escape(
                remoteSocketId
            )}"]`
        );


    if (
        statusLabel
    ) {

        statusLabel.textContent =
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
    Close peer connection.
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
                "Could not close peer connection:",
                error
            );

        }

    }


    delete peerConnections[
        remoteSocketId
    ];


    /*
    Remove queued ICE candidates.
    */

    delete pendingIceCandidates[
        remoteSocketId
    ];


    /*
    Remove stored remote stream.
    */

    const remoteStream =
        remoteStreams[
            remoteSocketId
        ];


    if (
        remoteStream
    ) {

        stopAllMediaTracks(
            remoteStream
        );

    }


    delete remoteStreams[
        remoteSocketId
    ];


    /*
    Remove participant name.
    */

    delete participants[
        remoteSocketId
    ];


    /*
    Remove the video tile.
    */

    if (
        remoteVideos
    ) {

        let tile =
            null;


        try {

            tile =
                remoteVideos.querySelector(
                    `[data-remote-id="${CSS.escape(
                        remoteSocketId
                    )}"]`
                );

        } catch (error) {

            const tiles =
                remoteVideos.querySelectorAll(
                    "[data-remote-id]"
                );


            for (
                const item of tiles
            ) {

                if (
                    item.dataset.remoteId ===
                    remoteSocketId
                ) {

                    tile =
                        item;

                    break;

                }

            }

        }


        if (
            tile
        ) {

            const video =
                tile.querySelector(
                    "video"
                );


            if (
                video
            ) {

                video.srcObject =
                    null;

            }


            tile.remove();

        }

    }


    updateParticipantCount();

    updateParticipantsList();

    updateEmptyState();

    updateVideoLayout();

}


/* =========================================================
   23. ICE RESTART
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


    if (
        peerConnection.connectionState ===
        "closed"
    ) {

        return;

    }


    /*
    Prevent multiple ICE restarts at the same time.
    */

    if (
        peerConnection.__iceRestarting
    ) {

        return;

    }


    peerConnection.__iceRestarting =
        true;


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


    } finally {

        peerConnection.__iceRestarting =
            false;

    }

}


/* =========================================================
   24. SAFE ADD ICE CANDIDATE
========================================================= */

async function addRemoteIceCandidate(
    remoteSocketId,
    candidate
) {

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


    if (
        !peerConnection
    ) {

        return;

    }


    /*
    If the remote description is not ready,
    queue the candidate.
    */

    if (
        !peerConnection.remoteDescription
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

        await peerConnection.addIceCandidate(
            new RTCIceCandidate(
                candidate
            )
        );


    } catch (error) {

        console.warn(
            "Could not add remote ICE candidate:",
            error
        );

    }

}


/* =========================================================
   25. UPDATE PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    if (
        !participantCount
    ) {

        return;

    }


    const count =
        Object.keys(
            participants
        ).length +
        1;


    participantCount.textContent =
        String(
            Math.max(
                1,
                count
            )
        );

}


/* =========================================================
   26. UPDATE EMPTY STATE
========================================================= */

function updateEmptyState() {

    if (
        !emptyState
    ) {

        return;

    }


    const count =
        Object.keys(
            participants
        ).length;


    if (
        count === 0
    ) {

        emptyState.style.display =
            "flex";

    } else {

        emptyState.style.display =
            "none";

    }

}


/* =========================================================
   27. UPDATE VIDEO LAYOUT
========================================================= */

function updateVideoLayout() {

    if (
        !remoteVideos
    ) {

        return;

    }


    const remoteCount =
        Object.keys(
            peerConnections
        ).length;


    remoteVideos.dataset.count =
        String(
            remoteCount
        );


    /*
    Let the existing CSS control the actual
    visual layout so the UI is not changed.
    */

    remoteVideos.classList.toggle(
        "has-participants",
        remoteCount > 0
    );

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


    /*
    Existing participants are already in the room.

    We are the new participant, so we create the
    offer for each existing participant.
    */

    for (
        const participant
            of list
    ) {

        let remoteSocketId =
            participant?.sid ||
            participant?.socket_id ||
            participant?.socketId ||
            participant?.id;


        let remoteName =
            participant?.name ||
            participant?.username ||
            participant?.user_name ||
            "Participant";


        /*
        Some Socket.IO servers may send only
        the socket ID.
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


        /*
        Ignore invalid participant entries.
        */

        if (
            !remoteSocketId
        ) {

            continue;

        }


        /*
        Never connect to ourselves.
        */

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
        Give the browser a moment to finish adding
        local tracks before creating the offer.
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


            if (
                socket &&
                socket.connected
            ) {

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

            }


        } catch (error) {

            console.error(
                "Offer creation failed:",
                error
            );

        }

    }


    updateParticipantsList();

    updateParticipantCount();

    updateEmptyState();

    updateVideoLayout();

}


/* =========================================================
   29. HANDLE NEW PARTICIPANT
========================================================= */

function handleUserJoined(
    data
) {

    console.log(
        "New participant joined:",
        data
    );


    const remoteSocketId =
        data?.sid ||
        data?.socket_id ||
        data?.socketId ||
        data?.id;


    const remoteName =
        data?.name ||
        data?.username ||
        data?.user_name ||
        "Participant";


    if (
        !remoteSocketId
    ) {

        console.warn(
            "user-joined event has no socket ID."
        );


        return;

    }


    /*
    Ignore ourselves.
    */

    if (
        socket &&
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
    Create the connection now.

    The existing participant will normally create
    the offer according to our signaling architecture.
    */

    createPeerConnection(
        remoteSocketId,
        remoteName
    );


    updateParticipantsList();

    updateParticipantCount();

    updateEmptyState();

    updateVideoLayout();


    showToast(
        "info",
        `${remoteName} joined the meeting.`
    );

}


/* =========================================================
   30. HANDLE USER LEFT
========================================================= */

function handleUserLeft(
    data
) {

    console.log(
        "Participant left:",
        data
    );


    const remoteSocketId =
        data?.sid ||
        data?.socket_id ||
        data?.socketId ||
        data?.id;


    if (
        !remoteSocketId
    ) {

        return;

    }


    const remoteName =
        participants[
            remoteSocketId
        ] ||
        data?.name ||
        "Participant";


    removeRemoteParticipant(
        remoteSocketId
    );


    showToast(
        "info",
        `${remoteName} left the meeting.`
    );

}


/* =========================================================
   31. HANDLE OFFER
========================================================= */

async function handleOffer(
    data
) {

    if (
        !data
    ) {

        return;

    }


    const offer =
        data.offer;


    const remoteSocketId =
        data.sid ||
        data.socket_id ||
        data.socketId ||
        data.sender ||
        data.from ||
        data.id;


    const remoteName =
        data.name ||
        data.username ||
        data.user_name ||
        "Participant";


    if (
        !offer ||
        !remoteSocketId
    ) {

        console.warn(
            "Invalid offer received:",
            data
        );


        return;

    }


    /*
    Ignore our own offer.
    */

    if (
        socket &&
        remoteSocketId ===
            socket.id
    ) {

        return;

    }


    console.log(
        "OFFER RECEIVED <-",
        remoteName,
        remoteSocketId
    );


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

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
                offer
            )
        );


        /*
        ICE candidates that arrived before
        the offer are now safe to add.
        */

        await flushPendingIceCandidates(
            remoteSocketId
        );


        /*
        Create answer.
        */

        const answer =
            await peerConnection.createAnswer({

                offerToReceiveAudio:
                    true,

                offerToReceiveVideo:
                    true

            });


        await peerConnection.setLocalDescription(
            answer
        );


        if (
            socket &&
            socket.connected
        ) {

            socket.emit(
                "answer",
                {

                    target:
                        remoteSocketId,

                    answer:
                        peerConnection.localDescription,

                    name:
                        userName

                }
            );


            console.log(
                "ANSWER SENT ->",
                remoteSocketId
            );

        }


    } catch (error) {

        console.error(
            "Offer handling failed:",
            error
        );


        /*
        Sometimes an old peer connection can get into
        a bad signaling state.

        Try to recover cleanly.
        */

        if (
            peerConnection.signalingState ===
            "closed"
        ) {

            removeRemoteParticipant(
                remoteSocketId
            );

        }

    }

}


/* =========================================================
   32. HANDLE ANSWER
========================================================= */

async function handleAnswer(
    data
) {

    if (
        !data
    ) {

        return;

    }


    const answer =
        data.answer;


    const remoteSocketId =
        data.sid ||
        data.socket_id ||
        data.socketId ||
        data.sender ||
        data.from ||
        data.id;


    const remoteName =
        data.name ||
        data.username ||
        data.user_name ||
        participants[
            remoteSocketId
        ] ||
        "Participant";


    if (
        !answer ||
        !remoteSocketId
    ) {

        console.warn(
            "Invalid answer received:",
            data
        );


        return;

    }


    if (
        socket &&
        remoteSocketId ===
            socket.id
    ) {

        return;

    }


    console.log(
        "ANSWER RECEIVED <-",
        remoteName,
        remoteSocketId
    );


    participants[
        remoteSocketId
    ] =
        remoteName;


    const peerConnection =
        peerConnections[
            remoteSocketId
        ] ||
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
        Ignore duplicate answers if the remote
        description has already been set.

        This helps avoid signaling-state errors.
        */

        if (
            peerConnection.signalingState !==
                "have-local-offer"
        ) {

            console.warn(
                "Ignoring answer because peer is not waiting for an answer:",
                peerConnection.signalingState
            );


            return;

        }


        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
                answer
            )
        );


        await flushPendingIceCandidates(
            remoteSocketId
        );


        updateRemoteVideoStatus(
            remoteSocketId,
            "Connected"
        );


    } catch (error) {

        console.error(
            "Answer handling failed:",
            error
        );

    }

}


/* =========================================================
   33. HANDLE ICE CANDIDATE
========================================================= */

async function handleIceCandidate(
    data
) {

    if (
        !data
    ) {

        return;

    }


    /*
    Different server implementations may call
    the sender field different things.

    Support all of the common forms.
    */

    const remoteSocketId =
        data.sid ||
        data.socket_id ||
        data.socketId ||
        data.sender ||
        data.from ||
        data.id;


    const candidate =
        data.candidate;


    if (
        !remoteSocketId ||
        !candidate
    ) {

        return;

    }


    if (
        socket &&
        remoteSocketId ===
            socket.id
    ) {

        return;

    }


    /*
    Make sure the peer connection exists.
    */

    const remoteName =
        participants[
            remoteSocketId
        ] ||
        data.name ||
        data.username ||
        "Participant";


    const peerConnection =
        peerConnections[
            remoteSocketId
        ] ||
        createPeerConnection(
            remoteSocketId,
            remoteName
        );


    if (
        !peerConnection
    ) {

        return;

    }


    await addRemoteIceCandidate(
        remoteSocketId,
        candidate
    );

}


/* =========================================================
   34. HANDLE SOCKET CONNECT
========================================================= */

function handleSocketConnect() {

    if (
        duplicateSessionLost ||
        hasLeftMeeting
    ) {

        return;

    }


    console.log(
        "========================================"
    );


    console.log(
        "SOCKET.IO CONNECTED"
    );


    console.log(
        "Socket ID:",
        socket?.id
    );


    console.log(
        "========================================"
    );


    updateConnectionStatus(
        "connected",
        "Connected"
    );


    /*
    The media should be initialized before joining
    so that local tracks are ready when offers are made.
    */

    if (
        !localStream
    ) {

        initializeMeeting()
            .then(
                function () {

                    attachLocalTrackSafety();

                    joinMeetingRoom();

                }
            )
            .catch(
                function (error) {

                    console.error(
                        "Media initialization after socket connection failed:",
                        error
                    );


                    joinMeetingRoom();

                }
            );

    } else {

        joinMeetingRoom();

    }

}


/* =========================================================
   35. HANDLE SOCKET DISCONNECT
========================================================= */

function handleSocketDisconnect(
    reason
) {

    console.warn(
        "SOCKET.IO DISCONNECTED:",
        reason
    );


    socketRoomJoined =
        false;


    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    updateConnectionStatus(
        "disconnected",
        "Reconnecting..."
    );


    /*
    Do NOT close all WebRTC connections here.

    Socket.IO can reconnect while existing WebRTC
    connections are still usable.
    */

}


/* =========================================================
   36. HANDLE SOCKET CONNECT ERROR
========================================================= */

function handleSocketConnectError(
    error
) {

    console.error(
        "SOCKET.IO CONNECTION ERROR:",
        error
    );


    socketRoomJoined =
        false;


    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    updateConnectionStatus(
        "error",
        "Connection error"
    );


    /*
    Do not destroy the local camera/microphone.

    Socket.IO may reconnect automatically.
    */

}


/* =========================================================
   37. HANDLE SOCKET RECONNECT
========================================================= */

function handleSocketReconnect(
    attemptNumber
) {

    console.log(
        "Socket.IO reconnected after attempt:",
        attemptNumber
    );


    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {

        return;

    }


    updateConnectionStatus(
        "connected",
        "Reconnected"
    );


    socketRoomJoined =
        false;


    /*
    Rejoin the meeting room.

    The server will tell us about the current participants.
    */

    setTimeout(
        function () {

            joinMeetingRoom();

        },
        300
    );

}


/* =========================================================
   38. REGISTER SOCKET EVENTS
========================================================= */

function registerSocketEvents() {

    if (
        !socket ||
        socketEventsRegistered
    ) {

        return;

    }


    socketEventsRegistered =
        true;


    /*
    ---------------------------------------------------------
    CONNECTION
    ---------------------------------------------------------
    */

    socket.on(
        "connect",
        handleSocketConnect
    );


    socket.on(
        "disconnect",
        handleSocketDisconnect
    );


    socket.on(
        "connect_error",
        handleSocketConnectError
    );


    socket.io?.on(
        "reconnect",
        handleSocketReconnect
    );


    /*
    ---------------------------------------------------------
    ROOM / PARTICIPANTS
    ---------------------------------------------------------
    */

    socket.on(
        "existing-participants",
        handleExistingParticipants
    );


    socket.on(
        "existing_participants",
        handleExistingParticipants
    );


    socket.on(
        "user-joined",
        handleUserJoined
    );


    socket.on(
        "user_joined",
        handleUserJoined
    );


    socket.on(
        "participant-joined",
        handleUserJoined
    );


    socket.on(
        "participant_joined",
        handleUserJoined
    );


    socket.on(
        "user-left",
        handleUserLeft
    );


    socket.on(
        "user_left",
        handleUserLeft
    );


    socket.on(
        "participant-left",
        handleUserLeft
    );


    socket.on(
        "participant_left",
        handleUserLeft
    );


    /*
    ---------------------------------------------------------
    WEBRTC SIGNALING
    ---------------------------------------------------------
    */

    socket.on(
        "offer",
        handleOffer
    );


    socket.on(
        "answer",
        handleAnswer
    );


    socket.on(
        "ice-candidate",
        handleIceCandidate
    );


    socket.on(
        "ice_candidate",
        handleIceCandidate
    );


    socket.on(
        "candidate",
        handleIceCandidate
    );


    /*
    ---------------------------------------------------------
    MEDIA STATE
    ---------------------------------------------------------
    */

    socket.on(
        "media-state",
        handleRemoteMediaState
    );


    socket.on(
        "media_state",
        handleRemoteMediaState
    );


    socket.on(
        "participant-media-state",
        handleRemoteMediaState
    );


    /*
    ---------------------------------------------------------
    CHAT
    ---------------------------------------------------------
    */

    socket.on(
        "chat-message",
        handleIncomingChatMessage
    );


    socket.on(
        "chat_message",
        handleIncomingChatMessage
    );


    socket.on(
        "receive-message",
        handleIncomingChatMessage
    );


    socket.on(
        "message",
        handleIncomingChatMessage
    );


    /*
    ---------------------------------------------------------
    ROOM ERROR
    ---------------------------------------------------------
    */

    socket.on(
        "room-error",
        function (data) {

            console.error(
                "Meeting room error:",
                data
            );


            showToast(
                "error",
                data?.message ||
                data?.error ||
                "Meeting room error."
            );

        }
    );


    socket.on(
        "error",
        function (data) {

            console.error(
                "Socket error:",
                data
            );

        }
    );


    console.log(
        "Socket.IO event handlers registered."
    );

}


/* =========================================================
   39. CREATE SOCKET
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


        showToast(
            "error",
            "Socket.IO client is unavailable."
        );


        return;

    }


    if (
        duplicateSessionLost ||
        hasLeftMeeting
    ) {

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

                    /*
                    IMPORTANT:

                    Use polling with the current
                    Flask-SocketIO / Render setup.

                    WebRTC media is NOT affected by this.
                    Camera, microphone and screen sharing
                    continue through WebRTC.
                    */

                    path:
                        "/socket.io/",

                    transports: [
                        "polling"
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
        Register events immediately after creating
        the Socket.IO object.
        */

        registerSocketEvents();


        console.log(
            "Socket.IO connection object created."
        );


    } catch (error) {

        console.error(
            "Socket creation failed:",
            error
        );


        socket =
            null;


        socketEventsRegistered =
            false;


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
   40. HANDLE REMOTE MEDIA STATE
========================================================= */

function handleRemoteMediaState(
    data
) {

    if (
        !data
    ) {

        return;

    }


    const remoteSocketId =
        data.sid ||
        data.socket_id ||
        data.socketId ||
        data.sender ||
        data.from ||
        data.id;


    if (
        !remoteSocketId
    ) {

        return;

    }


    if (
        socket &&
        remoteSocketId ===
            socket.id
    ) {

        return;

    }


    const microphone =
        data.microphone ??
        data.mic ??
        data.audio ??
        data.audioEnabled;


    const camera =
        data.camera ??
        data.video ??
        data.videoEnabled;


    /*
    Store the state on the participant object.
    */

    if (
        !participants[
            remoteSocketId
        ]
    ) {

        participants[
            remoteSocketId
        ] =
            data.name ||
            "Participant";

    }


    /*
    Find the participant tile.
    */

    if (
        !remoteVideos
    ) {

        return;

    }


    let tile =
        null;


    try {

        tile =
            remoteVideos.querySelector(
                `[data-remote-id="${CSS.escape(
                    remoteSocketId
                )}"]`
            );

    } catch (error) {

        const tiles =
            remoteVideos.querySelectorAll(
                "[data-remote-id]"
            );


        for (
            const item of tiles
        ) {

            if (
                item.dataset.remoteId ===
                remoteSocketId
            ) {

                tile =
                    item;

                break;

            }

        }

    }


    if (
        !tile
    ) {

        return;

    }


    /*
    If camera state is explicitly OFF,
    show the participant placeholder.
    */

    if (
        camera === false
    ) {

        const placeholder =
            tile.querySelector(
                ".remote-video-placeholder"
            );


        const video =
            tile.querySelector(
                "video.remote-video"
            );


        if (
            placeholder
        ) {

            placeholder.style.display =
                "flex";

        }


        if (
            video
        ) {

            video.style.display =
                "none";

        }

    } else if (
        camera === true
    ) {

        const stream =
            remoteStreams[
                remoteSocketId
            ];


        if (
            stream
        ) {

            updateRemoteVideoPlaceholder(
                remoteSocketId,
                stream
            );

        }

    }


    /*
    Update simple media indicators if they exist
    in the current participant tile.
    */

    const micIndicator =
        tile.querySelector(
            "[data-mic-status]"
        );


    if (
        micIndicator &&
        typeof microphone ===
            "boolean"
    ) {

        micIndicator.classList.toggle(
            "muted",
            !microphone
        );


        micIndicator.classList.toggle(
            "active",
            microphone
        );


        micIndicator.textContent =
            microphone
                ? "🎤"
                : "🔇";

    }


    const cameraIndicator =
        tile.querySelector(
            "[data-camera-status]"
        );


    if (
        cameraIndicator &&
        typeof camera ===
            "boolean"
    ) {

        cameraIndicator.classList.toggle(
            "muted",
            !camera
        );


        cameraIndicator.classList.toggle(
            "active",
            camera
        );


        cameraIndicator.textContent =
            camera
                ? "📹"
                : "🚫";

    }

}


/* =========================================================
   41. SEND LOCAL MEDIA STATE
========================================================= */

function sendLocalMediaState() {

    if (
        !socket ||
        !socket.connected
    ) {

        return;

    }


    const audioTrack =
        getLocalAudioTrack();


    const videoTrack =
        getLocalVideoTrack();


    const audioEnabled =
        Boolean(
            audioTrack &&
            audioTrack.enabled
        );


    const videoEnabled =
        Boolean(
            videoTrack &&
            videoTrack.enabled
        );


    microphoneEnabled =
        audioEnabled;


    cameraEnabled =
        videoEnabled;


    try {

        socket.emit(
            "media-state",
            {

                microphone:
                    audioEnabled,

                camera:
                    videoEnabled,

                mic:
                    audioEnabled,

                video:
                    videoEnabled,

                name:
                    userName

            }
        );


    } catch (error) {

        console.warn(
            "Could not send media state:",
            error
        );

    }

}


/* =========================================================
   42. SYNCHRONIZE LOCAL MEDIA STATE
========================================================= */

function synchronizeLocalMediaState() {

    const audioTrack =
        getLocalAudioTrack();


    const videoTrack =
        getLocalVideoTrack();


    microphoneEnabled =
        Boolean(
            audioTrack &&
            audioTrack.enabled
        );


    cameraEnabled =
        Boolean(
            videoTrack &&
            videoTrack.enabled
        );


    updateMicrophoneButton();

    updateCameraButton();


    sendLocalMediaState();

}


/* =========================================================
   43. INITIALIZE CHAT UI
========================================================= */

function initializeChatUI() {

    if (
        chatForm
    ) {

        /*
        Remove only our own previous listener.

        This prevents duplicate messages when the
        Socket.IO connection is recreated.
        */

        if (
            chatForm.__meetspaceSubmitHandler
        ) {

            chatForm.removeEventListener(
                "submit",
                chatForm.__meetspaceSubmitHandler
            );

        }


        const submitHandler =
            function (event) {

                event.preventDefault();

                sendChatMessage();

            };


        chatForm.__meetspaceSubmitHandler =
            submitHandler;


        chatForm.addEventListener(
            "submit",
            submitHandler
        );

    }


    if (
        chatInput
    ) {

        /*
        Enter sends the message.

        Shift + Enter creates a new line.
        */

        if (
            chatInput.__meetspaceKeyHandler
        ) {

            chatInput.removeEventListener(
                "keydown",
                chatInput.__meetspaceKeyHandler
            );

        }


        const keyHandler =
            function (event) {

                if (
                    event.key ===
                        "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendChatMessage();

                }

            };


        chatInput.__meetspaceKeyHandler =
            keyHandler;


        chatInput.addEventListener(
            "keydown",
            keyHandler
        );

    }

}


/* =========================================================
   44. SEND CHAT MESSAGE
========================================================= */

function sendChatMessage() {

    if (
        !chatInput
    ) {
        return;
    }


    const message =
        String(
            chatInput.value ||
            ""
        ).trim();


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


    if (
        hasLeftMeeting ||
        duplicateSessionLost
    ) {
        return;
    }


    /*
    Remember this message temporarily.

    If Flask-SocketIO sends the message back to
    this same client, the receiving function will
    recognize it and will NOT display it twice.
    */

    const localMessageKey =
        `${userName}::${message}`;


    pendingLocalChatMessages.set(
        localMessageKey,
        Date.now()
    );


    /*
    Display the message immediately.

    This makes the chat feel instant even if the
    server takes a moment to broadcast it.
    */

    appendChatMessage(
        userName,
        message,
        true,
        {
            timestamp:
                new Date().toISOString(),
            local:
                true
        }
    );


    /*
    Send the message to Flask-SocketIO.
    */

    const payload = {

        message:
            message,

        text:
            message,

        name:
            userName,

        username:
            userName,

        meeting_id:
            meetingId

    };


    try {

        socket.emit(
            "chat-message",
            payload
        );


        /*
        Clear the input after successful emit.
        */

        chatInput.value =
            "";


        chatInput.focus();


        console.log(
            "Chat message sent:",
            message
        );


        /*
        Remove the temporary duplicate
        protection after 10 seconds.
        */

        setTimeout(
            function () {

                pendingLocalChatMessages.delete(
                    localMessageKey
                );

            },
            10000
        );


    } catch (error) {

        console.error(
            "Failed to send chat message:",
            error
        );


        /*
        If sending fails, remove the
        temporary local record.
        */

        pendingLocalChatMessages.delete(
            localMessageKey
        );


        showToast(
            "error",
            "Could not send message."
        );

    }

}


/* =========================================================
   45. HANDLE INCOMING CHAT MESSAGE
========================================================= */

function handleIncomingChatMessage(
    data
) {

    if (
        !data
    ) {

        return;

    }


    /*
    Support the common payload formats used by
    Flask-SocketIO chat handlers.
    */

    const message =
        data.message ??
        data.text ??
        data.content ??
        "";


    if (
        !String(
            message
        ).trim()
    ) {

        return;

    }


    const sender =
        data.name ??
        data.username ??
        data.user_name ??
        data.sender_name ??
        "Participant";


    const senderId =
        data.sid ??
        data.socket_id ??
        data.socketId ??
        data.sender ??
        data.from ??
        "";


    /*
    Determine whether this is our own message.
    */

    const isOwnMessage =
        Boolean(
            (
                senderId &&
                socket &&
                senderId ===
                    socket.id
            ) ||
            (
                !senderId &&
                String(
                    sender
                ).trim() ===
                    String(
                        userName
                    ).trim()
            )
        );


    appendChatMessage(
        sender,
        String(
            message
        ),
        isOwnMessage,
        data
    );


    /*
    If chat is not currently open, increase unread count.
    */

    if (
        !isChatPanelOpen()
    ) {

        unreadChatCount++;


        updateUnreadChatCount();

    }

}


/* =========================================================
   46. APPEND CHAT MESSAGE
========================================================= */

function appendChatMessage(
    sender,
    message,
    isOwnMessage = false,
    data = null
) {

    if (
        !chatMessages
    ) {

        return;

    }


    /*
    Remove empty-state message only if one exists.
    */

    const emptyMessage =
        chatMessages.querySelector(
            ".chat-empty"
        );


    if (
        emptyMessage
    ) {

        emptyMessage.remove();

    }


    /*
    Message wrapper.
    */

    const messageWrapper =
        document.createElement(
            "div"
        );


    messageWrapper.className =
        "chat-message";


    messageWrapper.classList.add(
        isOwnMessage
            ? "own-message"
            : "received-message"
    );


    /*
    Sender name.
    */

    const senderElement =
        document.createElement(
            "div"
        );


    senderElement.className =
        "chat-sender";


    senderElement.textContent =
        isOwnMessage
            ? "You"
            : (
                sender ||
                "Participant"
            );


    /*
    Message text.

    textContent is intentionally used instead of
    innerHTML so chat messages cannot inject HTML.
    */

    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        "chat-message-text";


    messageElement.textContent =
        message;


    /*
    Timestamp.
    */

    const timeElement =
        document.createElement(
            "div"
        );


    timeElement.className =
        "chat-time";


    let timestamp =
        data?.timestamp ||
        data?.time ||
        null;


    let timeText =
        "";


    if (
        timestamp
    ) {

        const date =
            new Date(
                timestamp
            );


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            timeText =
                date.toLocaleTimeString(
                    [],
                    {
                        hour:
                            "2-digit",

                        minute:
                            "2-digit"
                    }
                );

        }

    }


    if (
        !timeText
    ) {

        timeText =
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

    }


    timeElement.textContent =
        timeText;


    messageWrapper.appendChild(
        senderElement
    );


    messageWrapper.appendChild(
        messageElement
    );


    messageWrapper.appendChild(
        timeElement
    );


    chatMessages.appendChild(
        messageWrapper
    );


    /*
    Always keep the newest message visible.
    */

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


/* =========================================================
   47. CHECK CHAT PANEL
========================================================= */

function isChatPanelOpen() {

    if (
        !meetingSidebar
    ) {

        return false;

    }


    /*
    The existing HTML starts the sidebar with
    the "hidden" class.

    The "open" class is the actual state used
    by the existing CSS to display the sidebar.

    Do not use computed display/visibility here
    because the sidebar uses transform-based
    opening and closing.
    */

    return meetingSidebar.classList.contains(
        "open"
    );

}


/* =========================================================
   48. UPDATE UNREAD CHAT COUNT
========================================================= */

function updateUnreadChatCount() {

    /*
    Support an existing unread badge if the HTML has one.
    */

    const badges =
        document.querySelectorAll(
            ".chat-unread-count, .unread-count, [data-chat-unread]"
        );


    badges.forEach(
        function (
            badge
        ) {

            if (
                unreadChatCount >
                0
            ) {

                badge.textContent =
                    String(
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
    );

}


/* =========================================================
   49. MARK CHAT AS READ
========================================================= */

function markChatAsRead() {

    unreadChatCount =
        0;


    updateUnreadChatCount();

}


/* =========================================================
   50. OPEN CHAT PANEL
========================================================= */

function openChatPanel() {

    if (
        !meetingSidebar
    ) {

        return;

    }


    /*
    IMPORTANT:

    meeting_room.html starts the sidebar with:

        class="meeting-sidebar hidden"

    The hidden class has pointer-events:none.

    Remove it when opening so the chat input,
    buttons and close button can receive mouse clicks.
    */

    meetingSidebar.classList.remove(
        "hidden"
    );


    /*
    Keep the existing sidebar UI.
    */

    meetingSidebar.classList.add(
        "open"
    );


    meetingSidebar.classList.add(
        "active"
    );


    meetingSidebar.classList.add(
        "show"
    );


    markChatAsRead();


    /*
    Put the cursor directly into the chat input.

    This allows the user to start typing immediately
    after opening Chat.
    */

    if (
        chatInput
    ) {

        setTimeout(
            function () {

                try {

                    chatInput.focus();

                } catch (error) {

                    console.warn(
                        "Could not focus chat input:",
                        error
                    );

                }

            },
            100
        );

    }

}

/* =========================================================
   51. CLOSE CHAT / SIDEBAR
========================================================= */

function closeMeetingSidebar() {

    if (
        !meetingSidebar
    ) {

        return;

    }


    /*
    Remove all active/open states.
    */

    meetingSidebar.classList.remove(
        "open"
    );


    meetingSidebar.classList.remove(
        "active"
    );


    meetingSidebar.classList.remove(
        "show"
    );


    /*
    Restore the original hidden state.

    This also disables pointer interaction with
    the hidden sidebar while it is closed.
    */

    meetingSidebar.classList.add(
        "hidden"
    );


    /*
    Remove focus from the chat input so the
    cursor does not remain active after closing.
    */

    if (
        chatInput &&
        document.activeElement ===
            chatInput
    ) {

        try {

            chatInput.blur();

        } catch (error) {}

    }

}

/* =========================================================
   52. TOGGLE CHAT
========================================================= */

function toggleChat() {

    if (
        isChatPanelOpen()
    ) {

        closeMeetingSidebar();

    } else {

        openChatPanel();

    }

}
/* =========================================================
   53. GET SCREEN SHARE TRACK
========================================================= */

function getScreenVideoTrack() {

    if (
        !screenStream
    ) {

        return null;

    }


    const tracks =
        screenStream.getVideoTracks();


    if (
        !tracks.length
    ) {

        return null;

    }


    return tracks[0];

}


/* =========================================================
   54. REPLACE VIDEO TRACK ON ALL PEERS
========================================================= */

async function replaceVideoTrackOnPeers(
    videoTrack
) {

    const peerIds =
        Object.keys(
            peerConnections
        );


    for (
        const remoteSocketId
            of peerIds
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


        if (
            peerConnection.connectionState ===
            "closed"
        ) {

            continue;

        }


        try {

            const videoSender =
                peerConnection
                    .getSenders()
                    .find(
                        function (
                            sender
                        ) {

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

                await videoSender.replaceTrack(
                    videoTrack ||
                    null
                );

            } else if (
                videoTrack &&
                localStream
            ) {

                /*
                If a video sender does not exist,
                add the track.

                This is mainly useful when the user
                started the meeting without camera.
                */

                peerConnection.addTrack(
                    videoTrack,
                    localStream
                );

            }

        } catch (error) {

            console.warn(
                "Could not replace video track for:",
                remoteSocketId,
                error
            );

        }

    }

}


/* =========================================================
   55. START SCREEN SHARING
========================================================= */

async function startScreenSharing() {

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


    if (
        screenStream
    ) {

        return;

    }


    try {

        console.log(
            "Starting screen sharing..."
        );


        /*
        Request screen video.

        Audio is requested only when supported.
        */

        screenStream =
            await navigator.mediaDevices
                .getDisplayMedia({

                    video: {

                        cursor:
                            "always",

                        frameRate: {
                            ideal: 30,
                            max: 30
                        }

                    },

                    audio:
                        false

                });


        const screenTrack =
            getScreenVideoTrack();


        if (
            !screenTrack
        ) {

            throw new Error(
                "Screen video track was not created."
            );

        }


        /*
        When the browser's "Stop sharing" button
        is pressed, this track ends.
        */

        screenTrack.onended =
            function () {

                stopScreenSharing();

            };


        /*
        Replace camera video with screen video
        for every remote participant.
        */

        await replaceVideoTrackOnPeers(
            screenTrack
        );


        /*
        Show the screen locally.

        The local video element displays the
        screen stream while sharing.
        */

        if (
            localVideo
        ) {

            localVideo.srcObject =
                screenStream;


            localVideo.muted =
                true;


            localVideo.style.display =
                "block";


            if (
                localPlaceholder
            ) {

                localPlaceholder.style.display =
                    "none";

            }


            try {

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

            } catch (error) {}

        }


        /*
        Screen sharing does not mean the camera
        itself is disabled.

        Remember the original camera state so that
        stopping screen share can restore it.
        */

        if (
            typeof window.__meetspaceCameraStateBeforeScreenShare ===
                "undefined"
        ) {

            window.__meetspaceCameraStateBeforeScreenShare =
                cameraEnabled;

        }


        /*
        Update button appearance without replacing
        the existing UI.
        */

        if (
            screenShareBtn
        ) {

            screenShareBtn.classList.add(
                "active"
            );


            screenShareBtn.setAttribute(
                "aria-pressed",
                "true"
            );


            screenShareBtn.title =
                "Stop sharing screen";

        }


        showToast(
            "success",
            "Screen sharing started."
        );


        console.log(
            "Screen sharing started."
        );

    } catch (error) {

        console.error(
            "Screen sharing failed:",
            error
        );


        /*
        User cancelling the browser picker is not
        really an application error.
        */

        if (
            error?.name ===
                "NotAllowedError"
        ) {

            console.log(
                "Screen sharing was cancelled."
            );

        } else {

            showToast(
                "error",
                "Unable to start screen sharing."
            );

        }


        if (
            screenStream
        ) {

            stopAllMediaTracks(
                screenStream
            );


            screenStream =
                null;

        }

    }

}


/* =========================================================
   56. STOP SCREEN SHARING
========================================================= */

async function stopScreenSharing() {

    if (
        !screenStream
    ) {

        return;

    }


    console.log(
        "Stopping screen sharing..."
    );


    /*
    Stop the screen capture tracks.
    */

    stopAllMediaTracks(
        screenStream
    );


    screenStream =
        null;


    /*
    Restore the camera track.

    IMPORTANT:
    We do not request the camera again if a camera
    track already exists.

    This prevents unnecessary permission popups.
    */

    const cameraTrack =
        getLocalVideoTrack();


    if (
        cameraTrack
    ) {

        /*
        Restore the previous camera state.
        */

        const previousCameraState =
            typeof window.__meetspaceCameraStateBeforeScreenShare !==
                "undefined"
                ? window.__meetspaceCameraStateBeforeScreenShare
                : cameraEnabled;


        cameraTrack.enabled =
            Boolean(
                previousCameraState
            );


        cameraEnabled =
            cameraTrack.enabled;


        await replaceVideoTrackOnPeers(
            cameraTrack
        );


        setLocalVideoStream(
            localStream,
            cameraEnabled
        );


    } else {

        /*
        There was no camera before screen sharing.

        Remove the video track from remote peer connections.
        */

        await replaceVideoTrackOnPeers(
            null
        );


        setLocalVideoStream(
            localStream,
            false
        );


        cameraEnabled =
            false;

    }


    /*
    Clear the remembered state.
    */

    try {

        delete window.__meetspaceCameraStateBeforeScreenShare;

    } catch (error) {

        window.__meetspaceCameraStateBeforeScreenShare =
            undefined;

    }


    /*
    Restore screen-share button.
    */

    if (
        screenShareBtn
    ) {

        screenShareBtn.classList.remove(
            "active"
        );


        screenShareBtn.setAttribute(
            "aria-pressed",
            "false"
        );


        screenShareBtn.title =
            "Share screen";

    }


    updateCameraButton();

    synchronizeLocalMediaState();


    showToast(
        "info",
        "Screen sharing stopped."
    );


    console.log(
        "Screen sharing stopped."
    );

}


/* =========================================================
   57. TOGGLE SCREEN SHARING
========================================================= */

async function toggleScreenSharing() {

    if (
        screenStream
    ) {

        await stopScreenSharing();

    } else {

        await startScreenSharing();

    }

}


/* =========================================================
   58. INITIALIZE SCREEN SHARE BUTTON
========================================================= */

function initializeScreenShareButton() {

    if (
        !screenShareBtn
    ) {

        return;

    }


    /*
    Remove our previous listener if the function
    happens to be called more than once.
    */

    if (
        screenShareBtn.__meetspaceScreenHandler
    ) {

        screenShareBtn.removeEventListener(
            "click",
            screenShareBtn.__meetspaceScreenHandler
        );

    }


    const handler =
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            toggleScreenSharing();

        };


    screenShareBtn.__meetspaceScreenHandler =
        handler;


    screenShareBtn.addEventListener(
        "click",
        handler
    );


    screenShareBtn.setAttribute(
        "aria-pressed",
        "false"
    );

}


/* =========================================================
   59. UPDATE PARTICIPANTS LIST
========================================================= */

function updateParticipantsList() {

    if (
        !participantsList
    ) {

        return;

    }


    /*
    Clear the current list.

    The surrounding UI remains unchanged.
    */

    participantsList.innerHTML =
        "";


    /*
    Add ourselves first.
    */

    const localItem =
        document.createElement(
            "div"
        );


    localItem.className =
        "participant-item";


    localItem.dataset.participantId =
        socket?.id ||
        "local";


    const localAvatar =
        document.createElement(
            "div"
        );


    localAvatar.className =
        "participant-avatar";


    localAvatar.textContent =
        String(
            userName ||
            "Y"
        )
            .charAt(0)
            .toUpperCase();


    const localInfo =
        document.createElement(
            "div"
        );


    localInfo.className =
        "participant-info";


    const localName =
        document.createElement(
            "div"
        );


    localName.className =
        "participant-name";


    localName.textContent =
        `${userName || "You"} (You)`;


    const localStatus =
        document.createElement(
            "div"
        );


    localStatus.className =
        "participant-status";


    localStatus.textContent =
        "Connected";


    localInfo.appendChild(
        localName
    );


    localInfo.appendChild(
        localStatus
    );


    localItem.appendChild(
        localAvatar
    );


    localItem.appendChild(
        localInfo
    );


    participantsList.appendChild(
        localItem
    );


    /*
    Add remote participants.
    */

    Object.keys(
        participants
    ).forEach(
        function (
            remoteSocketId
        ) {

            const remoteName =
                participants[
                    remoteSocketId
                ] ||
                "Participant";


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "participant-item";


            item.dataset.participantId =
                remoteSocketId;


            const avatar =
                document.createElement(
                    "div"
                );


            avatar.className =
                "participant-avatar";


            avatar.textContent =
                String(
                    remoteName
                )
                    .charAt(0)
                    .toUpperCase();


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "participant-info";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "participant-name";


            name.textContent =
                remoteName;


            const status =
                document.createElement(
                    "div"
                );


            status.className =
                "participant-status";


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (
                peerConnection &&
                peerConnection.connectionState ===
                    "connected"
            ) {

                status.textContent =
                    "Connected";

            } else if (
                peerConnection
            ) {

                status.textContent =
                    "Connecting...";

            } else {

                status.textContent =
                    "Joining...";

            }


            info.appendChild(
                name
            );


            info.appendChild(
                status
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
    );


    updateParticipantCount();

}


/* =========================================================
   60. OPEN PARTICIPANTS PANEL
========================================================= */

function openParticipantsPanel() {

    if (
        !meetingSidebar
    ) {

        return;

    }


    meetingSidebar.classList.add(
        "open"
    );


    meetingSidebar.classList.add(
        "active"
    );


    meetingSidebar.classList.add(
        "show"
    );


    updateParticipantsList();

}


/* =========================================================
   61. TOGGLE PARTICIPANTS PANEL
========================================================= */

function toggleParticipantsPanel() {

    if (
        isChatPanelOpen()
    ) {

        closeMeetingSidebar();

    } else {

        openParticipantsPanel();

    }

}


/* =========================================================
   62. INITIALIZE SIDEBAR BUTTONS
========================================================= */

function initializeSidebarButtons() {

    /*
    Chat button.
    */

    const chatButtons = [
        chatBtn,
        meetingChatBtn
    ];


    chatButtons.forEach(
        function (
            button
        ) {

            if (
                !button
            ) {

                return;

            }


            if (
                button.__meetspaceChatHandler
            ) {

                button.removeEventListener(
                    "click",
                    button.__meetspaceChatHandler
                );

            }


            const handler =
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();

                    openChatPanel();

                };


            button.__meetspaceChatHandler =
                handler;


            button.addEventListener(
                "click",
                handler
            );

        }
    );


    /*
    Participants buttons.
    */

    const participantButtons = [
        participantsBtn,
        meetingParticipantsBtn
    ];


    participantButtons.forEach(
        function (
            button
        ) {

            if (
                !button
            ) {

                return;

            }


            if (
                button.__meetspaceParticipantsHandler
            ) {

                button.removeEventListener(
                    "click",
                    button.__meetspaceParticipantsHandler
                );

            }


            const handler =
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();

                    openParticipantsPanel();

                };


            button.__meetspaceParticipantsHandler =
                handler;


            button.addEventListener(
                "click",
                handler
            );

        }
    );


    /*
    Sidebar close button.
    */

    if (
        sidebarClose
    ) {

        if (
            sidebarClose.__meetspaceCloseHandler
        ) {

            sidebarClose.removeEventListener(
                "click",
                sidebarClose.__meetspaceCloseHandler
            );

        }


        const closeHandler =
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                closeMeetingSidebar();

            };


        sidebarClose.__meetspaceCloseHandler =
            closeHandler;


        sidebarClose.addEventListener(
            "click",
            closeHandler
        );

    }

}


/* =========================================================
   63. INITIALIZE MEDIA BUTTONS
========================================================= */

function initializeMediaButtons() {

    /*
    ---------------------------------------------------------
    MICROPHONE
    ---------------------------------------------------------
    */

    if (
        micBtn
    ) {

        if (
            micBtn.__meetspaceMicHandler
        ) {

            micBtn.removeEventListener(
                "click",
                micBtn.__meetspaceMicHandler
            );

        }


        const micHandler =
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                toggleMicrophone();

            };


        micBtn.__meetspaceMicHandler =
            micHandler;


        micBtn.addEventListener(
            "click",
            micHandler
        );

    }


    /*
    ---------------------------------------------------------
    CAMERA
    ---------------------------------------------------------
    */

    if (
        cameraBtn
    ) {

        if (
            cameraBtn.__meetspaceCameraHandler
        ) {

            cameraBtn.removeEventListener(
                "click",
                cameraBtn.__meetspaceCameraHandler
            );

        }


        const cameraHandler =
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                toggleCamera();

            };


        cameraBtn.__meetspaceCameraHandler =
            cameraHandler;


        cameraBtn.addEventListener(
            "click",
            cameraHandler
        );

    }


    updateMicrophoneButton();

    updateCameraButton();

}


/* =========================================================
   64. INITIALIZE ALL UI EVENTS
========================================================= */

function initializeUIEvents() {

    initializeMediaButtons();

    initializeScreenShareButton();

    initializeSidebarButtons();

    initializeChatUI();

}

/* =========================================================
   65. CLOSE ALL PEER CONNECTIONS
========================================================= */

function closeAllPeerConnections() {

    Object.keys(
        peerConnections
    ).forEach(
        function (
            remoteSocketId
        ) {

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

                    peerConnection.onnegotiationneeded =
                        null;


                    peerConnection.close();

                } catch (error) {

                    console.warn(
                        "Could not close peer connection:",
                        error
                    );

                }

            }


            delete peerConnections[
                remoteSocketId
            ];

        }
    );


    /*
    Clear all WebRTC state.
    */

    Object.keys(
        pendingIceCandidates
    ).forEach(
        function (
            remoteSocketId
        ) {

            delete pendingIceCandidates[
                remoteSocketId
            ];

        }
    );


    Object.keys(
        remoteStreams
    ).forEach(
        function (
            remoteSocketId
        ) {

            const stream =
                remoteStreams[
                    remoteSocketId
                ];


            if (
                stream
            ) {

                stopAllMediaTracks(
                    stream
                );

            }


            delete remoteStreams[
                remoteSocketId
            ];

        }
    );


    Object.keys(
        participants
    ).forEach(
        function (
            remoteSocketId
        ) {

            delete participants[
                remoteSocketId
            ];

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
                "[data-remote-id]"
            )
            .forEach(
                function (
                    tile
                ) {

                    const video =
                        tile.querySelector(
                            "video"
                        );


                    if (
                        video
                    ) {

                        video.srcObject =
                            null;

                    }


                    tile.remove();

                }
            );

    }


    updateParticipantCount();

    updateParticipantsList();

    updateEmptyState();

    updateVideoLayout();

}


/* =========================================================
   66. STOP SCREEN SHARE SAFELY
========================================================= */

function cleanupScreenShare() {

    if (
        screenStream
    ) {

        stopAllMediaTracks(
            screenStream
        );


        screenStream =
            null;

    }


    if (
        screenShareBtn
    ) {

        screenShareBtn.classList.remove(
            "active"
        );


        screenShareBtn.setAttribute(
            "aria-pressed",
            "false"
        );


        screenShareBtn.title =
            "Share screen";

    }

}


/* =========================================================
   67. CLEANUP LOCAL VIDEO
========================================================= */

function cleanupLocalVideo() {

    if (
        localVideo
    ) {

        try {

            localVideo.pause();

        } catch (error) {}


        localVideo.srcObject =
            null;

    }


    if (
        localPlaceholder
    ) {

        localPlaceholder.style.display =
            "flex";

    }

}


/* =========================================================
   68. LEAVE MEETING
========================================================= */

function leaveMeeting(
    redirect = true
) {

    if (
        hasLeftMeeting
    ) {

        /*
        If already leaving, simply redirect if
        the caller explicitly requested it.
        */

        if (
            redirect
        ) {

            redirectAfterLeave();

        }


        return;

    }


    console.log(
        "Leaving MeetSpace meeting..."
    );


    hasLeftMeeting =
        true;


    socketRoomJoined =
        false;


    /*
    ---------------------------------------------------------
    STOP SCREEN SHARE
    ---------------------------------------------------------
    */

    cleanupScreenShare();


    /*
    ---------------------------------------------------------
    STOP LOCAL CAMERA + MICROPHONE
    ---------------------------------------------------------
    */

    stopLocalMedia();


    /*
    ---------------------------------------------------------
    CLOSE REMOTE WEBRTC CONNECTIONS
    ---------------------------------------------------------
    */

    closeAllPeerConnections();


    /*
    ---------------------------------------------------------
    TELL SERVER WE ARE LEAVING
    ---------------------------------------------------------
    */

    if (
        socket
    ) {

        try {

            if (
                socket.connected
            ) {

                socket.emit(
                    "leave-meeting",
                    {

                        meeting_id:
                            meetingId,

                        name:
                            userName

                    }
                );

            }

        } catch (error) {

            console.warn(
                "Could not send leave event:",
                error
            );

        }

    }


    /*
    ---------------------------------------------------------
    DISCONNECT SOCKET
    ---------------------------------------------------------
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


        socket =
            null;

    }


    socketEventsRegistered =
        false;


    socketInitialized =
        false;


    /*
    ---------------------------------------------------------
    RELEASE DUPLICATE SESSION LOCK
    ---------------------------------------------------------
    */

    releaseDuplicateSessionLock();


    /*
    ---------------------------------------------------------
    CLEAN LOCAL VIDEO
    ---------------------------------------------------------
    */

    cleanupLocalVideo();


    /*
    ---------------------------------------------------------
    UPDATE STATUS
    ---------------------------------------------------------
    */

    updateConnectionStatus(
        "disconnected",
        "Meeting ended"
    );


    /*
    Redirect after cleanup.
    */

    if (
        redirect
    ) {

        redirectAfterLeave();

    }

}


/* =========================================================
   69. REDIRECT AFTER LEAVING
========================================================= */

function redirectAfterLeave() {

    /*
    Keep the existing application's navigation.

    Prefer the server-provided meeting home/login
    URL if available in the page.
    */

    const redirectElement =
        document.querySelector(
            "[data-leave-redirect]"
        );


    if (
        redirectElement &&
        redirectElement.dataset.leaveRedirect
    ) {

        window.location.href =
            redirectElement.dataset.leaveRedirect;


        return;

    }


    /*
    If a global URL was provided by the template,
    use it.
    */

    if (
        window.MEETSPACE_LEAVE_URL
    ) {

        window.location.href =
            window.MEETSPACE_LEAVE_URL;


        return;

    }


    /*
    Default fallback.

    This keeps the user inside the MeetSpace application.
    */

    window.location.href =
        "/meeting/";

}


/* =========================================================
   70. INITIALIZE LEAVE BUTTONS
========================================================= */

function initializeLeaveButtons() {

    const leaveButtons = [

        leaveMeetingBtn,

        leaveMeetingBtn2

    ];


    leaveButtons.forEach(
        function (
            button
        ) {

            if (
                !button
            ) {

                return;

            }


            if (
                button.__meetspaceLeaveHandler
            ) {

                button.removeEventListener(
                    "click",
                    button.__meetspaceLeaveHandler
                );

            }


            const handler =
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();


                    /*
                    Ask for confirmation only when
                    the browser supports it.

                    This does not change the UI.
                    */

                    let shouldLeave =
                        true;


                    try {

                        shouldLeave =
                            window.confirm(
                                "Are you sure you want to leave the meeting?"
                            );

                    } catch (error) {

                        shouldLeave =
                            true;

                    }


                    if (
                        shouldLeave
                    ) {

                        leaveMeeting(
                            true
                        );

                    }

                };


            button.__meetspaceLeaveHandler =
                handler;


            button.addEventListener(
                "click",
                handler
            );

        }
    );

}


/* =========================================================
   71. BEFORE UNLOAD CLEANUP
========================================================= */

function handleBeforeUnload() {

    /*
    Do not attempt a normal redirect here.

    Just release local resources and notify the server
    if the Socket.IO connection is still available.
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


    cleanupScreenShare();

    stopLocalMedia();

    closeAllPeerConnections();

    releaseDuplicateSessionLock();

}


/* =========================================================
   72. PAGE VISIBILITY CHANGE
========================================================= */

function handleVisibilityChange() {

    if (
        document.visibilityState ===
            "visible"
    ) {

        /*
        When the tab becomes visible again,
        make sure the local video remains playable.
        */

        if (
            localVideo &&
            localVideo.srcObject &&
            cameraEnabled
        ) {

            try {

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

            } catch (error) {}

        }


        /*
        If Socket.IO was disconnected while the
        tab was sleeping, allow its own reconnection
        mechanism to work.
        */

        if (
            socket &&
            !socket.connected &&
            !hasLeftMeeting &&
            !duplicateSessionLost
        ) {

            try {

                socket.connect();

            } catch (error) {

                console.warn(
                    "Socket reconnect request failed:",
                    error
                );

            }

        }

    }

}


/* =========================================================
   73. WINDOW ONLINE / OFFLINE
========================================================= */

function initializeNetworkEvents() {

    window.addEventListener(
        "online",
        function () {

            console.log(
                "Network connection restored."
            );


            if (
                !hasLeftMeeting &&
                !duplicateSessionLost
            ) {

                updateConnectionStatus(
                    "connecting",
                    "Reconnecting..."
                );


                if (
                    socket &&
                    !socket.connected
                ) {

                    try {

                        socket.connect();

                    } catch (error) {

                        console.warn(
                            "Could not reconnect Socket.IO:",
                            error
                        );

                    }

                }

            }

        }
    );


    window.addEventListener(
        "offline",
        function () {

            console.warn(
                "Network connection lost."
            );


            if (
                !hasLeftMeeting &&
                !duplicateSessionLost
            ) {

                updateConnectionStatus(
                    "error",
                    "No internet connection"
                );

            }

        }
    );

}


/* =========================================================
   74. PREVENT ACCIDENTAL PAGE CLOSE
========================================================= */

function initializePageLifecycle() {

    window.addEventListener(
        "beforeunload",
        handleBeforeUnload
    );


    document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
    );


    initializeNetworkEvents();

}


/* =========================================================
   75. DISABLE BUTTONS WHILE CONNECTING
========================================================= */

function setMeetingControlsEnabled(
    enabled
) {

    const controls = [

        micBtn,

        cameraBtn,

        screenShareBtn

    ];


    controls.forEach(
        function (
            button
        ) {

            if (
                !button
            ) {

                return;

            }


            /*
            Do not permanently disable controls.

            Camera/mic should remain usable even if
            Socket.IO is reconnecting.

            Therefore only remove a temporary state
            that this function may have applied.
            */

            button.classList.toggle(
                "meeting-controls-disabled",
                !enabled
            );

        }
    );

}


/* =========================================================
   76. MEETING STARTUP STATE
========================================================= */

function setInitialMeetingState() {

    updateConnectionStatus(
        "connecting",
        "Connecting..."
    );


    updateParticipantCount();

    updateParticipantsList();

    updateEmptyState();

    updateUnreadChatCount();


    setMeetingControlsEnabled(
        true
    );


    /*
    If media is already available, synchronize
    the button states.
    */

    synchronizeLocalMediaState();

}


/* =========================================================
   77. HANDLE PAGE ERROR
========================================================= */

function initializeErrorLogging() {

    window.addEventListener(
        "error",
        function (event) {

            /*
            Do not break the meeting because of
            an unrelated UI error.

            Only log it.
            */

            console.error(
                "MeetSpace browser error:",
                event.error ||
                event.message
            );

        }
    );


    window.addEventListener(
        "unhandledrejection",
        function (event) {

            console.error(
                "MeetSpace promise error:",
                event.reason
            );

        }
    );

}


/* =========================================================
   78. CHECK BROWSER SUPPORT
========================================================= */

function checkBrowserSupport() {

    const supported =
        Boolean(
            window.RTCPeerConnection &&
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            window.WebSocket
        );


    if (
        !supported
    ) {

        console.error(
            "MeetSpace: browser does not support all required APIs."
        );


        showToast(
            "error",
            "Your browser does not support all meeting features."
        );


        return false;

    }


    return true;

}


/* =========================================================
   79. PREPARE MEETING
========================================================= */

async function prepareMeeting() {

    if (
        meetingInitialized
    ) {

        return;

    }


    meetingInitialized =
        true;


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
            "Unable to identify this meeting."
        );


        return;

    }


    if (
        duplicateSessionLost
    ) {

        return;

    }


    /*
    Browser support check.
    */

    if (
        !checkBrowserSupport()
    ) {

        return;

    }


    /*
    Set initial UI state.
    */

    setInitialMeetingState();


    /*
    Initialize duplicate-session protection
    BEFORE opening Socket.IO.
    */

    initializeDuplicateSessionProtection();


    if (
        duplicateSessionLost
    ) {

        return;

    }


    /*
    Initialize UI event listeners.
    */

    initializeUIEvents();


    /*
    Leave controls.
    */

    initializeLeaveButtons();


    /*
    Browser lifecycle.
    */

    initializePageLifecycle();


    /*
    Error logging.
    */

    initializeErrorLogging();


    /*
    Initialize camera/microphone first.

    This makes sure WebRTC peer connections have
    local tracks ready before offers are created.
    */

    try {

        await initializeMeeting();

        attachLocalTrackSafety();

    } catch (error) {

        console.error(
            "Initial media setup failed:",
            error
        );

    }


    /*
    Finally initialize Socket.IO.

    The Socket.IO client has already been loaded
    by meeting_room.html from the CDN.
    */

    await initializeSocket();


    /*
    If the socket connected before media was ready,
    handleSocketConnect() will finish the join process.
    */

}

/* =========================================================
   80. DOM READY STARTUP
========================================================= */

function startMeetSpaceMeeting() {

    /*
    Prevent the meeting from being initialized twice.
    */

    if (
        window.__meetspaceStarted
    ) {

        console.log(
            "MeetSpace meeting is already started."
        );


        return;

    }


    window.__meetspaceStarted =
        true;


    console.log(
        "========================================"
    );


    console.log(
        "Starting MeetSpace meeting..."
    );


    console.log(
        "Meeting ID:",
        meetingId
    );


    console.log(
        "Participant:",
        userName
    );


    console.log(
        "========================================"
    );


    /*
    Start the complete meeting initialization.
    */

    prepareMeeting()
        .then(
            function () {

                console.log(
                    "MeetSpace meeting initialization completed."
                );

            }
        )
        .catch(
            function (error) {

                console.error(
                    "MeetSpace meeting initialization failed:",
                    error
                );


                updateConnectionStatus(
                    "error",
                    "Meeting initialization failed"
                );


                showToast(
                    "error",
                    "Unable to initialize the meeting."
                );

            }
        );

}


/* =========================================================
   81. DOM CONTENT LOADED
========================================================= */

if (
    document.readyState ===
        "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startMeetSpaceMeeting,
        {
            once:
                true
        }
    );

} else {

    /*
    meeting.js was loaded after the DOM
    was already ready.
    */

    startMeetSpaceMeeting();

}


/* =========================================================
   82. PAGE LOAD SAFETY
========================================================= */

window.addEventListener(
    "load",
    function () {

        /*
        If DOMContentLoaded somehow did not start
        the application, make one final safe attempt.

        The global flag prevents duplicate initialization.
        */

        if (
            !window.__meetspaceStarted
        ) {

            startMeetSpaceMeeting();

        }

    },
    {
        once:
            true
    }
);


/* =========================================================
   83. GLOBAL MEETSPACE API
========================================================= */

/*
Expose only the functions that may be useful to
existing inline HTML handlers or other scripts.

This does NOT change the UI.
*/

window.MeetSpace =
    window.MeetSpace ||
    {};


window.MeetSpace.toggleMicrophone =
    toggleMicrophone;


window.MeetSpace.toggleCamera =
    toggleCamera;


window.MeetSpace.toggleScreenSharing =
    toggleScreenSharing;


window.MeetSpace.startScreenSharing =
    startScreenSharing;


window.MeetSpace.stopScreenSharing =
    stopScreenSharing;


window.MeetSpace.sendChatMessage =
    sendChatMessage;


window.MeetSpace.leaveMeeting =
    leaveMeeting;


window.MeetSpace.toggleChat =
    toggleChat;


window.MeetSpace.updateParticipantsList =
    updateParticipantsList;


/* =========================================================
   84. GLOBAL COMPATIBILITY ALIASES
========================================================= */

/*
Some existing HTML/older code may call these functions
directly.

Keep the aliases so existing functionality continues
to work.
*/

window.toggleMicrophone =
    toggleMicrophone;


window.toggleMic =
    toggleMicrophone;


window.toggleCamera =
    toggleCamera;


window.toggleScreenSharing =
    toggleScreenSharing;


window.startScreenSharing =
    startScreenSharing;


window.stopScreenSharing =
    stopScreenSharing;


window.sendChatMessage =
    sendChatMessage;


window.leaveMeeting =
    leaveMeeting;


/* =========================================================
   85. FINAL INITIAL STATE
========================================================= */

try {

    updateMicrophoneButton();

    updateCameraButton();

    updateParticipantCount();

    updateEmptyState();

    updateUnreadChatCount();

} catch (error) {

    console.warn(
        "Initial UI state update failed:",
        error
    );

}


/* =========================================================
   86. MEETSPACE CLIENT READY
========================================================= */

console.log(
    "========================================"
);

console.log(
    "MeetSpace meeting.js loaded successfully."
);

console.log(
    "Socket.IO client will be provided by meeting_room.html."
);

console.log(
    "WebRTC media remains independent from Socket.IO."
);

console.log(
    "========================================"
);