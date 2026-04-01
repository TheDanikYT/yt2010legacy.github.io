import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, where,
    Timestamp, doc, updateDoc, deleteDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL, deleteObject 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ========= FIREBASE CONFIG (ЗАМЕНИТЕ НА ВАШУ) =========
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ========= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =========
let currentUser = null;
let currentUserData = null;
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
const studioBtn = document.getElementById("studioBtn");
const adminPanelBtn = document.getElementById("adminPanelBtn");
const unauthDiv = document.getElementById("unauthButtons");
const authDiv = document.getElementById("authButtons");
const usernameSpan = document.getElementById("usernameSpan");
const verifiedBadge = document.getElementById("verifiedBadge");

// Модалки
const uploadModal = document.getElementById("uploadModal");
const loginModal = document.getElementById("loginModal");
const registerModal = document.getElementById("registerModal");
const playerModal = document.getElementById("playerModal");
const studioModal = document.getElementById("studioModal");
const adminModal = document.getElementById("adminModal");

// Формы
const uploadForm = document.getElementById("uploadForm");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const sourceType = document.getElementById("sourceType");
const youtubeGroup = document.getElementById("youtubeGroup");
const fileGroup = document.getElementById("fileGroup");
const youtubeUrl = document.getElementById("youtubeUrl");
const videoFile = document.getElementById("videoFile");
const videoTitle = document.getElementById("videoTitle");
const videoCategory = document.getElementById("videoCategory");
const videoDescription = document.getElementById("videoDescription");
const isShortCheck = document.getElementById("isShort");

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
    const names = { music: "🎵 Music", gaming: "🎮 Gaming", comedy: "😂 Comedy", education: "📚 Education" };
    return names[cat] || cat;
}

async function getUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        return userDoc.exists() ? userDoc.data() : null;
    } catch (e) { return null; }
}

// ========= СТАТИСТИКА =========
async function updateStats() {
    try {
        const videosSnap = await getDocs(collection(db, "videos"));
        const shortsSnap = await getDocs(query(collection(db, "videos"), where("isShort", "==", true)));
        const usersSnap = await getDocs(collection(db, "users"));
        const verifiedSnap = await getDocs(query(collection(db, "users"), where("verified", "==", true)));
        
        document.getElementById("statVideos").innerText = videosSnap.size;
        document.getElementById("statShorts").innerText = shortsSnap.size;
        document.getElementById("statUsers").innerText = usersSnap.size;
        document.getElementById("statVerified").innerText = verifiedSnap.size;
    } catch (e) { console.error(e); }
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
        for (const docSnap of snap.docs) {
            const video = { id: docSnap.id, ...docSnap.data() };
            const authorData = await getUserData(video.userId);
            video.authorVerified = authorData?.verified || false;
            allVideos.push(video);
        }
        displayVideos(allVideos);
        updateStats();
    } catch (e) {
        console.error(e);
        if (videosContainer) videosContainer.innerHTML = '<div class="loading">Error loading videos</div>';
    }
}

