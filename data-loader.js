// data-loader.js
class DataLoader {
    constructor() {
        this.data = null;
        this.normalizedData = null;
        this.X_train = null;
        this.y_train = null;
        this.X_test = null;
        this.y_test = null;
        this.min = null;
        this.max = null;
        this.dateLabels = [];
        this.returns = [];
        this.trainIndices = [];
        this.testIndices = [];
        this.dataUrl = 'https://raw.githubusercontent.com/buschevapoly-del/again/main/my_data.csv';
        this.insights = null;
    }

    async loadCSVFromGitHub() {
        try {
            console.log('Loading data from GitHub...');
            const response = await fetch(this.dataUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const content = await response.text();
            this.parseCSV(content);
            return this.data;
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        }
    }

    parseCSV(content) {
        const lines = content.trim().split('\n');
        const parsedData = [];
        this.dateLabels = [];
        this.returns = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(';');
            if (parts.length >= 2) {
                const dateStr = parts[0].trim();
                const price = parseFloat(parts[1].trim());
                
                if (!isNaN(price) && price > 0) {
                    parsedData.push({ date: dateStr, price: price });
                    this.dateLabels.push(dateStr);
                }
            }
        }

        // Sort by date
        parsedData.sort((a, b) => {
            const dateA = this.parseDate(a.date);
            const dateB = this.parseDate(b.date);
            return dateA - dateB;
        });
        
        this.data = parsedData;
        
        // Calculate returns
        this.calculateReturns();
        
        // Calculate insights
        this.calculateInsights();
    }

    parseDate(dateStr) {
        const parts = dateStr.split('.');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
        return new Date(dateStr);
    }

    calculateReturns() {
        if (!this.data || this.data.length < 2) {
            this.returns = [];
            return;
        }
        
        this.returns = [];
        for (let i = 1; i < this.data.length; i++) {
            const ret = (this.data[i].price - this.data[i-1].price) / this.data[i-1].price;
            this.returns.push(ret);
        }
    }

