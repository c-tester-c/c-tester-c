const DEFAULT_AUTHOR = "Lux.io Music";

const musicData = [
    {
        title: "Garacias a Dios hay Chamba",
        img: "https://i.pinimg.com/736x/47/dd/0b/47dd0bc9355f6a01608eee68e5cc021c.jpg",
        author: "Dani Chalán",
        audio: "https://files.catbox.moe/530yy1.mp3",
        lyrics: "https://luxiodev93.github.io/lyrics/haychamba.txt",
        coments: "https://luxiodev93.github.io/lyrics/haychamba_coments.txt" // <-- Ahora lee desde un enlace de texto
    },
    {
        title: "Gallina Terrenal",
        img: "https://i.ibb.co/8LY8GCMM/gallina-terrenal.jpg",
        author: "Cuco Club",
        audio: "https://files.catbox.moe/dpezf6.mp3",
        lyrics: "https://luxiodev93.github.io/lyrics/galterr.txt",
        coments: [] // vacío → muestra "No comments"
    },
    {
        title: "Que le den al algoritmo",
        img: "https://cdn2.suno.ai/image_large_2bd8299d-de12-4b3c-b7e9-cff0294a912d.jpeg", 
        audio: "https://files.catbox.moe/i0ujzh.mp3",
        author: "El Luchi",
        rated: "on",
        lyrics: "",
        coments: [
            ["LuchiFan", "https://i.pravatar.cc/150?img=47", "Esta va directa contra el algoritmo jajaja"]
        ]
    }
];

let currentAudio = new Audio();
let currentIndex = 0;
let parsedLyrics = [];
let isSingleSongMode = false;
let activeAuthorFilter = null;
let isRatedUnlocked = false;
let isRepeatEnabled = false;
let isCommentsOpen = false;

let tapCount = 0;
let tapTimer = null;

currentAudio.volume = 0.75;

function getRandomViews() {
    const rangeChoice = Math.floor(Math.random() * 3);
    let num;
    if (rangeChoice === 0) {
        num = Math.floor(Math.random() * 99) + 1;
        return num.toString();
    } else if (rangeChoice === 1) {
        num = Math.floor(Math.random() * 999) + 1;
        return `${num}K`;
    } else {
        num = (Math.random() * 9 + 1).toFixed(1);
        if (num.endsWith('.0')) num = Math.floor(num);
        return `${num}M`;
    }
}

function getRandomTimeAgo() {
    const type = Math.floor(Math.random() * 3);
    if (type === 0) {
        const days = Math.floor(Math.random() * 11) + 20;
        return `hace ${days} d`;
    } else if (type === 1) {
        const months = Math.floor(Math.random() * 11) + 1;
        return `hace ${months} m`;
    } else {
        const years = Math.floor(Math.random() * 2) + 1;
        return `hace ${years} a`;
    }
}

musicData.forEach(item => {
    item.author = (item.author && item.author.trim() !== "") ? item.author : DEFAULT_AUTHOR;
    item.rated = (item.rated && item.rated.toString().toLowerCase() === "on") ? "on" : "off";
    item.views = getRandomViews();
    item.timeAgo = getRandomTimeAgo();
    if (!Array.isArray(item.coments) && typeof item.coments !== 'string') {
        item.coments = [];
    }
});

function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

async function parseLRC(lrcUrl) {
    if(!lrcUrl) return [];
    
    let lrcText = lrcUrl;
    if (lrcUrl.startsWith('http://') || lrcUrl.startsWith('https://')) {
        try {
            const response = await fetch(lrcUrl);
            if (!response.ok) throw new Error('Error al descargar letra');
            lrcText = await response.text();
        } catch (error) {
            console.error('No se pudo cargar la letra desde la URL:', error);
            return [];
        }
    }

    const lines = lrcText.split(/\r?\n/);
    const lyrics = [];
    const timeReg = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;

    lines.forEach(line => {
        const match = timeReg.exec(line);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = parseInt(match[3]);
            const time = minutes * 60 + seconds + (milliseconds / (match[3].length === 3 ? 1000 : 100));
            const text = line.replace(timeReg, "").trim();
            if (text) lyrics.push({ time, text });
        }
    });
    return lyrics.sort((a, b) => a.time - b.time);
}

