import { config } from './config.js';
import { binanceApi } from './binanceApi.js';

class User {
    constructor(username, password, apiKeys = {}, subscription = {}) {
        this.username = username;
        this.password = password;
        this.apiKeys = apiKeys;
        this.subscription = subscription;
        this.trades = [];
    }
}

class TradingBot {
    constructor() {
        this.isRunning = false;
        this.balance = 0;
        this.profits = 0;
        this.totalTrades = 0;
        this.successfulTrades = 0;
        
        this.currentPrice = 0;
        this.websocket = null;
        this.selectedPair = config.defaultTradingPair;
        this.entryPrice = 0;
        this.exitPrice = 0;
        
        this.activeTrades = [];
        
        this.users = new Map();
        this.currentUser = null;
        this.loadUsers();
        
        if (!this.checkLoggedIn()) {
            this.showLoginModal();
        }
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkApiKeys();
    }

    loadUsers() {
        const savedUsers = localStorage.getItem('trading_bot_users');
        if (savedUsers) {
            const userArray = JSON.parse(savedUsers);
            userArray.forEach(user => {
                this.users.set(user.username, new User(
                    user.username,
                    user.password,
                    user.apiKeys,
                    user.subscription
                ));
            });
        }
        
        // Ensure admin account exists
        if (!this.users.has(config.adminUsername)) {
            this.users.set(config.adminUsername, new User(
                config.adminUsername,
                config.adminPassword,
                {},
                { type: 'admin', expires: null }
            ));
            this.saveUsers();
        }
    }

    saveUsers() {
        localStorage.setItem('trading_bot_users', 
            JSON.stringify(Array.from(this.users.values())));
    }

    showLoginModal() {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal">
                    <h2>تسجيل الدخول</h2>
                    <form id="loginForm">
                        <div class="input-wrapper">
                            <label>اسم المستخدم:</label>
                            <input type="text" id="username" required>
                        </div>
                        <div class="input-wrapper">
                            <label>كلمة المرور:</label>
                            <input type="password" id="password" required>
                        </div>
                        <div class="modal-buttons">
                            <button type="submit" class="btn primary">دخول</button>
                        </div>
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

    showNewUserModal() {
        if (!this.isAdmin()) return;
        
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal">
                    <h2>إضافة مستخدم جديد</h2>
                    <form id="newUserForm">
                        <div class="input-wrapper">
                            <label>اسم المستخدم:</label>
                            <input type="text" id="newUsername" required>
                        </div>
                        <div class="input-wrapper">
                            <label>كلمة المرور:</label>
                            <input type="password" id="newPassword" required>
                        </div>
                        <div class="input-wrapper">
                            <label>نوع الاشتراك:</label>
                            <select id="subscriptionType">
                                <option value="monthly">شهري</option>
                                <option value="quarterly">ربع سنوي</option>
                                <option value="yearly">سنوي</option>
                            </select>
                        </div>
                        <div class="input-wrapper">
                            <label>تاريخ البداية:</label>
                            <input type="date" id="startDate" required>
                        </div>
                        <div class="modal-buttons">
                            <button type="submit" class="btn primary">إضافة</button>
                            <button type="button" class="btn danger" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById('newUserForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleNewUser();
        });
    }

    handleNewUser() {
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;
        const type = document.getElementById('subscriptionType').value;
        const startDate = new Date(document.getElementById('startDate').value);
        
        let endDate = new Date(startDate);
        switch(type) {
            case 'monthly':
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case 'quarterly':
                endDate.setMonth(endDate.getMonth() + 3);
                break;
            case 'yearly':
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
        }

        const user = new User(username, password, {}, {
            type,
            startDate,
            endDate,
            fee: config.subscriptionFees[type]
        });

        this.users.set(username, user);
        this.saveUsers();
        
        document.querySelector('.modal-overlay').remove();
        this.logTrade(`تم إضافة مستخدم جديد: ${username}`);
    }

    handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const user = this.users.get(username);
        if (user && user.password === password) {
            this.currentUser = user;
            document.querySelector('.modal-overlay').remove();
            this.initializeUserInterface();
        } else {
            alert('خطأ في اسم المستخدم أو كلمة المرور');
        }
    }

    initializeUserInterface() {
        // Update header with user controls
        const header = document.querySelector('.header');
        const userControls = document.createElement('div');
        userControls.className = 'user-controls';
        userControls.innerHTML = `
            <span>مرحباً ${this.currentUser.username}</span>
            ${this.isAdmin() ? '<button class="btn primary" id="addUserBtn">إضافة مستخدم</button>' : ''}
            <button class="btn danger" id="logoutBtn">تسجيل خروج</button>
        `;
        header.appendChild(userControls);

        if (this.isAdmin()) {
            document.getElementById('addUserBtn').addEventListener('click', () => {
                this.showNewUserModal();
            });
        }

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Add trading history table
        const historySection = document.createElement('div');
        historySection.className = 'trading-history-section';
        historySection.innerHTML = `
            <h2>سجل التداول</h2>
            <table class="trading-history-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>النوع</th>
                        <th>الكمية</th>
                        <th>السعر</th>
                        <th>الربح/الخسارة</th>
                    </tr>
                </thead>
                <tbody id="tradingHistoryBody"></tbody>
            </table>
        `;
        document.querySelector('.container').appendChild(historySection);

        // Initialize trading mode indicator
        this.updateTradingModeIndicator();
    }

    updateTradingModeIndicator() {
        const tradingModeText = document.getElementById('tradingModeText');
        if (config.tradingMode === 'real') {
            tradingModeText.textContent = 'وضع التداول: حقيقي';
            tradingModeText.style.backgroundColor = '#2ecc71'; // Green
        } else {
            tradingModeText.textContent = 'وضع التداول: وهمي';
            tradingModeText.style.backgroundColor = '#e74c3c'; // Red
        }
    }

    addTradeToHistory(trade) {
        const tbody = document.getElementById('tradingHistoryBody');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(trade.timestamp).toLocaleString()}</td>
            <td>${trade.type}</td>
            <td>${trade.amount}</td>
            <td>${trade.price}</td>
            <td class="${trade.profit >= 0 ? 'profit' : 'loss'}">${trade.profit}</td>
        `;
        tbody.insertBefore(row, tbody.firstChild);
    }

    isAdmin() {
        return this.currentUser && this.currentUser.username === config.adminUsername;
    }

    checkLoggedIn() {
        return this.currentUser !== null;
    }

    initializeElements() {
        // Controls
        this.startButton = document.getElementById('startBot');
        this.stopButton = document.getElementById('stopBot');
        this.withdrawButton = document.getElementById('withdrawProfits');
        
        // Display elements
        this.balanceDisplay = document.getElementById('currentBalance');
        this.dailyProfitsDisplay = document.getElementById('dailyProfits');
        this.totalTradesDisplay = document.getElementById('totalTrades');
        this.successRateDisplay = document.getElementById('successRate');
        this.tradesLog = document.getElementById('tradesLog');
        
        // Settings
        this.strategySelect = document.getElementById('tradingStrategy');
        this.riskLevel = document.getElementById('riskLevel');
        this.stopLoss = document.getElementById('stopLoss');
        this.takeProfit = document.getElementById('takeProfit');
        
        // New elements for Binance integration
        this.pairSelect = document.getElementById('tradingPair');
        this.entryPriceInput = document.getElementById('entryPrice');
        this.exitPriceInput = document.getElementById('exitPrice');
        this.currentPriceDisplay = document.getElementById('currentPrice');
        
        // Add new elements for multiple trades
        this.tradeAmountInput = document.getElementById('tradeAmount');
        this.addTradeButton = document.getElementById('addTrade');
        this.activeTradesList = document.querySelector('.trades-container');
        
        // Add logout and settings buttons to header
        const header = document.querySelector('.header');
        const headerButtons = document.createElement('div');
        headerButtons.className = 'header-buttons';
        headerButtons.innerHTML = `
            <button class="btn primary" id="updateApiKeys">تحديث مفاتيح API</button>
        `;
        header.appendChild(headerButtons);

        // Add event listener for logout button
        // document.getElementById('logoutButton').addEventListener('click', () => {
        //     this.logout();
        // });

        // Add event listener for API key update button
        document.getElementById('updateApiKeys').addEventListener('click', () => {
            this.showApiKeyModal();
        });

        this.addTradeButton.addEventListener('click', () => this.addNewTrade());
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.startTrading());
        this.stopButton.addEventListener('click', () => this.stopTrading());
        this.withdrawButton.addEventListener('click', () => this.withdrawProfits());
        
        this.riskLevel.addEventListener('input', (e) => {
            document.getElementById('riskValue').textContent = `${e.target.value}%`;
        });

        this.pairSelect.addEventListener('change', (e) => {
            this.selectedPair = e.target.value;
            this.reconnectWebSocket();
        });

        this.entryPriceInput.addEventListener('change', (e) => {
            this.entryPrice = parseFloat(e.target.value);
        });

        this.exitPriceInput.addEventListener('change', (e) => {
            this.exitPrice = parseFloat(e.target.value);
        });
    }

    async checkApiKeys() {
        const savedApiKey = localStorage.getItem('binance_api_key');
        const savedApiSecret = localStorage.getItem('binance_api_secret');

        if (!savedApiKey || !savedApiSecret) {
            this.showApiKeyModal();
        } else {
            config.apiKey = savedApiKey;
            config.apiSecret = savedApiSecret;
            await this.initializeBinance();
        }
    }

    showApiKeyModal() {
        const modalHtml = `
            <div class="modal-overlay">
                <div class="modal">
                    <h2>إعداد مفاتيح Binance API</h2>
                    <form class="api-key-form" id="apiKeyForm">
                        <div class="input-wrapper">
                            <label class="api-key-label" for="apiKey">API Key:</label>
                            <input type="text" id="apiKey" placeholder="أدخل API Key" required>
                            <div class="api-key-help">انسخ والصق API Key من حساب Binance الخاص بك</div>
                        </div>
                        <div class="input-wrapper">
                            <label class="api-key-label" for="apiSecret">API Secret:</label>
                            <input type="text" id="apiSecret" placeholder="أدخل API Secret" required>
                            <div class="api-key-help">انسخ والصق API Secret من حساب Binance الخاص بك</div>
                        </div>
                        <div class="modal-buttons">
                            <button type="submit" class="btn primary">حفظ المفاتيح</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Make inputs easily selectable
        const inputs = document.querySelectorAll('.api-key-form input');
        inputs.forEach(input => {
            input.addEventListener('click', function() {
                this.select();
            });
            
            input.addEventListener('focus', function() {
                this.select();
            });
        });

        const form = document.getElementById('apiKeyForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('apiKey').value.trim();
            const apiSecret = document.getElementById('apiSecret').value.trim();

            if (!apiKey || !apiSecret) {
                alert('الرجاء إدخال كلا المفتاحين');
                return;
            }

            localStorage.setItem('binance_api_key', apiKey);
            localStorage.setItem('binance_api_secret', apiSecret);

            config.apiKey = apiKey;
            config.apiSecret = apiSecret;

            document.querySelector('.modal-overlay').remove();
            await this.initializeBinance();
        });
    }

    async initializeBinance() {
        if (!config.apiKey || !config.apiSecret) {
            this.logTrade('تحذير: الرجاء إضافة مفاتيح API الخاصة بـ Binance', 'error');
            return;
        }

        try {
            // Initialize Binance client
            await this.checkBinanceConnection();
            this.connectWebSocket();
        } catch (error) {
            this.logTrade(`خطأ في الاتصال بـ Binance: ${error.message}`, 'error');
        }
    }

    async checkBinanceConnection() {
        try {
            const response = await fetch(`${config.restEndpoint}/api/v3/ping`);
            if (!response.ok) {
                throw new Error('فشل الاتصال بخوادم Binance');
            }
            this.logTrade('تم الاتصال بـ Binance بنجاح');
        } catch (error) {
            throw new Error(`فشل الاتصال بـ Binance: ${error.message}`);
        }
    }

    connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        this.websocket = new WebSocket(`${config.wsEndpoint}/${this.selectedPair.toLowerCase()}@trade`);
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.currentPrice = parseFloat(data.p);
            this.currentPriceDisplay.textContent = `${this.currentPrice} USDT`;
            this.checkTradingConditions();
        };

        this.websocket.onerror = (error) => {
            this.logTrade('خطأ في اتصال WebSocket', 'error');
        };

        this.websocket.onclose = () => {
            this.logTrade('تم قطع اتصال WebSocket');
        };
    }

    reconnectWebSocket() {
        this.connectWebSocket();
    }

    addNewTrade() {
        const tradeAmount = parseFloat(this.tradeAmountInput.value);
        const entryPrice = parseFloat(this.entryPriceInput.value);
        const exitPrice = parseFloat(this.exitPriceInput.value);
        const pair = this.pairSelect.value;

        if (!tradeAmount || !entryPrice || !exitPrice) {
            this.logTrade('الرجاء إدخال جميع البيانات المطلوبة للصفقة', 'error');
            return;
        }

        const trade = {
            id: Date.now(),
            pair,
            amount: tradeAmount,
            entryPrice,
            exitPrice,
            status: 'pending'
        };

        this.activeTrades.push(trade);
        this.renderTrade(trade);
        this.logTrade(`تمت إضافة صفقة جديدة: ${pair} بمبلغ ${tradeAmount} USDT`);

        // Clear inputs
        this.tradeAmountInput.value = '';
        this.entryPriceInput.value = '';
        this.exitPriceInput.value = '';
    }

    renderTrade(trade) {
        const tradeElement = document.createElement('div');
        tradeElement.className = 'trade-item';
        tradeElement.id = `trade-${trade.id}`;
        tradeElement.innerHTML = `
            <div class="trade-item-header">
                <span>${trade.pair}</span>
                <button class="remove-trade" onclick="bot.removeTrade(${trade.id})">إلغاء</button>
            </div>
            <div class="trade-item-details">
                <div>المبلغ: ${trade.amount} USDT</div>
                <div>سعر الدخول: ${trade.entryPrice}</div>
                <div>سعر الخروج: ${trade.exitPrice}</div>
                <div>الحالة: ${trade.status === 'pending' ? 'قيد الانتظار' : 'نشط'}</div>
            </div>
        `;
        this.activeTradesList.appendChild(tradeElement);
    }

    removeTrade(tradeId) {
        this.activeTrades = this.activeTrades.filter(trade => trade.id !== tradeId);
        const tradeElement = document.getElementById(`trade-${tradeId}`);
        if (tradeElement) {
            tradeElement.remove();
            this.logTrade('تم إلغاء الصفقة');
        }
    }

    checkTradingConditions() {
        if (!this.isRunning) return;

        this.activeTrades.forEach(trade => {
            if (trade.status === 'pending') {
                if (this.currentPrice <= trade.entryPrice) {
                    this.executeBuy(trade);
                    trade.status = 'active';
                    this.updateTradeDisplay(trade);
                } else if (this.currentPrice >= trade.exitPrice) {
                    this.executeSell(trade);
                    this.removeTrade(trade.id);
                }
            }
        });
    }

    updateTradeDisplay(trade) {
        const tradeElement = document.getElementById(`trade-${trade.id}`);
        if (tradeElement) {
            const statusDiv = tradeElement.querySelector('.trade-item-details div:last-child');
            statusDiv.textContent = `الحالة: ${trade.status === 'pending' ? 'قيد الانتظار' : 'نشط'}`;
        }
    }

    async executeBuy(trade) {
        if (!this.isRunning) return;

        try {
            const result = await binanceApi.placeOrder(trade.pair, 'BUY', trade.amount);
            if (result) {
                trade.status = 'active';
                this.updateTradeDisplay(trade);
                this.logTrade(`تم الشراء: ${trade.amount} ${trade.pair} @ ${this.currentPrice}`);
            }
        } catch (error) {
            this.logTrade(`خطأ في أمر الشراء: ${error.message}`, 'error');
        }
    }

    async executeSell(trade) {
        if (!this.isRunning) return;

        try {
            const result = await binanceApi.placeOrder(trade.pair, 'SELL', trade.amount);
            if (result) {
                this.removeTrade(trade.id);
                this.logTrade(`تم البيع: ${trade.amount} ${trade.pair} @ ${this.currentPrice}`);
            }
        } catch (error) {
            this.logTrade(`خطأ في أمر البيع: ${error.message}`, 'error');
        }
    }

    async startTrading() {
        this.isRunning = true;
        this.startButton.disabled = true;
        this.stopButton.disabled = false;
        
        this.logTrade('بدء التداول الآلي...');
        
        // Start trading loop
        this.tradingLoop();
    }

    stopTrading() {
        this.isRunning = false;
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.logTrade('تم إيقاف التداول الآلي');
        if (this.websocket) {
            this.websocket.close();
        }
    }

    async tradingLoop() {
        while (this.isRunning) {
            try {
                await this.analyzeMarket();
                await this.executeTrades();
                await this.updateStats();
                
                // Delay between iterations
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                this.logTrade(`خطأ: ${error.message}`, 'error');
            }
        }
    }

    async analyzeMarket() {
        // Simulated market analysis OR real market analysis
        let analysis;
        if (config.tradingMode === 'real') {
            // Implement real market analysis here
            analysis = { signal: 'تحليل السوق الحقيقي غير متوفر' }; // Placeholder
            this.logTrade('تحليل السوق الحقيقي قيد التنفيذ...');
        } else {
            analysis = await this.performTechnicalAnalysis(); // Simulated
            this.logTrade(`تحليل السوق: ${analysis.signal}`);
        }
        return analysis;
    }

    async executeTrades() {
        if (config.tradingMode === 'real') {
            // Implement real trade execution here using Binance API
            this.logTrade('تنفيذ صفقات حقيقية قيد التنفيذ...');
            return;
        }
        // Simulated trade execution
        const successful = Math.random() > 0.4;
        const profit = successful ? (Math.random() * 5).toFixed(2) : (-Math.random() * 3).toFixed(2);
        
        this.totalTrades++;
        if (successful) this.successfulTrades++;
        
        this.profits += parseFloat(profit);
        this.updateBalance(profit);
        
        this.logTrade(`تنفيذ صفقة: ${successful ? 'ناجحة' : 'خاسرة'} (${profit} USDT)`);
    }

    async performTechnicalAnalysis() {
        // Simulated technical analysis
        const signals = ['شراء', 'بيع', 'انتظار'];
        const signal = signals[Math.floor(Math.random() * signals.length)];
        return { signal };
    }

    updateBalance(change) {
        this.balance += parseFloat(change);
        this.balanceDisplay.textContent = `${this.balance.toFixed(2)} USDT`;
        this.dailyProfitsDisplay.textContent = `${this.profits.toFixed(2)} USDT`;
        this.totalTradesDisplay.textContent = this.totalTrades;
        
        const successRate = (this.successfulTrades / this.totalTrades * 100) || 0;
        this.successRateDisplay.textContent = `${successRate.toFixed(1)}%`;
        
        // Enable withdraw button if profits are available
        this.withdrawButton.disabled = this.profits <= config.minimumWithdrawalAmount;
    }

    async withdrawProfits() {
        const withdrawalAmount = this.profits * (config.autoWithdrawalPercentage / 100);
        this.profits -= withdrawalAmount;
        
        this.logTrade(`تم سحب الأرباح: ${withdrawalAmount.toFixed(2)} USDT`);
        this.updateBalance(0); // Update displays
    }

    logTrade(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
        this.tradesLog.insertBefore(logEntry, this.tradesLog.firstChild);
    }

    updateStats() {
        // Currently does nothing, but can be used to update stats in the future
    }

    logout() {
        // Stop trading if running
        if (this.isRunning) {
            this.stopTrading();
        }

        // Clear API keys from localStorage
        localStorage.removeItem('binance_api_key');
        localStorage.removeItem('binance_api_secret');

        // Reset bot state
        this.balance = 0;
        this.profits = 0;
        this.totalTrades = 0;
        this.successfulTrades = 0;
        this.activeTrades = [];
        
        // Update displays
        this.updateBalance(0);
        this.activeTradesList.innerHTML = '';
        this.tradesLog.innerHTML = '';

        // Show API key modal
        this.showLoginModal();

        this.logTrade('تم تسجيل الخروج بنجاح');
    }
}

window.bot = new TradingBot();
