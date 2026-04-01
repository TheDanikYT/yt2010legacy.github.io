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
    updateDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase конфигурация (ЗАМЕНИТЕ НА ВАШУ)
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

// Глобальные переменные
let currentUser = null;
let currentCategory = 'all';
let allVideos = [];
let allUsers = [];

// DOM элементы
const videosGrid = document.getElementById('videosGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const uploadHeaderBtn = document.getElementById('uploadHeaderBtn');
const uploadVideoBtn = document.getElementById('uploadVideoBtn');
const uploadShortBtn = document.getElementById('uploadShortBtn');
const authSection = document.getElementById('authSection');
const userInfo = document.getElementById('userInfo');
const userNameDisplay = document.getElementById('userNameDisplay');

// Модальные окна
const uploadModal = document.getElementById('uploadModal');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const videoPlayerModal = document.getElementById('videoPlayerModal');

// Формы
const uploadForm = document.getElementById('uploadForm');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const videoType = document.getElementById('videoType');
const youtubeUrlGroup = document.getElementById('youtubeUrlGroup');
const fileUploadGroup = document.getElementById('fileUploadGroup');

// Получение YouTube ID
function getYouTubeId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}

// Загрузка всех пользователей для статистики
async function loadUsersStats() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        allUsers = [];
        usersSnapshot.forEach((doc) => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        document.getElementById('totalUsers').textContent = allUsers.length;
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('totalUsers').textContent = '0';
    }
}

// Загрузка видео
async function loadVideos() {
    try {
        let videosQuery;
        
        if (currentCategory === 'my' && currentUser) {
            videosQuery = query(
                collection(db, 'videos'),
                where('userId', '==', currentUser.uid),
                orderBy('timestamp', 'desc')
            );
        } else if (currentCategory === 'shorts') {
            videosQuery = query(
                collection(db, 'videos'),
                where('isShort', '==', true),
                orderBy('timestamp', 'desc')
            );
        } else if (currentCategory === 'popular') {
            videosQuery = query(
                collection(db, 'videos'),
                orderBy('views', 'desc'),
                orderBy('timestamp', 'desc')
            );
        } else if (currentCategory === 'recent') {
            videosQuery = query(
                collection(db, 'videos'),
                orderBy('timestamp', 'desc')
            );
        } else if (currentCategory !== 'all' && currentCategory !== 'popular' && currentCategory !== 'recent' && currentCategory !== 'my' && currentCategory !== 'shorts') {
            videosQuery = query(
                collection(db, 'videos'),
                where('category', '==', currentCategory),
                orderBy('timestamp', 'desc')
            );
        } else {
            videosQuery = query(
                collection(db, 'videos'),
                orderBy('timestamp', 'desc')
            );
        }
        
        const querySnapshot = await getDocs(videosQuery);
        allVideos = [];
        querySnapshot.forEach((doc) => {
            allVideos.push({ id: doc.id, ...doc.data() });
        });
        
        displayVideos(allVideos);
        updateStats();
        
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        videosGrid.innerHTML = '<div class="loading">Error loading videos</div>';
    }
}

