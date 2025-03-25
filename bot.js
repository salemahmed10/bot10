import { userManager } from './userManagement.js';

class TradingBot {
    constructor() {
        this.currentUser = null;
        this.initializeElements();
        this.setupEventListeners();
        this.checkLogin();
    }

    checkLogin() {
        if (!this.currentUser) {
            this.showLoginModal();
        }
    }

    showLoginModal() {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal">
                    <h2>تسجيل الدخول</h2>
                    <form id="loginForm">
                        <label>اسم المستخدم:</label>
                        <input type="text" id="username" required>
                        <label>كلمة المرور:</label>
                        <input type="password" id="password" required>
                        <button type="submit" class="btn primary">دخول</button>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const user = userManager.validateUser(username, password);
        if (user) {
            this.currentUser = user;
            document.querySelector('.modal-overlay').remove();
            this.initializeUserInterface();
        } else {
            alert('خطأ في تسجيل الدخول');
        }
    }

    initializeUserInterface() {
        const header = document.querySelector('.header');
        const userControls = document.createElement('div');
        userControls.className = 'user-controls';
        userControls.innerHTML = `
            <span>مرحباً ${this.currentUser.username}</span>
            ${this.isAdmin() ? '<button class="btn primary" id="addUserBtn">إضافة مستخدم</button>' : ''}
            <button class="btn danger" id="logoutBtn">تسجيل خروج</button>
        `;
        header.appendChild(userControls);

        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    }

    logout() {
        this.currentUser = null;
        this.showLoginModal();
    }

    isAdmin() {
        return this.currentUser && this.currentUser.username === config.adminUsername;
    }
}

window.bot = new TradingBot();