function displayVideos(videos) {
    if (!videosContainer) return;
    if (videos.length === 0) {
        videosContainer.innerHTML = '<div class="loading">No videos found. Upload first!</div>';
        return;
    }
    
    const isShortsView = currentCategory === "shorts";
    videosContainer.className = isShortsView ? "shorts-grid" : "video-grid";
    
    videosContainer.innerHTML = videos.map(v => {
        const vidId = v.isFile ? v.fileUrl : getYouTubeId(v.url);
        const verifiedMark = v.authorVerified ? '<span class="verified-badge-small" style="color:#3b88f5;">✓</span>' : '';
        
        if (isShortsView || v.isShort) {
            return `
                <div class="shorts-card">
                    <div class="shorts-thumb" onclick="window.playVideo('${v.id}')">
                        ${v.isFile ? 
                            `<video src="${v.fileUrl}"></video>` : 
                            `<iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0"></iframe>`
                        }
                        <div class="short-tag">#Shorts</div>
                        ${v.authorVerified ? '<div class="verified-tag">✓ Verified</div>' : ''}
                    </div>
                    <div class="video-details">
                        <a href="#" class="video-title" onclick="window.playVideo('${v.id}'); return false;">${escapeHtml(v.title)}</a>
                        <div class="video-author">${escapeHtml(v.author)} ${verifiedMark}</div>
                        <div class="video-stats">👁️ ${v.views || 0} views</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="video-card">
                <div class="thumbnail" onclick="window.playVideo('${v.id}')">
                    ${v.isFile ? 
                        `<video src="${v.fileUrl}"></video>` : 
                        `<iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0"></iframe>`
                    }
                    <div class="duration">${v.duration || "2:15"}</div>
                    ${v.authorVerified ? '<div class="verified-tag">✓ Verified</div>' : ''}
                </div>
                <div class="video-details">
                    <a href="#" class="video-title" onclick="window.playVideo('${v.id}'); return false;">${escapeHtml(v.title)}</a>
                    <div class="video-author">${escapeHtml(v.author)} ${verifiedMark}</div>
                    <div class="video-stats">👁️ ${v.views || 0} views</div>
                    <div class="category-badge">${getCategoryName(v.category)}</div>
                </div>
            </div>
        `;
    }).join("");
}

// ========= ВОСПРОИЗВЕДЕНИЕ =========
window.playVideo = async function(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) return;
    
    try {
        const videoRef = doc(db, "videos", videoId);
        await updateDoc(videoRef, { views: (video.views || 0) + 1 });
        video.views = (video.views || 0) + 1;
    } catch (e) {}
    
    document.getElementById("playerTitle").innerText = video.title;
    document.getElementById("playerAuthor").innerText = video.author;
    document.getElementById("playerViews").innerText = video.views || 0;
    document.getElementById("playerCategory").innerText = getCategoryName(video.category);
    document.getElementById("playerDesc").innerText = video.description || "";
    
    const playerVerified = document.getElementById("playerVerified");
    if (playerVerified) playerVerified.style.display = video.authorVerified ? "inline" : "none";
    
    const container = document.getElementById("playerContainer");
    const vidId = video.isFile ? video.fileUrl : getYouTubeId(video.url);
    
    if (video.isFile) {
        container.innerHTML = `<video controls autoplay style="width:100%; height:450px;"><source src="${video.fileUrl}" type="video/mp4"></video>`;
    } else {
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen style="width:100%; height:450px;"></iframe>`;
    }
    
    if (playerModal) playerModal.style.display = "block";
};

// ========= ЗАГРУЗКА ФАЙЛА =========
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
            author: currentUserData?.username || currentUser.displayName || currentUser.email.split("@")[0],
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

// ========= УДАЛЕНИЕ ВИДЕО =========
window.deleteVideo = async function(videoId, fileUrl) {
    if (!confirm("Delete this video?")) return;
    try {
        if (fileUrl) {
            try {
                const fileRef = ref(storage, fileUrl);
                await deleteObject(fileRef);
            } catch(e) {}
        }
        await deleteDoc(doc(db, "videos", videoId));
        alert("Video deleted");
        await loadVideos();
        if (studioModal && studioModal.style.display === "block") loadStudioData();
        if (adminModal && adminModal.style.display === "block") loadAdminData();
    } catch (e) { alert("Error: " + e.message); }
};

// ========= YOUTUBE STUDIO =========
async function loadStudioData() {
    if (!currentUser) return;
    
    try {
        const videosQuery = query(collection(db, "videos"), where("userId", "==", currentUser.uid), orderBy("timestamp", "desc"));
        const videosSnap = await getDocs(videosQuery);
        const userVideos = [];
        let totalViews = 0, totalLikes = 0;
        
        videosSnap.forEach(doc => {
            const video = { id: doc.id, ...doc.data() };
            userVideos.push(video);
            totalViews += video.views || 0;
            totalLikes += video.likes || 0;
        });
        
        const shorts = userVideos.filter(v => v.isShort);
        
        document.getElementById("studioTotalViews").innerText = totalViews;
        document.getElementById("studioTotalVideos").innerText = userVideos.length;
        document.getElementById("studioTotalShorts").innerText = shorts.length;
        document.getElementById("studioTotalLikes").innerText = totalLikes;
        document.getElementById("studioUserName").innerText = currentUserData?.username || currentUser.displayName || "User";
        
        const filter = document.getElementById("studioFilter")?.value || "all";
        let filtered = userVideos;
        if (filter === "videos") filtered = userVideos.filter(v => !v.isShort);
        if (filter === "shorts") filtered = userVideos.filter(v => v.isShort);
        
        const videosListHtml = filtered.map(v => `
            <div class="video-item">
                <div class="video-item-info">
                    <div class="video-item-title">${escapeHtml(v.title)}</div>
                    <div class="video-item-stats">👁️ ${v.views || 0} views | ${v.isShort ? "Short" : "Video"}</div>
                </div>
                <div class="video-item-actions">
                    <button onclick="window.editVideo('${v.id}')">✏️ Edit</button>
                    <button class="delete" onclick="window.deleteVideo('${v.id}', '${v.fileUrl || ""}')">🗑️ Delete</button>
                </div>
            </div>
        `).join("");
        
        document.getElementById("studioVideosList").innerHTML = videosListHtml || "<p>No videos yet</p>";
        
        const recentHtml = userVideos.slice(0, 5).map(v => `
            <div class="video-item">
                <div class="video-item-info">
                    <div class="video-item-title">${escapeHtml(v.title)}</div>
                    <div class="video-item-stats">${v.views || 0} views</div>
                </div>
            </div>
        `).join("");
        document.getElementById("studioRecentVideos").innerHTML = recentHtml || "<p>No videos</p>";
        
        document.getElementById("channelNameInput").value = currentUserData?.username || "";
        document.getElementById("channelDescInput").value = currentUserData?.channelDescription || "";
        
    } catch (e) { console.error(e); }
}

window.editVideo = async function(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) return;
    const newTitle = prompt("Edit title:", video.title);
    if (newTitle && newTitle !== video.title) {
        await updateDoc(doc(db, "videos", videoId), { title: newTitle });
        alert("Updated!");
        await loadVideos();
        await loadStudioData();
    }
};