// Отображение видео
function displayVideos(videos) {
    if (videos.length === 0) {
        videosGrid.innerHTML = '<div class="loading">No videos found. Be the first to upload!</div>';
        return;
    }
    
    const isShortsView = currentCategory === 'shorts';
    const gridClass = isShortsView ? 'shorts-grid' : 'videos-grid';
    videosGrid.className = gridClass;
    
    videosGrid.innerHTML = videos.map(video => {
        const videoId = video.isFile ? video.fileUrl : getYouTubeId(video.url);
        const isShort = video.isShort;
        
        if (isShortsView || isShort) {
            return `
                <div class="shorts-card">
                    <div class="shorts-thumbnail" onclick="window.playVideo('${video.id}')">
                        ${video.isFile ? 
                            `<video src="${video.fileUrl}" poster="${video.thumbnail || ''}"></video>` :
                            `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0"></iframe>`
                        }
                        <div class="short-badge">#Shorts</div>
                    </div>
                    <div class="video-info">
                        <a href="#" class="video-title" onclick="window.playVideo('${video.id}'); return false;">${escapeHtml(video.title)}</a>
                        <div class="video-author">${escapeHtml(video.author)}</div>
                        <div class="video-stats">👁️ ${video.views || 0} views</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="video-card">
                <div class="video-thumbnail" onclick="window.playVideo('${video.id}')">
                    ${video.isFile ? 
                        `<video src="${video.fileUrl}" poster="${video.thumbnail || ''}"></video>` :
                        `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0"></iframe>`
                    }
                    <div class="video-duration">${video.duration || '2:15'}</div>
                    ${isShort ? '<div class="short-badge">#Shorts</div>' : ''}
                </div>
                <div class="video-info">
                    <a href="#" class="video-title" onclick="window.playVideo('${video.id}'); return false;">${escapeHtml(video.title)}</a>
                    <div class="video-author">${escapeHtml(video.author)}</div>
                    <div class="video-stats">👁️ ${video.views || 0} views</div>
                    <div class="category-tag">${getCategoryName(video.category)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Воспроизведение видео
window.playVideo = async function(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) return;
    
    // Увеличиваем счетчик просмотров
    try {
        const videoRef = doc(db, 'videos', videoId);
        await updateDoc(videoRef, {
            views: (video.views || 0) + 1
        });
        video.views = (video.views || 0) + 1;
    } catch (error) {
        console.error('Ошибка обновления просмотров:', error);
    }
    
    document.getElementById('playerTitle').textContent = video.title;
    document.getElementById('playerAuthor').textContent = video.author;
    document.getElementById('playerViews').textContent = video.views || 0;
    document.getElementById('playerDescription').textContent = video.description || '';
    
    const container = document.getElementById('videoPlayerContainer');
    const videoId_ = video.isFile ? video.fileUrl : getYouTubeId(video.url);
    
    if (video.isFile) {
        container.innerHTML = `<video controls autoplay style="width:100%; height:450px;"><source src="${video.fileUrl}" type="video/mp4"></video>`;
    } else {
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId_}" frameborder="0" allowfullscreen style="width:100%; height:450px;"></iframe>`;
    }
    
    videoPlayerModal.style.display = 'block';
};

// Загрузка видео файла
async function uploadVideoFile(file, title, category, description, isShort) {
    if (!currentUser) return null;
    
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `videos/${currentUser.uid}/${fileName}`);
    
    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        throw error;
    }
}

// Публикация видео
async function publishVideo(title, url, category, description, isShort, isFile = false, fileUrl = null) {
    if (!currentUser) {
        alert('Please sign in to upload videos');
        return false;
    }
    
    try {
        await addDoc(collection(db, 'videos'), {
            title: title,
            url: url,
            category: category,
            description: description,
            author: currentUser.displayName || currentUser.email.split('@')[0],
            userId: currentUser.uid,
            userEmail: currentUser.email,
            timestamp: Timestamp.now(),
            views: 0,
            likes: 0,
            isShort: isShort,
            isFile: isFile,
            fileUrl: fileUrl,
            duration: '2:15'
        });
        
        alert('✅ Video published successfully!');
        await loadVideos();
        return true;
        
    } catch (error) {
        console.error('Ошибка публикации:', error);
        alert('Error publishing video: ' + error.message);
        return false;
    }
}

// Обновление статистики
async function updateStats() {
    try {
        const videosSnapshot = await getDocs(collection(db, 'videos'));
        const shortsSnapshot = await getDocs(query(collection(db, 'videos'), where('isShort', '==', true)));
        
        document.getElementById('totalVideos').textContent = videosSnapshot.size;
        document.getElementById('totalShorts').textContent = shortsSnapshot.size;
    } catch (error) {
        console.error('Ошибка статистики:', error);
    }
}

// Вспомогательные функции
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryName(category) {
    const categories = {
        'music': '🎵 Music',
        'gaming': '🎮 Gaming',
        'comedy': '😄 Comedy',
        'education': '📚 Education'
    };
    return categories[category] || category;
}

// Поиск видео
function searchVideos() {
    const searchTerm = searchInput.value.toLowerCase();
    if (!searchTerm) {
        displayVideos(allVideos);
        return;
    }
    
    const filtered = allVideos.filter(video => 
        video.title.toLowerCase().includes(searchTerm) ||
        video.author.toLowerCase().includes(searchTerm) ||
        (video.description && video.description.toLowerCase().includes(searchTerm))
    );
    
    displayVideos(filtered);
}