// NUEVA FUNCIÓN: Carga y parsea comentarios desde URL de texto o array directo
async function parseComments(comentsSource) {
    if (!comentsSource) return [];
    if (Array.isArray(comentsSource)) return comentsSource;

    let textData = "";
    if (typeof comentsSource === 'string' && (comentsSource.startsWith('http://') || comentsSource.startsWith('https://'))) {
        try {
            const response = await fetch(comentsSource);
            if (!response.ok) throw new Error('Error al descargar comentarios');
            textData = await response.text();
        } catch (error) {
            console.error('No se pudieron cargar los comentarios desde la URL:', error);
            return [];
        }
    } else {
        textData = comentsSource;
    }

    try {
        const parsed = JSON.parse(textData);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        console.error('El archivo de comentarios no tiene un formato JSON válido:', e);
    }

    return [];
}

function getActivePlaylist() {
    let baseList = musicData;

    if (!isRatedUnlocked) {
        baseList = baseList.filter(item => item.rated !== "on");
    }

    if (isSingleSongMode) return [musicData[currentIndex]];
    
    if (activeAuthorFilter) {
        return baseList.filter(item => item.author === activeAuthorFilter);
    }
    return baseList;
}

function renderCardHTML(item, index, isActive = false) {
        const authorClickAttr = (!isSingleSongMode) ? `onclick="event.stopPropagation(); filterByAuthor('${item.author}')"` : '';
        const authorClass = (!isSingleSongMode) ? 'clickable-author' : '';

        return `
            <div class="yt-card ${isActive ? 'active' : ''}" id="item-${index}" onclick="playTrack(${index})">
                <div class="yt-thumb-container">
                    <img class="yt-thumb" src="${item.img}" alt="${item.title}" loading="lazy">
                    <span class="playing-badge">Sonando</span>
                </div>
                <div class="yt-info">
                    <h3 class="yt-title">${item.title}</h3>
                    <p class="yt-author ${authorClass}" ${authorClickAttr}>${item.author}</p>
                    <p class="yt-meta">
                        <span class="yt-meta-play-icon"></span>${item.views}
                        <span class="yt-dot-separator">•</span>
                        <span>${item.timeAgo}</span>
                    </p>
                </div>
            </div>
        `;
}

function updateTrackUI(song) {
    document.title = `${song.title} - ${song.author}`;
    document.getElementById('current-track-title').innerText = song.title;
    
    const authorEl = document.getElementById('current-track-author');
    authorEl.innerText = song.author;
    
    if (!isSingleSongMode) {
        authorEl.classList.add('clickable-author');
        authorEl.onclick = () => filterByAuthor(song.author);
    } else {
        authorEl.classList.remove('clickable-author');
        authorEl.onclick = null;
    }
}

function loadPlaylist() {
    const container = document.getElementById('playlist');
    const header = document.getElementById('playlist-header');
    const authorActions = document.getElementById('author-actions');
    
    if (isSingleSongMode) {
        const song = musicData[currentIndex];
        header.innerText = "Canción compartida";
        authorActions.style.display = 'none';
        container.innerHTML = renderCardHTML(song, currentIndex, true);
    } else {
        if (activeAuthorFilter) {
            header.innerText = `Canciones de: ${activeAuthorFilter}`;
            authorActions.style.display = 'flex';
        } else {
            header.innerText = "A continuación";
            authorActions.style.display = 'none';
        }

        container.innerHTML = musicData.map((item, index) => {
            if (!isRatedUnlocked && item.rated === "on") {
                return '';
            }

            if (activeAuthorFilter && item.author !== activeAuthorFilter) {
                return '';
            }
            return renderCardHTML(item, index, index === currentIndex);
        }).join('');
    }
}

function filterByAuthor(authorName) {
    if (isSingleSongMode) return;
    activeAuthorFilter = authorName;
    loadPlaylist();

    const currentSong = musicData[currentIndex];
    if (currentSong.author !== activeAuthorFilter) {
        const firstAuthorSongIndex = musicData.findIndex(s => s.author === activeAuthorFilter && (isRatedUnlocked || s.rated !== "on"));
        if (firstAuthorSongIndex !== -1) {
            playTrack(firstAuthorSongIndex);
        }
    }
}

function clearAuthorFilter() {
    activeAuthorFilter = null;
    loadPlaylist();
}