// ========= АДМИН ПАНЕЛЬ =========
async function loadAdminData() {
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        const videosSnap = await getDocs(collection(db, "videos"));
        const shortsSnap = await getDocs(query(collection(db, "videos"), where("isShort", "==", true)));
        const verifiedSnap = await getDocs(query(collection(db, "users"), where("verified", "==", true)));
        
        document.getElementById("adminTotalUsers").innerText = usersSnap.size;
        document.getElementById("adminTotalVideos").innerText = videosSnap.size;
        document.getElementById("adminTotalShorts").innerText = shortsSnap.size;
        document.getElementById("adminVerifiedUsers").innerText = verifiedSnap.size;
        
        await loadAdminUsers();
        await loadAdminVideos();
    } catch (e) { console.error(e); }
}

async function loadAdminUsers() {
    const usersSnap = await getDocs(collection(db, "users"));
    const users = [];
    usersSnap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    
    const searchTerm = document.getElementById("adminUserSearch")?.value.toLowerCase() || "";
    const filtered = users.filter(u => u.username?.toLowerCase().includes(searchTerm) || u.email?.toLowerCase().includes(searchTerm));
    
    const listHtml = filtered.map(u => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${escapeHtml(u.username)} ${u.verified ? '<span class="user-verified">✓ Verified</span>' : ''}</div>
                <div class="user-email">${escapeHtml(u.email)}</div>
            </div>
            <div class="admin-actions">
                ${!u.verified ? `<button class="admin-btn verify" onclick="window.verifyUser('${u.uid}')">Verify</button>` : ""}
                <button class="admin-btn delete" onclick="window.deleteUserAccount('${u.uid}')">Delete</button>
            </div>
        </div>
    `).join("");
    
    document.getElementById("adminUsersList").innerHTML = listHtml || "<p>No users</p>";
}

async function loadAdminVideos() {
    const videosSnap = await getDocs(query(collection(db, "videos"), orderBy("timestamp", "desc")));
    const videos = [];
    videosSnap.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));
    
    const searchTerm = document.getElementById("adminVideoSearch")?.value.toLowerCase() || "";
    const filterType = document.getElementById("adminVideoFilter")?.value || "all";
    
    let filtered = videos;
    if (searchTerm) filtered = filtered.filter(v => v.title?.toLowerCase().includes(searchTerm) || v.author?.toLowerCase().includes(searchTerm));
    if (filterType === "videos") filtered = filtered.filter(v => !v.isShort);
    if (filterType === "shorts") filtered = filtered.filter(v => v.isShort);
    
    const listHtml = filtered.map(v => `
        <div class="admin-video-item">
            <div class="video-item-info">
                <div class="video-item-title">${escapeHtml(v.title)}</div>
                <div class="video-item-stats">${escapeHtml(v.author)} | ${v.views || 0} views | ${v.isShort ? "Short" : "Video"}</div>
            </div>
            <div class="admin-actions">
                <button class="admin-btn delete" onclick="window.deleteVideo('${v.id}', '${v.fileUrl || ""}')">Delete</button>
            </div>
        </div>
    `).join("");
    
    document.getElementById("adminVideosList").innerHTML = listHtml || "<p>No videos</p>";
}

window.verifyUser = async function(uid) {
    try {
        await updateDoc(doc(db, "users", uid), { verified: true });
        alert("User verified!");
        await loadAdminUsers();
        await updateStats();
    } catch (e) { alert("Error: " + e.message); }
};

window.deleteUserAccount = async function(uid) {
    if (!confirm("Delete user? This will also delete their videos!")) return;
    try {
        const videosSnap = await getDocs(query(collection(db, "videos"), where("userId", "==", uid)));
        for (const videoDoc of videosSnap.docs) {
            const video = videoDoc.data();
            if (video.fileUrl) {
                try {
                    const fileRef = ref(storage, video.fileUrl);
                    await deleteObject(fileRef);
                } catch(e) {}
            }
            await deleteDoc(doc(db, "videos", videoDoc.id));
        }
        await deleteDoc(doc(db, "users", uid));
        alert("User deleted");
        await loadAdminData();
        await updateStats();
    } catch (e) { alert("Error: " + e.message); }
};

// ========= ПОИСК =========
function searchVideos() {
    const term = searchInput.value.toLowerCase();
    if (!term) return displayVideos(allVideos);
    const filtered = allVideos.filter(v => v.title.toLowerCase().includes(term) || v.author.toLowerCase().includes(term));
    displayVideos(filtered);
}

// ========= СОБЫТИЯ =========
function initEvents() {
    // Категории - главная навигация
    document.querySelectorAll(".nav-link, .cat-list a").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const category = link.getAttribute("data-category");
            if (category) {
                currentCategory = category;
                loadVideos();
                document.querySelectorAll(".nav-link, .cat-list a").forEach(a => a.classList.remove("active"));
                link.classList.add("active");
            }
        });
    });
    
    // Поиск
    if (searchBtn) searchBtn.onclick = searchVideos;
    if (searchInput) searchInput.onkeypress = (e) => { if (e.key === "Enter") searchVideos(); };
    
    // Тип источника
    if (sourceType) {
        sourceType.onchange = () => {
            if (sourceType.value === "youtube") {
                if (youtubeGroup) youtubeGroup.style.display = "block";
                if (fileGroup) fileGroup.style.display = "none";
            } else {
                if (youtubeGroup) youtubeGroup.style.display = "none";
                if (fileGroup) fileGroup.style.display = "block";
            }
        };
    }
    
    // Кнопки загрузки
    const showUpload = () => {
        if (currentUser) {
            if (uploadModal) uploadModal.style.display = "block";
        } else {
            alert("Sign in first");
            if (loginModal) loginModal.style.display = "block";
        }
    };
    
    if (uploadTopBtn) uploadTopBtn.onclick = showUpload;
    if (uploadSideBtn) uploadSideBtn.onclick = showUpload;
    if (uploadShortSideBtn) {
        uploadShortSideBtn.onclick = () => {
            if (currentUser) {
                if (uploadModal) uploadModal.style.display = "block";
                if (isShortCheck) isShortCheck.checked = true;
            } else {
                alert("Sign in first");
                if (loginModal) loginModal.style.display = "block";
            }
        };
    }
    
    if (loginBtn) loginBtn.onclick = () => { if (loginModal) loginModal.style.display = "block"; };
    if (registerBtn) registerBtn.onclick = () => { if (registerModal) registerModal.style.display = "block"; };
    
    if (studioBtn) {
        studioBtn.onclick = async () => {
            await loadStudioData();
            if (studioModal) studioModal.style.display = "block";
        };
    }
    
    // Закрытие модалок
    document.querySelectorAll(".close, .close-studio, .close-admin").forEach(close => {
        close.onclick = () => {
            if (uploadModal) uploadModal.style.display = "none";
            if (loginModal) loginModal.style.display = "none";
            if (registerModal) registerModal.style.display = "none";
            if (playerModal) playerModal.style.display = "none";
            if (studioModal) studioModal.style.display = "none";
            if (adminModal) adminModal.style.display = "none";
        };
    });
    
    // Studio Tabs
    document.querySelectorAll(".studio-nav-btn").forEach(btn => {
        btn.onclick = () => {
            const tab = btn.getAttribute("data-studio");
            document.querySelectorAll(".studio-nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".studio-pane").forEach(p => p.style.display = "none");
            btn.classList.add("active");
            const pane = document.getElementById(`studio${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
            if (pane) pane.style.display = "block";
            document.getElementById("studioTitle").innerText = tab.charAt(0).toUpperCase() + tab.slice(1);
        };
    });
    
    // Admin Tabs
    document.querySelectorAll(".admin-nav-btn").forEach(btn => {
        btn.onclick = () => {
            const tab = btn.getAttribute("data-admin");
            document.querySelectorAll(".admin-nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".admin-pane").forEach(p => p.style.display = "none");
            btn.classList.add("active");
            const pane = document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
            if (pane) pane.style.display = "block";
            document.getElementById("adminTitle").innerText = tab.charAt(0).toUpperCase() + tab.slice(1);
        };
    });
    
    // Studio filter
    const studioFilter = document.getElementById("studioFilter");
    if (studioFilter) studioFilter.onchange = () => loadStudioData();
    
    // Admin search/filter
    const adminUserSearch = document.getElementById("adminUserSearch");
    if (adminUserSearch) adminUserSearch.oninput = () => loadAdminUsers();
    
    const adminVideoSearch = document.getElementById("adminVideoSearch");
    if (adminVideoSearch) adminVideoSearch.oninput = () => loadAdminVideos();
    
    const adminVideoFilter = document.getElementById("adminVideoFilter");
    if (adminVideoFilter) adminVideoFilter.onchange = () => loadAdminVideos();
    
    // Studio upload
    const studioUploadBtn = document.getElementById("studioUploadBtn");
    if (studioUploadBtn) {
        studioUploadBtn.onclick = () => {
            if (studioModal) studioModal.style.display = "none";
            if (uploadModal) uploadModal.style.display = "block";
        };
    }
    
    // Save settings
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = async () => {
            if (!currentUser) return;
            const channelName = document.getElementById("channelNameInput").value;
            const channelDesc = document.getElementById("channelDescInput").value;
            await updateDoc(doc(db, "users", currentUser.uid), {
                username: channelName, channelDescription: channelDesc
            });
            if (channelName) await updateProfile(auth.currentUser, { displayName: channelName });
            alert("Settings saved!");
            await loadStudioData();
        };
    }
    
    // Export data
    const exportBtn = document.getElementById("exportDataBtn");
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const usersSnap = await getDocs(collection(db, "users"));
            const videosSnap = await getDocs(collection(db, "videos"));
            const data = {
                users: usersSnap.docs.map(d => d.data()),
                videos: videosSnap.docs.map(d => d.data()),
                exportDate: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `youtube_export_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
    }
    
    // Регистрация
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById("regUsername").value;
            const email = document.getElementById("regEmail").value;
            const password = document.getElementById("regPassword").value;
            
            if (password.length < 6) {
                alert("Password must be at least 6 chars");
                return;
            }
            
            try {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(cred.user, { displayName: username });
                await setDoc(doc(db, "users", cred.user.uid), {
                    uid: cred.user.uid, username, email, createdAt: Timestamp.now(),
                    verified: false, channelDescription: ""
                });
                if (registerModal) registerModal.style.display = "none";
                alert("✅ Registered!");
            } catch (err) {
                alert("Error: " + err.message);
            }
        };
    }
    
    // Вход
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value;
            const password = document.getElementById("loginPassword").value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
                if (loginModal) loginModal.style.display = "none";
            } catch (err) {
                alert("Invalid email or password");
            }
        };
    }
    
    // Загрузка видео
    if (uploadForm) {
        uploadForm.onsubmit = async (e) => {
            e.preventDefault();
            const title = videoTitle.value;
            const category = videoCategory.value;
            const desc = videoDescription.value;
            const isShort = isShortCheck.checked;
            const type = sourceType.value;
            
            if (!title) { alert("Enter title"); return; }
            
            let url = "", fileUrl = null, isFile = false;
            
            if (type === "youtube") {
                url = youtubeUrl.value;
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
            if (uploadModal) uploadModal.style.display = "none";
            uploadForm.reset();
            if (isShortCheck) isShortCheck.checked = false;
        };
    }
    
    // Переключение форм
    const showRegister = document.getElementById("showRegister");
    const showLogin = document.getElementById("showLogin");
    if (showRegister) showRegister.onclick = (e) => { e.preventDefault(); loginModal.style.display = "none"; registerModal.style.display = "block"; };
    if (showLogin) showLogin.onclick = (e) => { e.preventDefault(); registerModal.style.display = "none"; loginModal.style.display = "block"; };
    
    if (logoutBtn) logoutBtn.onclick = async () => { await signOut(auth); };
    
    window.onclick = (e) => {
        if (e.target.classList.contains("modal")) {
            if (uploadModal) uploadModal.style.display = "none";
            if (loginModal) loginModal.style.display = "none";
            if (registerModal) registerModal.style.display = "none";
            if (playerModal) playerModal.style.display = "none";
            if (studioModal) studioModal.style.display = "none";
            if (adminModal) adminModal.style.display = "none";
        }
    };
}

// ========= АУТЕНТИФИКАЦИЯ =========
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        currentUserData = await getUserData(user.uid);
        if (unauthDiv) unauthDiv.style.display = "none";
        if (authDiv) authDiv.style.display = "flex";
        if (usernameSpan) usernameSpan.innerText = currentUserData?.username || user.displayName || user.email.split("@")[0];
        if (verifiedBadge) verifiedBadge.style.display = currentUserData?.verified ? "inline" : "none";
        
        if (adminPanelBtn) {
            if (user.email === "admin@youtube.com" || currentUserData?.isAdmin) {
                adminPanelBtn.style.display = "inline-block";
                adminPanelBtn.onclick = async () => {
                    await loadAdminData();
                    if (adminModal) adminModal.style.display = "block";
                };
            } else {
                adminPanelBtn.style.display = "none";
            }
        }
    } else {
        if (unauthDiv) unauthDiv.style.display = "flex";
        if (authDiv) authDiv.style.display = "none";
        if (adminPanelBtn) adminPanelBtn.style.display = "none";
        currentUserData = null;
    }
    loadVideos();
});

// ========= ЗАПУСК =========
initEvents();
console.log("🚀 YouTube 2008 Running!");
