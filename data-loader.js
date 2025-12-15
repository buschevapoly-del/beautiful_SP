// data-loader.js (исправленная версия с методом getInsights)
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
            console.log('📥 Loading data from GitHub...');
            
            const response = await fetch(this.dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const content = await response.text();
            console.log('✅ Data loaded, parsing...');
            this.parseCSV(content);
            
            console.log(`✅ Parsed ${this.data?.length || 0} records`);
            return this.data;
        } catch (error) {
            console.error('❌ Failed to load data:', error);
            throw new Error(`Failed to load data: ${error.message}`);
        }
    }

    parseCSV(content) {
        console.log('Parsing CSV content...');
        const lines = content.trim().split('\n');
        const parsedData = [];
        this.dateLabels = [];
        this.returns = [];

        // Пропускаем заголовок
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(';');
            
            if (parts.length >= 2) {
                const dateStr = parts[0].trim();
                const price = parseFloat(parts[1].trim());
                
                if (!isNaN(price) && price > 0) {
                    parsedData.push({ 
                        date: dateStr, 
                        price: price
                    });
                    this.dateLabels.push(dateStr);
                }
            }
        }

        console.log(`Parsed ${parsedData.length} valid records`);

        // Сортируем по дате
        parsedData.sort((a, b) => {
            const dateA = this.parseDate(a.date);
            const dateB = this.parseDate(b.date);
            return dateA - dateB;
        });
        
        this.data = parsedData;
        
        // Рассчитываем доходности
        this.calculateReturns();
        
        // Рассчитываем аналитику
        this.calculateInsights();
        
        console.log('✅ CSV parsing completed');
    }

    parseDate(dateStr) {
        // Формат DD.MM.YYYY
        try {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                return new Date(year, month, day);
            }
        } catch (e) {
            console.warn('Date parsing error:', e);
        }
        return new Date(dateStr);
    }

    calculateReturns() {
        if (!this.data || this.data.length < 2) return;
        
        this.returns = [];
        for (let i = 1; i < this.data.length; i++) {
            const ret = (this.data[i].price - this.data[i-1].price) / this.data[i-1].price;
            this.returns.push(ret);
        }
        
        console.log(`Calculated ${this.returns.length} returns`);
    }

    calculateInsights() {
        if (!this.data || this.data.length === 0 || !this.returns || this.returns.length === 0) {
            console.warn('Cannot calculate insights: no data');
            this.insights = this.getDefaultInsights();
            return;
        }
        
        const prices = this.data.map(d => d.price);
        const returns = this.returns;
        
        // 1. Basic Statistics
        const lastPrice = prices[prices.length - 1];
        const firstPrice = prices[0];
        const totalReturn = (lastPrice - firstPrice) / firstPrice;
        
        // 2. Daily Returns Statistics
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sq, n) => sq + Math.pow(n - meanReturn, 2), 0) / returns.length;
        const stdReturn = Math.sqrt(variance);
        const annualizedVolatility = stdReturn * Math.sqrt(252);
        
        // 3. Simple Moving Averages
        const sma50 = this.calculateSMA(prices, 50);
        const sma200 = this.calculateSMA(prices, 200);
        const currentTrend = sma50.length > 0 && sma200.length > 0 && 
                            sma50[sma50.length - 1] > sma200[sma200.length - 1] ? 
                            'Bullish' : 'Bearish';
        
        // 4. Maximum Drawdown
        let maxDrawdown = 0;
        let peak = prices[0];
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > peak) peak = prices[i];
            const drawdown = (peak - prices[i]) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
        
        // 5. Rolling Volatility (20-day)
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
                sma200: sma200.length > 0 ? sma200[sma200.length - 1].toFixed(2) : 'N/A',
                aboveSMA200: lastPrice > (sma200[sma200.length - 1] || 0) ? 'Yes' : 'No'
            },
            volatility: {
                currentRollingVol: rollingVolatilities.length > 0 ? (rollingVolatilities[rollingVolatilities.length - 1] * 100).toFixed(2) + '%' : 'N/A',
                avgRollingVol: rollingVolatilities.length > 0 ? (rollingVolatilities.reduce((a, b) => a + b, 0) / rollingVolatilities.length * 100).toFixed(2) + '%' : 'N/A'
            }
        };
        
        console.log('✅ Insights calculated');
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

    getDefaultInsights() {
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
                sma200: '0.00',
                aboveSMA200: 'No'
            },
            volatility: {
                currentRollingVol: '0.00%',
                avgRollingVol: '0.00%'
            }
        };
    }

    prepareData(windowSize = 60, predictionHorizon = 5, testSplit = 0.2) {
        if (!this.returns || this.returns.length === 0) {
            throw new Error('No returns data available. Load CSV first.');
        }

        const totalSamples = this.returns.length - windowSize - predictionHorizon + 1;
        
        if (totalSamples <= 0) {
            throw new Error('Not enough data for training');
        }

        // Нормализуем доходности
        this.normalizeReturns();

        // Создаем последовательности
        const sequences = [];
        const targets = [];

        for (let i = 0; i < totalSamples; i++) {
            sequences.push(this.normalizedData.slice(i, i + windowSize).map(v => [v]));
            targets.push(this.normalizedData.slice(i + windowSize, i + windowSize + predictionHorizon));
        }

        // Разделяем на тренировочные и тестовые данные
        const splitIdx = Math.floor(sequences.length * (1 - testSplit));
        
        // Создаем тензоры
        this.X_train = tf.tensor3d(sequences.slice(0, splitIdx), [splitIdx, windowSize, 1]);
        this.y_train = tf.tensor2d(targets.slice(0, splitIdx), [splitIdx, predictionHorizon]);
        this.X_test = tf.tensor3d(sequences.slice(splitIdx), [sequences.length - splitIdx, windowSize, 1]);
        this.y_test = tf.tensor2d(targets.slice(splitIdx), [sequences.length - splitIdx, predictionHorizon]);

        console.log(`✅ Data prepared: ${sequences.length} samples (${splitIdx} train, ${sequences.length - splitIdx} test)`);
        console.log(`X_train shape: ${this.X_train.shape}`);
        console.log(`y_train shape: ${this.y_train.shape}`);
        
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

    getInsights() {
        return this.insights || this.getDefaultInsights();
    }

    getDataSummary() {
        return this.insights?.basic || null;
    }

    dispose() {
        // Освобождаем тензоры TensorFlow.js
        const tensors = [this.X_train, this.y_train, this.X_test, this.y_test];
        tensors.forEach(tensor => {
            if (tensor) tensor.dispose();
        });
        
        this.X_train = null;
        this.y_train = null;
        this.X_test = null;
        this.y_test = null;
        this.normalizedData = null;
        this.insights = null;
        
        console.log('✅ DataLoader disposed');
    }
}

export { DataLoader };