// Инициализация слушателей
function initEventListeners() {
    // Навигация
    document.querySelectorAll('[data-category]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            currentCategory = link.dataset.category;
            loadVideos();
            
            document.querySelectorAll('.nav-link, .category-list a').forEach(a => {
                a.classList.remove('active');
            });
            link.classList.add('active');
        });
    });
    
    // Поиск
    searchBtn.addEventListener('click', searchVideos);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchVideos();
    });
    
    // Тип видео (YouTube или файл)
    videoType.addEventListener('change', (e) => {
        if (e.target.value === 'youtube') {
            youtubeUrlGroup.style.display = 'block';
            fileUploadGroup.style.display = 'none';
        } else {
            youtubeUrlGroup.style.display = 'none';
            fileUploadGroup.style.display = 'block';
        }
    });
    
    // Кнопки загрузки
    const openUploadModal = () => {
        if (currentUser) {
            uploadModal.style.display = 'block';
        } else {
            alert('Please sign in to upload videos');
            loginModal.style.display = 'block';
        }
    };
    
    uploadHeaderBtn?.addEventListener('click', openUploadModal);
    uploadVideoBtn?.addEventListener('click', openUploadModal);
    uploadShortBtn?.addEventListener('click', () => {
        if (currentUser) {
            uploadModal.style.display = 'block';
            document.getElementById('isShort').checked = true;
        } else {
            alert('Please sign in to upload shorts');
            loginModal.style.display = 'block';
        }
    });
    
    loginBtn.addEventListener('click', () => loginModal.style.display = 'block');
    registerBtn.addEventListener('click', () => registerModal.style.display = 'block');
    
    // Закрытие модалок
    document.querySelectorAll('.close').forEach(close => {
        close.onclick = () => {
            uploadModal.style.display = 'none';
            loginModal.style.display = 'none';
            registerModal.style.display = 'none';
            videoPlayerModal.style.display = 'none';
        };
    });
    
    // Переключение между формами
    document.getElementById('showRegisterModal')?.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.style.display = 'none';
        registerModal.style.display = 'block';
    });
    
    document.getElementById('showLoginModal')?.addEventListener('click', (e) => {
        e.preventDefault();
        registerModal.style.display = 'none';
        loginModal.style.display = 'block';
    });
    
    // Регистрация
    registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: username });
            
            // Сохраняем пользователя в Firestore
            await addDoc(collection(db, 'users'), {
                uid: userCredential.user.uid,
                username: username,
                email: email,
                createdAt: Timestamp.now()
            });
            
            registerModal.style.display = 'none';
            registerForm.reset();
            alert('✅ Registration successful!');
            await loadUsersStats();
        } catch (error) {
            alert('Registration error: ' + error.message);
        }
    };
    
    // Вход
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginModal.style.display = 'none';
            loginForm.reset();
        } catch (error) {
            alert('Invalid email or password');
        }
    };
    
    // Загрузка видео
    uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('videoTitle').value;
        const category = document.getElementById('videoCategory').value;
        const description = document.getElementById('videoDescription').value;
        const isShort = document.getElementById('isShort').checked;
        const type = document.getElementById('videoType').value;
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        let url = '';
        let fileUrl = null;
        let isFile = false;
        
        if (type === 'youtube') {
            url = document.getElementById('youtubeUrl').value;
            if (!url) {
                alert('Please enter YouTube URL');
                return;
            }
        } else {
            const file = document.getElementById('videoFile').files[0];
            if (!file) {
                alert('Please select a video file');
                return;
            }
            if (file.size > 100 * 1024 * 1024) {
                alert('File size must be less than 100MB');
                return;
            }
            
            isFile = true;
            try {
                fileUrl = await uploadVideoFile(file, title, category, description, isShort);
                if (!fileUrl) throw new Error('Upload failed');
            } catch (error) {
                alert('Error uploading file: ' + error.message);
                return;
            }
        }
        
        await publishVideo(title, url, category, description, isShort, isFile, fileUrl);
        
        uploadModal.style.display = 'none';
        uploadForm.reset();
        document.getElementById('isShort').checked = false;
    };
    
    logoutBtn.onclick = async () => {
        await signOut(auth);
    };
    
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// Слушатель аутентификации
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    if (user) {
        authSection.style.display = 'none';
        userInfo.style.display = 'block';
        userNameDisplay.textContent = user.displayName || user.email.split('@')[0];
        console.log('✅ User signed in:', user.email);
    } else {
        authSection.style.display = 'block';
        userInfo.style.display = 'none';
        console.log('👤 No user signed in');
    }
    
    loadVideos();
    loadUsersStats();
});

// Запуск
initEventListeners();
console.log('🚀 YouTube 2008 Edition Started');
