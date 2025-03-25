import { binanceApi } from './binanceApi.js';
import { config } from './config.js';

class TradingEngine {
    async executeBuy(pair, amount) {
        if (config.tradingMode === 'real') {
            try {
                const result = await binanceApi.placeOrder(pair, 'BUY', amount);
                if (result) {
                    console.log(`Real buy order executed: ${amount} ${pair} @ market price`);
                    return result;
                }
            } catch (error) {
                console.error(`Error executing buy order: ${error.message}`);
            }
        } else {
            console.log(`Simulated buy: ${amount} ${pair}`);
            return { simulated: true };
        }
    }

    async executeSell(pair, amount) {
        if (config.tradingMode === 'real') {
            try {
                const result = await binanceApi.placeOrder(pair, 'SELL', amount);
                if (result) {
                    console.log(`Real sell order executed: ${amount} ${pair} @ market price`);
                    return result;
                }
            } catch (error) {
                console.error(`Error executing sell order: ${error.message}`);
            }
        } else {
            console.log(`Simulated sell: ${amount} ${pair}`);
            return { simulated: true };
        }
    }
}

export const tradingEngine = new TradingEngine();

