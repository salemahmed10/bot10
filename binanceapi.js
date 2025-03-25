import { config } from './config.js';

class BinanceApi {
    constructor() {
        this.apiKey = localStorage.getItem('binance_api_key') || '';
        this.apiSecret = localStorage.getItem('binance_api_secret') || '';
        this.endpoint = config.supportedExchanges.binance.restEndpoint;
    }

    async placeOrder(symbol, side, quantity) {
        const timestamp = Date.now();
        const params = new URLSearchParams({
            symbol,
            side: side.toUpperCase(),
            type: 'MARKET',
            quantity,
            timestamp
        });

        const signature = this.generateSignature(params.toString());
        params.append('signature', signature);

        try {
            const response = await fetch(`${this.endpoint}/api/v3/order`, {
                method: 'POST',
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            const data = await response.json();
            if (data.orderId) {
                console.log(`Order placed successfully: ${data.orderId}`);
                return data;
            } else {
                throw new Error(data.msg || 'Unknown error');
            }
        } catch (error) {
            console.error('Order error:', error);
            return null;
        }
    }

    generateSignature(queryString) {
        return CryptoJS.HmacSHA256(queryString, this.apiSecret).toString(CryptoJS.enc.Hex);
    }
}

export const binanceApi = new BinanceApi();



