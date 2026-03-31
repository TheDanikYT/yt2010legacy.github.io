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
    deleteDoc,
    doc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Конфигурация Firebase (ЗАМЕНИТЕ НА ВАШУ!)
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

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Глобальные переменные
let currentUser = null;
let currentCategory = 'all';
let allVideos = [];

// DOM элементы
const videosGrid = document.getElementById('videosGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const uploadBtn = document.getElementById('uploadBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authSection = document.getElementById('authSection');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');

// Модальные окна
const uploadModal = document.getElementById('uploadModal');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');

// Формы
const uploadForm = document.getElementById('uploadForm');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Функция для получения YouTube ID из URL
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}

// Загрузка видео из Firebase
async function loadVideos() {
    try {
        let videosQuery;
        
        if (currentCategory === 'my' && currentUser) {
            videosQuery = query(
                collection(db, 'videos'),
                where('userId', '==', currentUser.uid),
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
        } else if (currentCategory !== 'all' && currentCategory !== 'popular' && currentCategory !== 'recent' && currentCategory !== 'my') {
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
        videosGrid.innerHTML = '<div class="loading">Ошибка загрузки видео</div>';
    }
}

// Отображение видео
function displayVideos(videos) {
    if (videos.length === 0) {
        videosGrid.innerHTML = '<div class="loading">Видео не найдены</div>';
        return;
    }
    
    videosGrid.innerHTML = videos.map(video => `
        <div class="video-card">
            <div class="video-thumbnail">
                <iframe 
                    src="https://www.youtube.com/embed/${getYouTubeId(video.url)}" 
                    frameborder="0" 
                    allowfullscreen>
                </iframe>
                <div class="video-duration">2:15</div>
            </div>
            <div class="video-info">
                <a href="#" class="video-title" onclick="return false;">${escapeHtml(video.title)}</a>
                <div class="video-author">${escapeHtml(video.author)}</div>
                <div class="video-stats">
                    👁️ ${video.views || 0} просмотров | 
                    👍 ${video.likes || 0} лайков
                </div>
                <div class="video-description">${escapeHtml(video.description || '')}</div>
                <div class="category-badge">${getCategoryName(video.category)}</div>
            </div>
        </div>
    `).join('');
}

// Вспомогательные функции
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryName(category) {
    const categories = {
        'music': 'Музыка',
        'gaming': 'Игры',
        'comedy': 'Юмор',
        'education': 'Образование'
    };
    return categories[category] || category;
}

// Обновление статистики
async function updateStats() {
    try {
        const videosSnapshot = await getDocs(collection(db, 'videos'));
        document.getElementById('totalVideos').textContent = videosSnapshot.size;
        
        // Для подсчета пользователей нужно отдельное решение
        // В данном случае используем заглушку
        document.getElementById('totalUsers').textContent = '5';
    } catch (error) {
        console.error('Ошибка обновления статистики:', error);
    }
}

// Загрузка видео
async function uploadVideo(title, url, category, description, author) {
    if (!currentUser) {
        alert('Необходимо войти в аккаунт!');
        return false;
    }
    
    try {
        await addDoc(collection(db, 'videos'), {
            title: title,
            url: url,
            category: category,
            description: description,
            author: author,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            timestamp: Timestamp.now(),
            views: 0,
            likes: 0
        });
        
        alert('Видео успешно загружено!');
        await loadVideos();
        return true;
        
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        alert('Ошибка загрузки видео: ' + error.message);
        return false;
    }
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
    // Навигация по категориям
    document.querySelectorAll('[data-category]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            currentCategory = link.dataset.category;
            loadVideos();
            
            // Обновление активной ссылки
            document.querySelectorAll('.youtube-nav a, .categories a').forEach(a => {
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
    
    // Модальные окна
    uploadBtn.onclick = () => {
        if (currentUser) {
            uploadModal.style.display = 'block';
        } else {
            alert('Войдите в аккаунт для загрузки видео');
            loginModal.style.display = 'block';
        }
    };
    
    loginBtn.onclick = () => loginModal.style.display = 'block';
    
    document.querySelectorAll('.close').forEach(close => {
        close.onclick = () => {
            uploadModal.style.display = 'none';
            loginModal.style.display = 'none';
            registerModal.style.display = 'none';
        };
    });
    
    // Переключение между формами
    document.getElementById('showRegister').onclick = (e) => {
        e.preventDefault();
        loginModal.style.display = 'none';
        registerModal.style.display = 'block';
    };
    
    document.getElementById('showLogin').onclick = (e) => {
        e.preventDefault();
        registerModal.style.display = 'none';
        loginModal.style.display = 'block';
    };
    
    // Формы
    uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('videoTitle').value;
        const url = document.getElementById('videoUrl').value;
        const category = document.getElementById('videoCategory').value;
        const description = document.getElementById('videoDescription').value;
        
        await uploadVideo(title, url, category, description, currentUser.displayName || currentUser.email);
        
        uploadModal.style.display = 'none';
        uploadForm.reset();
    };
    
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginModal.style.display = 'none';
            loginForm.reset();
        } catch (error) {
            alert('Ошибка входа: ' + error.message);
        }
    };
    
    registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            registerModal.style.display = 'none';
            registerForm.reset();
        } catch (error) {
            alert('Ошибка регистрации: ' + error.message);
        }
    };
    
    logoutBtn.onclick = async () => {
        await signOut(auth);
    };
    
    // Закрытие модальных окон при клике вне
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// Слушатель состояния аутентификации
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    
    if (user) {
        authSection.style.display = 'none';
        userInfo.style.display = 'block';
        userName.textContent = user.displayName || user.email;
        loadVideos();
    } else {
        authSection.style.display = 'block';
        userInfo.style.display = 'none';
        loadVideos();
    }
});

// Инициализация приложения
initEventListeners();
loadVideos();
