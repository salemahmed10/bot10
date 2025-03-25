export const config = {
    // Admin Configuration
    adminUsername: 'admin',
    adminPassword: 'admin123', // Change this in production
    
    // Subscription Plans
    subscriptionFees: {
        monthly: 100,
        quarterly: 250,
        yearly: 800
    },
    
    // Exchange Configuration
    supportedExchanges: {
        binance: {
            name: 'Binance',
            wsEndpoint: 'wss://stream.binance.com:9443/ws',
            restEndpoint: 'https://api.binance.com',
            testnetEndpoint: 'https://testnet.binance.vision'
        },
        okx: {
            name: 'OKX',
            wsEndpoint: 'wss://ws.okx.com:8443/ws/v5/public',
            restEndpoint: 'https://www.okx.com/api/v5',
            testnetEndpoint: 'https://testnet.okx.com/api/v5'
        }
    },
    
    // Trading Execution Mode
    tradingMode: 'real', // 'real' for live trading, 'simulated' for demo
    
    // Trading Parameters
    defaultTradingPair: 'BTCUSDT',
    availablePairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT'],
    defaultLeverage: 5, // Added leverage for futures trading
    
    // Risk Management
    maxTradesPerDay: 10,
    defaultRiskPercentage: 20,
    defaultStopLoss: 5,
    defaultTakeProfit: 10,
    
    // Profit Withdrawal
    autoWithdrawalPercentage: 50,
    minimumWithdrawalAmount: 100,
    
    // Trading Limits (Minimum trade amounts for each pair)
    minTradeAmount: {
        'BTCUSDT': 0.001,
        'ETHUSDT': 0.01,
        'BNBUSDT': 0.1,
        'ADAUSDT': 1,
        'DOGEUSDT': 100
    },
    
    // Price precision for each pair
    pricePrecision: {
        'BTCUSDT': 2,
        'ETHUSDT': 2,
        'BNBUSDT': 2,
        'ADAUSDT': 4,
        'DOGEUSDT': 5
    }
};
