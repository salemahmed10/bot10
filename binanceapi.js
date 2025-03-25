import { config } from './config.js';

class BinanceApi {
    constructor() {
        this.apiKey = localStorage.getItem('binance_api_key') || '';
        this.apiSecret = localStorage.getItem('binance_api_secret') || '';
        this.endpoint = config.supportedExchanges.binance.restEndpoint;
    }

    async placeOrder(symbol, side, quantity) {
        if (!this.apiKey || !this.apiSecret) {
            console.error('Binance API keys are missing');
            return null;
        }

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

    async getAccountBalance(asset) {
        const timestamp = Date.now();
        const params = new URLSearchParams({ timestamp });

        const signature = this.generateSignature(params.toString());
        params.append('signature', signature);

        try {
            const response = await fetch(`${this.endpoint}/api/v3/account?${params.toString()}`, {
                method: 'GET',
                headers: { 'X-MBX-APIKEY': this.apiKey }
            });

            const data = await response.json();
            if (data.balances) {
                const balance = data.balances.find(b => b.asset === asset);
                return balance ? parseFloat(balance.free) : 0;
            } else {
                throw new Error('Failed to fetch balance');
            }
        } catch (error) {
            console.error('Balance fetch error:', error);
            return 0;
        }
    }

    generateSignature(queryString) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(this.apiSecret);
        const messageData = encoder.encode(queryString);

        return crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        ).then(key => crypto.subtle.sign('HMAC', key, messageData))
        .then(signature => {
            return Array.from(new Uint8Array(signature))
                .map(byte => byte.toString(16).padStart(2, '0')).join('');
        });
    }
}

export const binanceApi = new BinanceApi();