    calculateInsights() {
        if (!this.data || this.data.length === 0 || !this.returns || this.returns.length === 0) {
            this.insights = this.createDefaultInsights();
            return;
        }
        
        const prices = this.data.map(d => d.price);
        const returns = this.returns;
        
        const lastPrice = prices[prices.length - 1];
        const firstPrice = prices[0];
        const totalReturn = (lastPrice - firstPrice) / firstPrice;
        
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sq, n) => sq + Math.pow(n - meanReturn, 2), 0) / returns.length;
        const stdReturn = Math.sqrt(variance);
        const annualizedVolatility = stdReturn * Math.sqrt(252);
        
        const sma50 = this.calculateSMA(prices, 50);
        const sma200 = this.calculateSMA(prices, 200);
        const currentTrend = sma50.length > 0 && sma200.length > 0 && 
                            sma50[sma50.length - 1] > sma200[sma200.length - 1] ? 
                            'Bullish' : 'Bearish';
        
        let maxDrawdown = 0;
        let peak = prices[0];
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > peak) peak = prices[i];
            const drawdown = (peak - prices[i]) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
        
        const rollingVolatilities = [];
        const window = Math.min(20, returns.length);
        for (let i = window; i <= returns.length; i++) {
            const windowReturns = returns.slice(i - window, i);
            const windowMean = windowReturns.reduce((a, b) => a + b, 0) / window;
            const windowVar = windowReturns.reduce((sq, n) => sq + Math.pow(n - windowMean, 2), 0) / window;
            rollingVolatilities.push(Math.sqrt(windowVar) * Math.sqrt(252));
        }
        
        this.insights = {
            basic: {
                totalDays: this.data.length,
                dateRange: `${this.data[0]?.date || 'N/A'} to ${this.data[this.data.length - 1]?.date || 'N/A'}`,
                firstPrice: firstPrice.toFixed(2),
                lastPrice: lastPrice.toFixed(2),
                totalReturn: (totalReturn * 100).toFixed(2) + '%',
                maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%'
            },
            returns: {
                meanDailyReturn: (meanReturn * 100).toFixed(4) + '%',
                stdDailyReturn: (stdReturn * 100).toFixed(4) + '%',
                annualizedVolatility: (annualizedVolatility * 100).toFixed(2) + '%',
                sharpeRatio: (meanReturn / stdReturn * Math.sqrt(252)).toFixed(2),
                positiveDays: ((returns.filter(r => r > 0).length / returns.length) * 100).toFixed(1) + '%'
            },
            trends: {
                currentTrend: currentTrend,
                sma50: sma50.length > 0 ? sma50[sma50.length - 1].toFixed(2) : 'N/A',
                sma200: sma200.length > 0 ? sma200[sma200.length - 1].toFixed(2) : 'N/A'
            },
            volatility: {
                currentRollingVol: rollingVolatilities.length > 0 ? (rollingVolatilities[rollingVolatilities.length - 1] * 100).toFixed(2) + '%' : 'N/A',
                avgRollingVol: rollingVolatilities.length > 0 ? (rollingVolatilities.reduce((a, b) => a + b, 0) / rollingVolatilities.length * 100).toFixed(2) + '%' : 'N/A'
            }
        };
    }
    
    calculateSMA(prices, period) {
        if (prices.length < period) return [];
        
        const sma = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }

    createDefaultInsights() {
        return {
            basic: {
                totalDays: 0,
                dateRange: 'N/A',
                firstPrice: '0.00',
                lastPrice: '0.00',
                totalReturn: '0.00%',
                maxDrawdown: '0.00%'
            },
            returns: {
                meanDailyReturn: '0.00%',
                stdDailyReturn: '0.00%',
                annualizedVolatility: '0.00%',
                sharpeRatio: '0.00',
                positiveDays: '0.0%'
            },
            trends: {
                currentTrend: 'N/A',
                sma50: '0.00',
                sma200: '0.00'
            },
            volatility: {
                currentRollingVol: '0.00%',
                avgRollingVol: '0.00%'
            }
        };
    }

    // ⚠️ ВАЖНО: Метод getInsights должен быть определен КАК ФУНКЦИЯ
    getInsights = () => {
        console.log('getInsights called, returning:', this.insights);
        return this.insights || this.createDefaultInsights();
    }

    prepareData(windowSize = 60, predictionHorizon = 5, testSplit = 0.2) {
        if (!this.returns || this.returns.length === 0) {
            throw new Error('No returns data available');
        }

        const totalSamples = this.returns.length - windowSize - predictionHorizon + 1;
        
        if (totalSamples <= 0) {
            throw new Error('Not enough data for training');
        }

        this.normalizeReturns();

        const sequences = [];
        const targets = [];

        for (let i = 0; i < totalSamples; i++) {
            sequences.push(this.normalizedData.slice(i, i + windowSize).map(v => [v]));
            targets.push(this.normalizedData.slice(i + windowSize, i + windowSize + predictionHorizon));
        }

        const splitIdx = Math.floor(sequences.length * (1 - testSplit));
        
        this.X_train = tf.tensor3d(sequences.slice(0, splitIdx), [splitIdx, windowSize, 1]);
        this.y_train = tf.tensor2d(targets.slice(0, splitIdx), [splitIdx, predictionHorizon]);
        this.X_test = tf.tensor3d(sequences.slice(splitIdx), [sequences.length - splitIdx, windowSize, 1]);
        this.y_test = tf.tensor2d(targets.slice(splitIdx), [sequences.length - splitIdx, predictionHorizon]);

        return this;
    }

    normalizeReturns() {
        if (!this.returns || this.returns.length === 0) {
            throw new Error('No returns data available');
        }

        this.min = Math.min(...this.returns);
        this.max = Math.max(...this.returns);
        
        const range = this.max - this.min || 1;
        this.normalizedData = this.returns.map(ret => (ret - this.min) / range);
    }

    denormalize(value) {
        if (this.min === null || this.max === null) {
            throw new Error('Normalization parameters not available');
        }
        const range = this.max - this.min || 1;
        return value * range + this.min;
    }

    getHistoricalData() {
        if (!this.data) return null;
        
        return {
            dates: this.dateLabels,
            prices: this.data.map(d => d.price),
            returns: this.returns,
            normalizedReturns: this.normalizedData || []
        };
    }

    dispose() {
        [this.X_train, this.y_train, this.X_test, this.y_test].forEach(tensor => {
            if (tensor) tensor.dispose();
        });
        
        this.X_train = null;
        this.y_train = null;
        this.X_test = null;
        this.y_test = null;
        this.normalizedData = null;
        this.insights = null;
    }
}

// ⚠️ ВАЖНО: Экспортируем класс
export { DataLoader };
