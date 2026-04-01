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
const uploadModal = document.getElementById("uploadWindow");
const loginModal = document.getElementById("loginWindow");
const registerModal = document.getElementById("registerWindow");
const playerModal = document.getElementById("playerWindow");
const studioModal = document.getElementById("studioWindow");
const adminModal = document.getElementById("adminWindow");

// Формы
const uploadForm = document.getElementById("uploadVideoForm");
const loginForm = document.getElementById("loginFormData");
const registerForm = document.getElementById("registerFormData");
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
    const names = { music: "🎵 Music", gaming: "🎮 Gaming", comedy: "😂 Comedy", education: "📚 Education" };
    return names[cat] || cat;
}

async function getUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) return userDoc.data();
    } catch (e) { console.error(e); }
    return null;
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
    } catch (e) { console.error("Stats error:", e); }
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
        console.error("Load error:", e);
        if (videosContainer) videosContainer.innerHTML = '<div class="loading-spinner">Error loading videos</div>';
    }
}

function displayVideos(videos) {
    if (!videosContainer) return;
    if (videos.length === 0) {
        videosContainer.innerHTML = '<div class="loading-spinner">No videos found. Upload first!</div>';
        return;
    }
    
    const isShortsView = currentCategory === "shorts";
    videosContainer.className = isShortsView ? "shorts-grid" : "video-grid";
    
    videosContainer.innerHTML = videos.map(v => {
        const vidId = v.isFile ? v.fileUrl : getYouTubeId(v.url);
        const verifiedMark = v.authorVerified ? '<span class="verified-badge-small">✓</span>' : '';
        
        if (isShortsView || v.isShort) {
            return `
                <div class="shorts-card">
                    <div class="shorts-thumb" onclick="window.playVideoById('${v.id}')">
                        ${v.isFile ? 
                            `<video src="${v.fileUrl}"></video>` : 
                            `<iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0"></iframe>`
                        }
                        <div class="short-tag">#Shorts</div>
                        ${v.authorVerified ? '<div class="verified-tag">✓ Verified</div>' : ''}
                    </div>
                    <div class="video-details">
                        <a href="#" class="video-title" onclick="window.playVideoById('${v.id}'); return false;">${escapeHtml(v.title)}</a>
                        <div class="video-author">${escapeHtml(v.author)} ${verifiedMark}</div>
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
                    ${v.authorVerified ? '<div class="verified-tag">✓ Verified</div>' : ''}
                </div>
                <div class="video-details">
                    <a href="#" class="video-title" onclick="window.playVideoById('${v.id}'); return false;">${escapeHtml(v.title)}</a>
                    <div class="video-author">${escapeHtml(v.author)} ${verifiedMark}</div>
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
    
    try {
        const videoRef = doc(db, "videos", videoId);
        await updateDoc(videoRef, { views: (video.views || 0) + 1 });
        video.views = (video.views || 0) + 1;
    } catch (e) {}
    
    const authorData = await getUserData(video.userId);
    
    document.getElementById("playerTitleText").innerText = video.title;
    document.getElementById("playerAuthorText").innerText = video.author;
    document.getElementById("playerViewsText").innerText = video.views || 0;
    document.getElementById("playerCategoryText").innerText = getCategoryName(video.category);
    document.getElementById("playerDescText").innerText = video.description || "";
    
    const verifiedBadgeSmall = document.getElementById("playerVerifiedBadge");
    if (verifiedBadgeSmall) {
        verifiedBadgeSmall.style.display = authorData?.verified ? "inline" : "none";
    }
    
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
async function deleteVideo(videoId, fileUrl) {
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
}

window.deleteVideo = deleteVideo;

// ========= YOUTUBE STUDIO - ПОЛНОСТЬЮ РАБОТАЕТ =========
async function loadStudioData() {
    if (!currentUser) return;
    
    try {
        const videosQuery = query(collection(db, "videos"), where("userId", "==", currentUser.uid), orderBy("timestamp", "desc"));
        const videosSnap = await getDocs(videosQuery);
        const userVideos = [];
        let totalViews = 0;
        let totalLikes = 0;
        
        videosSnap.forEach(doc => {
            const video = { id: doc.id, ...doc.data() };
            userVideos.push(video);
            totalViews += video.views || 0;
            totalLikes += video.likes || 0;
        });
        
        const shorts = userVideos.filter(v => v.isShort);
        
        // Обновляем статистику
        document.getElementById("studioTotalViews").innerText = totalViews;
        document.getElementById("studioTotalVideos").innerText = userVideos.length;
        document.getElementById("studioTotalShorts").innerText = shorts.length;
        document.getElementById("studioTotalLikes").innerText = totalLikes;
        
        // Обновляем список видео
        const filterType = document.getElementById("studioFilterType")?.value || "all";
        let filteredVideos = userVideos;
        if (filterType === "videos") filteredVideos = userVideos.filter(v => !v.isShort);
        if (filterType === "shorts") filteredVideos = userVideos.filter(v => v.isShort);
        
        const videosListHtml = filteredVideos.map(v => `
            <div class="studio-video-item">
                <div class="studio-video-info">
                    <div class="studio-video-title">${escapeHtml(v.title)}</div>
                    <div class="studio-video-stats">
                        <span>👁️ ${v.views || 0} views</span>
                        <span>👍 ${v.likes || 0} likes</span>
                        <span>📅 ${v.timestamp?.toDate?.().toLocaleDateString() || "Recent"}</span>
                    </div>
                </div>
                <div class="studio-video-actions">
                    <button class="studio-btn-icon edit" onclick="window.editVideo('${v.id}')">✏️ Edit</button>
                    <button class="studio-btn-icon delete" onclick="window.deleteVideo('${v.id}', '${v.fileUrl || ""}')">🗑️ Delete</button>
                </div>
            </div>
        `).join("");
        
        document.getElementById("studioVideosList").innerHTML = videosListHtml || "<p style='color:#aaa; text-align:center;'>No videos yet. Upload your first video!</p>";
        
        // Recent Activity
        const recentHtml = userVideos.slice(0, 5).map(v => `
            <div class="activity-item">
                <div class="activity-text">📹 "${escapeHtml(v.title)}" - ${v.views || 0} views</div>
                <div class="activity-time">${v.timestamp?.toDate?.()?.toLocaleDateString() || "Just now"}</div>
            </div>
        `).join("");
        document.getElementById("studioRecentActivity").innerHTML = recentHtml || "<p>No recent activity</p>";
        
        // Channel info
        document.getElementById("studioUserName").innerText = currentUserData?.username || currentUser.displayName || "User";
        document.getElementById("studioUserSubs").innerText = "0 subscribers";
        document.getElementById("studioChannelName").value = currentUserData?.username || "";
        document.getElementById("studioChannelDesc").value = currentUserData?.channelDescription || "";
        document.getElementById("studioChannelUrl").value = `youtube.com/@${currentUserData?.username || "user"}`;
        
        // Chart
        drawStudioChart(userVideos);
        
    } catch (e) {
        console.error("Studio error:", e);
    }
}

function drawStudioChart(videos) {
    const ctx = document.getElementById("studioViewsChart")?.getContext("2d");
    if (!ctx) return;
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toLocaleDateString());
    }
    
    ctx.clearRect(0, 0, 600, 300);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, 600, 300);
    ctx.fillStyle = "#cc181e";
    
    const barWidth = 50;
    const maxViews = Math.max(...videos.map(v => v.views || 0), 100);
    
    videos.slice(0, 7).forEach((v, i) => {
        const height = ((v.views || 0) / maxViews) * 200;
        ctx.fillRect(i * barWidth + 50, 280 - height, barWidth - 5, height);
        ctx.fillStyle = "#fff";
        ctx.font = "10px Arial";
        ctx.fillText(v.views || 0, i * barWidth + 65, 275 - height);
        ctx.fillStyle = "#cc181e";
    });
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
        const verifiedSnap = await getDocs(query(collection(db, "users"), where("verified", "==", true)));
        const shortsSnap = await getDocs(query(collection(db, "videos"), where("isShort", "==", true)));
        
        document.getElementById("adminTotalUsers").innerText = usersSnap.size;
        document.getElementById("adminTotalVideos").innerText = videosSnap.size;
        document.getElementById("adminTotalShorts").innerText = shortsSnap.size;
        document.getElementById("adminVerifiedUsers").innerText = verifiedSnap.size;
        
        await loadAdminUsers();
        await loadAdminVideos();
        
    } catch (e) { console.error("Admin error:", e); }
}

