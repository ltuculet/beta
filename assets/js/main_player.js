// Configuration
const APP_CONFIG = {
    streamUrl: "https://radiostreamingserver.com.ar/proxy/hypersonica/stream",
    apiUrl: "https://radiostreamingserver.com.ar:2199/rpc/hypersonica/streaminfo.get"
};

// Part 1: Metadata fetching
setInterval(() => {
    $.getJSON(APP_CONFIG.apiUrl, function (apidata) {
        let tema = apidata.data[0].song;
        let imageurl = apidata.data[0].track.imageurl;

        const fondo = document.getElementById('fondo');
        const caratulax = document.getElementById('caratula');
        const temax = document.getElementById('tema');

        const placeholderSrc = "img/nocover.png"; // Define placeholder path

        if (caratulax && !caratulax.dataset.onerrorAttached) {
            caratulax.onerror = function() {
                console.warn("Error loading image:", this.src, "Reverting to placeholder.");
                this.src = placeholderSrc;
            };
            caratulax.dataset.onerrorAttached = 'true'; // Mark as attached
        }

        if (fondo) {
            if (imageurl && imageurl.trim() !== "") {
                fondo.src = imageurl;
            } else {
                // Optionally set a default background or leave as is
                // fondo.src = placeholderSrc; // If you want placeholder for background too
            }
        }

        if (caratulax) {
            if (imageurl && imageurl.trim() !== "") {
                // Only change src if it's different to avoid reload flicker if URL is same
                if (caratulax.src !== imageurl) {
                    caratulax.src = imageurl;
                }
            } else {
                if (caratulax.src !== placeholderSrc) {
                    caratulax.src = placeholderSrc;
                }
            }
        }

        if (temax) temax.innerText = tema;

    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.error("Error fetching stream info:", textStatus, errorThrown);
        const temax = document.getElementById('tema');
        const caratulax = document.getElementById('caratula');
        const placeholderSrc = "img/nocover.png";

        if (temax) {
            temax.innerText = "Track info unavailable";
        }
        if (caratulax && caratulax.src !== placeholderSrc) {
            caratulax.src = placeholderSrc; // Revert to placeholder on API fail
        }
        // Also consider setting fondo.src to a placeholder if API fails
        // const fondo = document.getElementById('fondo');
        // if (fondo && fondo.src !== placeholderSrc) fondo.src = placeholderSrc;

        const streamStatus = document.getElementById('stream-status');
        if (streamStatus) {
            streamStatus.innerText = "Cannot load track data.";
        }
    });
}, 300);

// Part 2: Audio element setup
const audio = new Audio();
audio.src = APP_CONFIG.streamUrl;

// Part 3: Player button and Lottie setup & event listener
const player = document.getElementById('player');
const icono = document.getElementById('icon-player');
const lottieContainer = document.getElementById('lottie');
let lottiePlayer = null;
if (lottieContainer) {
    lottiePlayer = lottieContainer.querySelector('lottie-player');
}

if (player && icono) { // Ensure player and icon elements exist before adding listener
    player.addEventListener('click', function () {
        if (audio.paused) {
            audio.play();
            icono.classList.remove('fa-circle-play');
            icono.classList.add('fa-circle-pause');
            if (lottiePlayer) {
                lottiePlayer.play();
            }
        } else {
            audio.pause();
            icono.classList.add('fa-circle-play');
            icono.classList.remove('fa-circle-pause');
            if (lottiePlayer) {
                lottiePlayer.pause();
            }
        }
    });
}

// Part 4: Stream Status Feedback
const streamStatusEl = document.getElementById('stream-status');
if (streamStatusEl) {
    audio.addEventListener('error', function(e) {
        console.error('Audio Error:', audio.error); // Log the actual error object
        streamStatusEl.innerText = 'Stream error. Please try again later.';
    });
    audio.addEventListener('stalled', function() {
        console.warn('Audio Stalled: Browser is trying to get media data, but data is unexpectedly not forthcoming.');
        streamStatusEl.innerText = 'Stream stalled. Buffering issues...';
    });
    audio.addEventListener('waiting', function() {
        console.info('Audio Waiting: Playback has stopped because of a temporary lack of data.');
        streamStatusEl.innerText = 'Buffering...';
    });
    audio.addEventListener('playing', function() {
        streamStatusEl.innerText = ''; // Clear status when playing
    });
    audio.addEventListener('pause', function() {
        // This event also fires when audio stops due to error/end.
        // Only show "Paused" if it's a user-initiated pause and not an error state.
        // Current decision: keep status clear on user pause to avoid confusion.
        if (audio.readyState >= 2 && !audio.error && !audio.ended) {
            // streamStatusEl.innerText = 'Paused';
        }
    });
    audio.addEventListener('ended', function() {
        streamStatusEl.innerText = 'Stream ended.';
    });
}
