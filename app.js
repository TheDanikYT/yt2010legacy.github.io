import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    where,
    Timestamp,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ========= FIREBASE CONFIG =========
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0z2DJLqRjqxuSZktQ6SYSqj4L8OiK2Cc",
  authDomain: "legacy-b46e4.firebaseapp.com",
  databaseURL: "https://legacy-b46e4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "legacy-b46e4",
  storageBucket: "legacy-b46e4.firebasestorage.app",
  messagingSenderId: "310385177417",
  appId: "1:310385177417:web:034e8b9b6800333854a098",
  measurementId: "G-KKV77Y2CPC"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ========= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =========
let currentUser = null;
let currentCategory = "all";
let allVideos = [];

// ========= DOM ЭЛЕМЕНТЫ =========
const videosContainer = document.getElementById("videosContainer");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const uploadTopBtn = document.getElementById("uploadTopBtn");
const uploadSideBtn = document.getElementById("uploadSideBtn");
const uploadShortSideBtn = document.getElementById("uploadShortSideBtn");
const unauthDiv = document.getElementById("unauthButtons");
const authDiv = document.getElementById("authButtons");
const usernameSpan = document.getElementById("usernameSpan");

// Модалки
const uploadModal = document.getElementById("uploadWindow");
const loginModal = document.getElementById("loginWindow");
const registerModal = document.getElementById("registerWindow");
const playerModal = document.getElementById("playerWindow");

// Формы
const uploadForm = document.getElementById("uploadVideoForm");
const loginForm = document.getElementById("loginFormData");
const registerForm = document.getElementById("registerFormData");

// Поля форм
const sourceType = document.getElementById("sourceType");
const youtubeRow = document.getElementById("youtubeRow");
const fileRow = document.getElementById("fileRow");
const youtubeLink = document.getElementById("youtubeLink");
const videoFile = document.getElementById("videoFileUpload");
const videoTitle = document.getElementById("videoTitleInput");
const videoCategory = document.getElementById("videoCategorySelect");
const videoDesc = document.getElementById("videoDescInput");
const isShortCheck = document.getElementById("shortCheckbox");