async function loadAdminUsers() {
    const usersSnap = await getDocs(collection(db, "users"));
    const users = [];
    usersSnap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    
    const searchTerm = document.getElementById("adminUserSearch")?.value.toLowerCase() || "";
    const filtered = users.filter(u => u.username?.toLowerCase().includes(searchTerm) || u.email?.toLowerCase().includes(searchTerm));
    
    const listHtml = filtered.map(u => `
        <div class="admin-user-item">
            <div class="admin-user-info">
                <div class="admin-user-name">
                    ${escapeHtml(u.username)}
                    ${u.verified ? '<span class="admin-user-verified">✓ Verified</span>' : ''}
                </div>
                <div class="admin-user-email">${escapeHtml(u.email)}</div>
                <div>Joined: ${u.createdAt?.toDate?.()?.toLocaleDateString() || "Unknown"}</div>
            </div>
            <div class="admin-actions">
                ${!u.verified ? `<button class="admin-btn verify" onclick="window.verifyUser('${u.uid}')">✓ Verify</button>` : ""}
                <button class="admin-btn delete" onclick="window.deleteUser('${u.uid}')">🗑️ Delete</button>
            </div>
        </div>
    `).join("");
    
    document.getElementById("adminUsersList").innerHTML = listHtml || "<p>No users found</p>";
}