function shareAuthorList() {
    if (!activeAuthorFilter) return;
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?author=${slugify(activeAuthorFilter)}`;

    copyToClipboard(shareUrl).then(() => {
        showToast('¡Enlace de la lista copiado! 📋');
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

/* --- PANEL DE COMENTARIOS --- */
function renderComments() {
    const list = document.getElementById('comments-list');
    const song = musicData[currentIndex];
    // Lee de los comentarios ya cargados dinámicamente o del respaldo en array
    const comments = Array.isArray(song.loadedComments) ? song.loadedComments : (Array.isArray(song.coments) ? song.coments : []);

    if (comments.length === 0) {
        list.innerHTML = `<div class="no-comments">No comments</div>`;
        return;
    }

    list.innerHTML = comments.map(c => {
        const [username, imgUrl, text] = c;
        return `
            <div class="comment-item">
                <img class="comment-avatar" src="${imgUrl}" alt="${username}" loading="lazy" onerror="this.src='https://i.pravatar.cc/150?u=fallback'">
                <div class="comment-body">
                    <p class="comment-username">${username}</p>
                    <p class="comment-text">${text}</p>
                </div>
            </div>
        `;
    }).join('');
}

function openCommentsPanel() {
    isCommentsOpen = true;
    document.getElementById('comments-panel').classList.add('open');
    document.getElementById('btn-comments').classList.add('active');
    renderComments();
}

function closeCommentsPanel() {
    isCommentsOpen = false;
    document.getElementById('comments-panel').classList.remove('open');
    document.getElementById('btn-comments').classList.remove('active');
}

function toggleCommentsPanel() {
    if (isCommentsOpen) {
        closeCommentsPanel();
    } else {
        openCommentsPanel();
    }
}

async function playTrack(index) {
    if (index < 0) index = 0;
    if (index >= musicData.length) index = 0;

    if (!isRatedUnlocked && musicData[index].rated === "on") {
        const validIndex = musicData.findIndex(s => s.rated !== "on");
        index = validIndex !== -1 ? validIndex : 0;
    }

    // Cerrar panel de comentarios al cambiar de canción
    closeCommentsPanel();

    currentIndex = index;
    const song = musicData[currentIndex];

    updateTrackUI(song);

    currentAudio.src = song.audio;
    currentAudio.load();
    
    parsedLyrics = [];
    song.loadedComments = [];
    document.getElementById('lyric-text').innerText = "Cargando letra...";
    document.getElementById('player-bg').style.backgroundImage = `url('${song.img}')`;

    loadPlaylist();

    // Carga de Letras
    try {
        parsedLyrics = await parseLRC(song.lyrics);
        if (parsedLyrics.length === 0) {
            document.getElementById('lyric-text').innerText = "🎵 Instrumental o sin letra disponible";
        }
    } catch (e) {
        document.getElementById('lyric-text').innerText = "🎵 Disfruta la música";
    }

    // Carga de Comentarios Asíncronos
    try {
        song.loadedComments = await parseComments(song.coments);
    } catch (e) {
        song.loadedComments = [];
    }

    // Si el panel está abierto, actualiza los comentarios en tiempo real al terminar de cargar
    if (isCommentsOpen) {
        renderComments();
    }

    currentAudio.play().then(() => {
        updatePlayPauseIcon(true);
    }).catch(e => {
        console.log('Autoplay bloqueado por el navegador, pulsa play:', e);
        updatePlayPauseIcon(false);
    });
}

function playNextTrack() {
    const currentPlaylist = getActivePlaylist();
    if (currentPlaylist.length === 0) return;

    let currentPosInFiltered = currentPlaylist.findIndex(s => s === musicData[currentIndex]);
    let nextPos = currentPosInFiltered + 1;

    if (nextPos >= currentPlaylist.length) {
        nextPos = 0;
    }

    const nextSong = currentPlaylist[nextPos];
    const globalIndex = musicData.findIndex(s => s === nextSong);
    playTrack(globalIndex !== -1 ? globalIndex : 0);
}

function playPrevTrack() {
    const currentPlaylist = getActivePlaylist();
    if (currentPlaylist.length === 0) return;

    let currentPosInFiltered = currentPlaylist.findIndex(s => s === musicData[currentIndex]);
    let prevPos = currentPosInFiltered - 1;

    if (prevPos < 0) {
        prevPos = currentPlaylist.length - 1;
    }

    const prevSong = currentPlaylist[prevPos];
    const globalIndex = musicData.findIndex(s => s === prevSong);
    playTrack(globalIndex !== -1 ? globalIndex : 0);
}

function togglePlayPause() {
    if (currentAudio.paused) {
        currentAudio.play();
        updatePlayPauseIcon(true);
    } else {
        currentAudio.pause();
        updatePlayPauseIcon(false);
    }
}

function updatePlayPauseIcon(isPlaying) {
    document.getElementById('icon-play').style.display = isPlaying ? 'none' : 'block';
    document.getElementById('icon-pause').style.display = isPlaying ? 'block' : 'none';
}

function toggleRepeat() {
    isRepeatEnabled = !isRepeatEnabled;
    const btnRepeat = document.getElementById('btn-repeat');
    if (isRepeatEnabled) {
        btnRepeat.classList.add('active');
        showToast("🔁 Modo repetición activado");
    } else {
        btnRepeat.classList.remove('active');
        showToast("🔁 Modo repetición desactivado");
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
}

function updateLyrics(currentTime) {
    if (!parsedLyrics || parsedLyrics.length === 0) return;
    let currentText = "🎵 ... 🎵";
    
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) {
            currentText = parsedLyrics[i].text;
        } else {
            break;
        }
    }
    document.getElementById('lyric-text').innerText = currentText;
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise((resolve, reject) => {
            document.execCommand('copy') ? resolve() : reject();
            textArea.remove();
        });
    }
}

function showToast(msg) {
    const toast = document.getElementById('share-toast');
    if (msg) toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function shareCurrentSong() {
    const song = musicData[currentIndex];
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?song=${slugify(song.title)}`;

    copyToClipboard(shareUrl).then(() => {
        showToast('¡Enlace de la canción copiado! 📋');
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

function toggleFullscreen() {
    const playerContainer = document.getElementById('player-container');
    if (!document.fullscreenElement) {
        if (playerContainer.requestFullscreen) {
            playerContainer.requestFullscreen();
        } else if (playerContainer.webkitRequestFullscreen) {
            playerContainer.webkitRequestFullscreen();
        }
        document.getElementById('icon-fullscreen-enter').style.display = 'none';
        document.getElementById('icon-fullscreen-exit').style.display = 'block';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        document.getElementById('icon-fullscreen-enter').style.display = 'block';
        document.getElementById('icon-fullscreen-exit').style.display = 'none';
    }
}

function handleDevTap() {
    if (isRatedUnlocked) return;

    tapCount++;
    clearTimeout(tapTimer);

    tapTimer = setTimeout(() => {
        tapCount = 0;
    }, 2000);

    if (tapCount >= 5) {
        tapCount = 0;
        const code = prompt("Introduce el código de acceso para ver la lista completa:");
        if (code === "1725") {
            isRatedUnlocked = true;
            loadPlaylist();
            showToast("🔓 Contenido completo desbloqueado");
        } else if (code !== null) {
            alert("Código incorrecto.");
        }
    }
}

/* --- EVENT LISTENERS --- */
document.getElementById('btn-play-pause').addEventListener('click', togglePlayPause);
document.getElementById('btn-prev').addEventListener('click', playPrevTrack);
document.getElementById('btn-next').addEventListener('click', playNextTrack);
document.getElementById('btn-repeat').addEventListener('click', toggleRepeat);
document.getElementById('btn-share').addEventListener('click', shareCurrentSong);
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-comments').addEventListener('click', toggleCommentsPanel);

currentAudio.addEventListener('timeupdate', () => {
    const current = currentAudio.currentTime;
    const duration = currentAudio.duration;

    if (!isNaN(duration) && duration > 0) {
        const pct = (current / duration) * 100;
        document.getElementById('time-progress').style.width = `${pct}%`;
        document.getElementById('time-text').innerText = `${formatTime(current)} / ${formatTime(duration)}`;
    }

    updateLyrics(current);
});

currentAudio.addEventListener('ended', () => {
    if (isRepeatEnabled) {
        currentAudio.currentTime = 0;
        currentAudio.play();
    } else if (isSingleSongMode) {
        currentAudio.currentTime = 0;
        currentAudio.play();
    } else {
        playNextTrack();
    }
});

document.getElementById('time-bar').addEventListener('click', (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    if (!isNaN(currentAudio.duration)) {
        currentAudio.currentTime = pct * currentAudio.duration;
    }
});

/* --- INICIALIZACIÓN --- */
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const songParam = urlParams.get('song');
    const authorParam = urlParams.get('author');

    if (songParam) {
        const foundIndex = musicData.findIndex(item => slugify(item.title) === songParam);
        if (foundIndex !== -1) {
            currentIndex = foundIndex;
            isSingleSongMode = true;
        }
    } else if (authorParam) {
        const foundAuthorItem = musicData.find(item => slugify(item.author) === authorParam);
        if (foundAuthorItem) {
            activeAuthorFilter = foundAuthorItem.author;
            const firstAuthorIndex = musicData.findIndex(item => item.author === activeAuthorFilter && (isRatedUnlocked || item.rated !== "on"));
            if (firstAuthorIndex !== -1) currentIndex = firstAuthorIndex;
        }
    }

    loadPlaylist();
    playTrack(currentIndex);
});