// ========= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =========
function getYouTubeId(url) {
    if (!url) return "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : url;
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryName(cat) {
    const names = { music: "🎵 Music", gaming: "🎮 Gaming", comedy: "😄 Comedy", education: "📚 Education" };
    return names[cat] || cat;
}

// ========= СТАТИСТИКА =========
async function updateStats() {
    try {
        const videosSnap = await getDocs(collection(db, "videos"));
        const shortsSnap = await getDocs(query(collection(db, "videos"), where("isShort", "==", true)));
        const usersSnap = await getDocs(collection(db, "users"));
        
        document.getElementById("statVideos").innerText = videosSnap.size;
        document.getElementById("statShorts").innerText = shortsSnap.size;
        document.getElementById("statUsers").innerText = usersSnap.size;
    } catch (e) {
        console.error("Stats error:", e);
    }
}

// ========= ЗАГРУЗКА ВИДЕО =========
async function loadVideos() {
    try {
        let q;
        if (currentCategory === "my" && currentUser) {
            q = query(collection(db, "videos"), where("userId", "==", currentUser.uid), orderBy("timestamp", "desc"));
        } else if (currentCategory === "shorts") {
            q = query(collection(db, "videos"), where("isShort", "==", true), orderBy("timestamp", "desc"));
        } else if (currentCategory === "popular") {
            q = query(collection(db, "videos"), orderBy("views", "desc"), orderBy("timestamp", "desc"));
        } else if (currentCategory === "recent") {
            q = query(collection(db, "videos"), orderBy("timestamp", "desc"));
        } else if (currentCategory !== "all" && !["popular", "recent", "my", "shorts"].includes(currentCategory)) {
            q = query(collection(db, "videos"), where("category", "==", currentCategory), orderBy("timestamp", "desc"));
        } else {
            q = query(collection(db, "videos"), orderBy("timestamp", "desc"));
        }
        
        const snap = await getDocs(q);
        allVideos = [];
        snap.forEach(doc => allVideos.push({ id: doc.id, ...doc.data() }));
        
        displayVideos(allVideos);
        updateStats();
    } catch (e) {
        console.error("Load error:", e);
        videosContainer.innerHTML = '<div class="loading-spinner">Error loading videos</div>';
    }
}

// ========= ОТОБРАЖЕНИЕ ВИДЕО =========
function displayVideos(videos) {
    if (videos.length === 0) {
        videosContainer.innerHTML = '<div class="loading-spinner">No videos found. Upload first!</div>';
        return;
    }
    
    const isShortsView = currentCategory === "shorts";
    videosContainer.className = isShortsView ? "shorts-grid" : "video-grid";
    
    videosContainer.innerHTML = videos.map(v => {
        const vidId = v.isFile ? v.fileUrl : getYouTubeId(v.url);
        const isShort = v.isShort;
        
        if (isShortsView || isShort) {
            return `
                <div class="shorts-card">
                    <div class="shorts-thumb" onclick="window.playVideoById('${v.id}')">
                        ${v.isFile ? 
                            `<video src="${v.fileUrl}"></video>` : 
                            `<iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0"></iframe>`
                        }
                        <div class="short-tag">#Shorts</div>
                    </div>
                    <div class="video-details">
                        <a href="#" class="video-title" onclick="window.playVideoById('${v.id}'); return false;">${escapeHtml(v.title)}</a>
                        <div class="video-author">${escapeHtml(v.author)}</div>
                        <div class="video-stats">👁️ ${v.views || 0} views</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="video-card">
                <div class="thumbnail" onclick="window.playVideoById('${v.id}')">
                    ${v.isFile ? 
                        `<video src="${v.fileUrl}"></video>` : 
                        `<iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0"></iframe>`
                    }
                    <div class="duration">${v.duration || "2:15"}</div>
                    ${isShort ? '<div class="short-tag">#Shorts</div>' : ""}
                </div>
                <div class="video-details">
                    <a href="#" class="video-title" onclick="window.playVideoById('${v.id}'); return false;">${escapeHtml(v.title)}</a>
                    <div class="video-author">${escapeHtml(v.author)}</div>
                    <div class="video-stats">👁️ ${v.views || 0} views</div>
                    <div class="category-badge">${getCategoryName(v.category)}</div>
                </div>
            </div>
        `;
    }).join("");
}

// ========= ВОСПРОИЗВЕДЕНИЕ =========
window.playVideoById = async function(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) return;
    
    // Обновляем просмотры
    try {
        const videoRef = doc(db, "videos", videoId);
        await updateDoc(videoRef, { views: (video.views || 0) + 1 });
        video.views = (video.views || 0) + 1;
    } catch (e) {}
    
    document.getElementById("playerTitleText").innerText = video.title;
    document.getElementById("playerAuthorText").innerText = video.author;
    document.getElementById("playerViewsText").innerText = video.views || 0;
    document.getElementById("playerDescText").innerText = video.description || "";
    
    const container = document.getElementById("playerContainer");
    const vidId = video.isFile ? video.fileUrl : getYouTubeId(video.url);
    
    if (video.isFile) {
        container.innerHTML = `<video controls autoplay style="width:100%; height:450px;"><source src="${video.fileUrl}" type="video/mp4"></video>`;
    } else {
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen style="width:100%; height:450px;"></iframe>`;
    }
    
    playerModal.style.display = "block";
};

// ========= ЗАГРУЗКА ФАЙЛА В STORAGE =========
async function uploadFileToStorage(file) {
    if (!currentUser) return null;
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `videos/${currentUser.uid}/${fileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
}

// ========= ПУБЛИКАЦИЯ ВИДЕО =========
async function publishVideo(title, url, category, desc, isShort, isFile = false, fileUrl = null) {
    if (!currentUser) {
        alert("Please sign in");
        return false;
    }
    
    try {
        await addDoc(collection(db, "videos"), {
            title, url, category, description: desc,
            author: currentUser.displayName || currentUser.email.split("@")[0],
            userId: currentUser.uid, userEmail: currentUser.email,
            timestamp: Timestamp.now(), views: 0, likes: 0,
            isShort, isFile, fileUrl, duration: "2:15"
        });
        alert("✅ Video published!");
        await loadVideos();
        return true;
    } catch (e) {
        alert("Error: " + e.message);
        return false;
    }
}

// ========= ПОИСК =========
function searchVideos() {
    const term = searchInput.value.toLowerCase();
    if (!term) return displayVideos(allVideos);
    const filtered = allVideos.filter(v => 
        v.title.toLowerCase().includes(term) || 
        v.author.toLowerCase().includes(term)
    );
    displayVideos(filtered);
}

// ========= СОБЫТИЯ =========
function initEvents() {
    // Навигация
    document.querySelectorAll("[data-category]").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            currentCategory = link.dataset.category;
            loadVideos();
            document.querySelectorAll(".nav-item, .cat-list a").forEach(a => a.classList.remove("active"));
            link.classList.add("active");
        });
    });
    
    // Поиск
    searchBtn.onclick = searchVideos;
    searchInput.onkeypress = (e) => { if (e.key === "Enter") searchVideos(); };
    
    // Тип источника
    sourceType.onchange = () => {
        if (sourceType.value === "youtube") {
            youtubeRow.style.display = "block";
            fileRow.style.display = "none";
        } else {
            youtubeRow.style.display = "none";
            fileRow.style.display = "block";
        }
    };
    
    // Кнопки загрузки
    const showUpload = () => {
        if (currentUser) uploadModal.style.display = "block";
        else { alert("Sign in first"); loginModal.style.display = "block"; }
    };
    uploadTopBtn.onclick = showUpload;
    uploadSideBtn.onclick = showUpload;
    uploadShortSideBtn.onclick = () => {
        if (currentUser) { uploadModal.style.display = "block"; isShortCheck.checked = true; }
        else { alert("Sign in first"); loginModal.style.display = "block"; }
    };
    
    loginBtn.onclick = () => loginModal.style.display = "block";
    registerBtn.onclick = () => registerModal.style.display = "block";
    
    // Закрытие модалок
    document.querySelectorAll(".close-modal").forEach(close => {
        close.onclick = () => {
            uploadModal.style.display = "none";
            loginModal.style.display = "none";
            registerModal.style.display = "none";
            playerModal.style.display = "none";
        };
    });
    
    // Переключение форм
    document.getElementById("showRegLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        loginModal.style.display = "none";
        registerModal.style.display = "block";
    });
    document.getElementById("showLoginLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        registerModal.style.display = "none";
        loginModal.style.display = "block";
    });
    
    // Регистрация
    registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById("regUsernameField").value;
        const email = document.getElementById("regEmailField").value;
        const password = document.getElementById("regPasswordField").value;
        
        if (password.length < 6) {
            alert("Password must be at least 6 chars");
            return;
        }
        
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: username });
            await addDoc(collection(db, "users"), {
                uid: cred.user.uid, username, email, createdAt: Timestamp.now()
            });
            registerModal.style.display = "none";
            alert("✅ Registered!");
            await updateStats();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };
    
    // Вход
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmailField").value;
        const password = document.getElementById("loginPasswordField").value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginModal.style.display = "none";
        } catch (err) {
            alert("Invalid email or password");
        }
    };
    
    // Загрузка видео
    uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = videoTitle.value;
        const category = videoCategory.value;
        const desc = videoDesc.value;
        const isShort = isShortCheck.checked;
        const type = sourceType.value;
        
        if (!title) { alert("Enter title"); return; }
        
        let url = "", fileUrl = null, isFile = false;
        
        if (type === "youtube") {
            url = youtubeLink.value;
            if (!url) { alert("Enter YouTube URL"); return; }
        } else {
            const file = videoFile.files[0];
            if (!file) { alert("Select file"); return; }
            if (file.size > 100 * 1024 * 1024) { alert("Max 100MB"); return; }
            isFile = true;
            try {
                fileUrl = await uploadFileToStorage(file);
            } catch (err) { alert("Upload failed: " + err.message); return; }
        }
        
        await publishVideo(title, url, category, desc, isShort, isFile, fileUrl);
        uploadModal.style.display = "none";
        uploadForm.reset();
        isShortCheck.checked = false;
        sourceType.value = "youtube";
        youtubeRow.style.display = "block";
        fileRow.style.display = "none";
    };
    
    logoutBtn.onclick = async () => { await signOut(auth); };
    
    window.onclick = (e) => {
        if (e.target.classList.contains("modal")) e.target.style.display = "none";
    };
}

// ========= АУТЕНТИФИКАЦИЯ =========
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        unauthDiv.style.display = "none";
        authDiv.style.display = "flex";
        usernameSpan.innerText = user.displayName || user.email.split("@")[0];
    } else {
        unauthDiv.style.display = "flex";
        authDiv.style.display = "none";
    }
    loadVideos();
});

// ========= ЗАПУСК =========
initEvents();
console.log("🚀 YouTube 2008 Running!");