async function loadAdminVideos() {
    const videosSnap = await getDocs(query(collection(db, "videos"), orderBy("timestamp", "desc")));
    const videos = [];
    videosSnap.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));
    
    const searchTerm = document.getElementById("adminVideoSearch")?.value.toLowerCase() || "";
    const filterType = document.getElementById("adminVideoFilter")?.value || "all";
    
    let filtered = videos;
    if (searchTerm) {
        filtered = filtered.filter(v => v.title?.toLowerCase().includes(searchTerm) || v.author?.toLowerCase().includes(searchTerm));
    }
    if (filterType === "videos") filtered = filtered.filter(v => !v.isShort);
    if (filterType === "shorts") filtered = filtered.filter(v => v.isShort);
    
    const listHtml = filtered.map(v => `
        <div class="admin-video-item">
            <div class="admin-video-info">
                <div class="admin-user-name">${escapeHtml(v.title)}</div>
                <div>Author: ${escapeHtml(v.author)} | Views: ${v.views || 0} | ${v.isShort ? "📱 Short" : "📹 Video"}</div>
                <div>Category: ${getCategoryName(v.category)}</div>
            </div>
            <div class="admin-actions">
                <button class="admin-btn delete" onclick="window.deleteVideo('${v.id}', '${v.fileUrl || ""}')">🗑️ Delete</button>
            </div>
        </div>
    `).join("");
    
    document.getElementById("adminVideosList").innerHTML = listHtml || "<p>No videos found</p>";
}

window.verifyUser = async function(uid) {
    try {
        await updateDoc(doc(db, "users", uid), { verified: true });
        alert("User verified!");
        await loadAdminUsers();
        await updateStats();
    } catch (e) { alert("Error: " + e.message); }
};

window.deleteUser = async function(uid) {
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
    const filtered = allVideos.filter(v => 
        v.title.toLowerCase().includes(term) || 
        v.author.toLowerCase().includes(term)
    );
    displayVideos(filtered);
}

// ========= СОБЫТИЯ =========
function initEvents() {
    // Навигация по категориям
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
    if (searchBtn) searchBtn.onclick = searchVideos;
    if (searchInput) searchInput.onkeypress = (e) => { if (e.key === "Enter") searchVideos(); };
    
    // Тип источника
    if (sourceType) {
        sourceType.onchange = () => {
            if (sourceType.value === "youtube") {
                if (youtubeRow) youtubeRow.style.display = "block";
                if (fileRow) fileRow.style.display = "none";
            } else {
                if (youtubeRow) youtubeRow.style.display = "none";
                if (fileRow) fileRow.style.display = "block";
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
    document.querySelectorAll(".close-modal, .studio-close, .admin-close").forEach(close => {
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
    document.querySelectorAll(".studio-nav-item").forEach(tab => {
        tab.onclick = (e) => {
            e.preventDefault();
            const tabName = tab.dataset.studioTab;
            document.querySelectorAll(".studio-nav-item").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".studio-tab-pane").forEach(p => p.style.display = "none");
            tab.classList.add("active");
            const pane = document.getElementById(`studio${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
            if (pane) pane.style.display = "block";
            document.getElementById("studioPageTitle").innerText = tabName.charAt(0).toUpperCase() + tabName.slice(1);
        };
    });
    
    // Admin Tabs
    document.querySelectorAll(".admin-nav-item").forEach(tab => {
        tab.onclick = (e) => {
            e.preventDefault();
            const tabName = tab.dataset.adminTab;
            document.querySelectorAll(".admin-nav-item").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".admin-tab-pane").forEach(p => p.style.display = "none");
            tab.classList.add("active");
            const pane = document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
            if (pane) pane.style.display = "block";
            document.getElementById("adminPageTitle").innerText = tabName.charAt(0).toUpperCase() + tabName.slice(1);
        };
    });
    
    // Фильтры в студии
    const filterSelect = document.getElementById("studioFilterType");
    if (filterSelect) filterSelect.onchange = () => loadStudioData();
    
    const adminSearch = document.getElementById("adminUserSearch");
    if (adminSearch) adminSearch.oninput = () => loadAdminUsers();
    
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
    const saveSettings = document.getElementById("saveStudioSettings");
    if (saveSettings) {
        saveSettings.onclick = async () => {
            if (!currentUser) return;
            const channelName = document.getElementById("studioChannelName").value;
            const channelDesc = document.getElementById("studioChannelDesc").value;
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
            const email = document.getElementById("loginEmailField").value;
            const password = document.getElementById("loginPasswordField").value;
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
            if (uploadModal) uploadModal.style.display = "none";
            uploadForm.reset();
            if (isShortCheck) isShortCheck.checked = false;
            if (sourceType) sourceType.value = "youtube";
            if (youtubeRow) youtubeRow.style.display = "block";
            if (fileRow) fileRow.style.display = "none";
        };
    }
    
    if (logoutBtn) {
        logoutBtn.onclick = async () => { await signOut(auth); };
    }
    
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
        
        if (verifiedBadge) {
            verifiedBadge.style.display = currentUserData?.verified ? "inline" : "none";
        }
        
        // Показываем админ панель для админа
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
console.log("🚀 YouTube 2008 Running with Studio & Admin Panel!");
