// app.js (упрощенная версия)
import { DataLoader } from './data-loader.js';
import { GRUModel } from './gru.js';

class StockPredictorApp {
    constructor() {
        console.log('Starting app...');
        this.dataLoader = new DataLoader();
        this.model = new GRUModel();
        this.charts = {};
        this.isTraining = false;
        this.predictions = null;
        
        this.initUI();
        this.setupEventListeners();
        this.loadData();
    }

    initUI() {
        document.getElementById('dataStatus').textContent = 'Loading data...';
        document.getElementById('trainingStatus').textContent = 'Ready';
        document.getElementById('progressBar').style.display = 'none';
    }

    setupEventListeners() {
        document.getElementById('loadDataBtn').addEventListener('click', () => this.loadData());
        document.getElementById('viewDataBtn').addEventListener('click', () => this.viewData());
        document.getElementById('trainBtn').addEventListener('click', () => this.trainModel());
        document.getElementById('predictBtn').addEventListener('click', () => this.makePredictions());
    }

    async loadData() {
        try {
            this.updateStatus('dataStatus', 'Loading data...', 'info');
            
            await this.dataLoader.loadCSVFromGitHub();
            this.dataLoader.prepareData();
            
            document.getElementById('viewDataBtn').disabled = false;
            document.getElementById('trainBtn').disabled = false;
            document.getElementById('loadDataBtn').innerHTML = '🔄 Reload';
            
            // ⚠️ ПРОВЕРКА: Метод getInsights существует?
            console.log('Checking getInsights method:', typeof this.dataLoader.getInsights);
            console.log('Is function?', typeof this.dataLoader.getInsights === 'function');
            
            // Пробуем получить insights
            const insights = this.dataLoader.getInsights();
            console.log('Insights received:', insights);
            
            this.updateStatus('dataStatus', '✅ Data loaded!', 'success');
            
        } catch (error) {
            console.error('Load data error:', error);
            this.updateStatus('dataStatus', `❌ ${error.message}`, 'error');
        }
    }

    viewData() {
        try {
            // ⚠️ Используем try-catch для безопасности
            const insights = this.dataLoader.getInsights ? 
                this.dataLoader.getInsights() : 
                { basic: { totalDays: 0, dateRange: 'N/A' } };
            
            console.log('Viewing insights:', insights);
            
            const metricsContainer = document.getElementById('metricsContainer');
            metricsContainer.innerHTML = '';
            metricsContainer.style.display = 'grid';
            
            const metrics = [
                { label: 'Total Days', value: insights.basic.totalDays },
                { label: 'Date Range', value: insights.basic.dateRange },
                { label: 'First Price', value: `$${insights.basic.firstPrice}` },
                { label: 'Last Price', value: `$${insights.basic.lastPrice}` },
                { label: 'Total Return', value: insights.basic.totalReturn },
                { label: 'Max Drawdown', value: insights.basic.maxDrawdown },
                { label: 'Mean Return', value: insights.returns.meanDailyReturn },
                { label: 'Annual Volatility', value: insights.returns.annualizedVolatility },
                { label: 'Current Trend', value: insights.trends.currentTrend },
                { label: 'SMA 50', value: `$${insights.trends.sma50}` }
            ];
            
            metrics.forEach(metric => {
                const card = document.createElement('div');
                card.className = 'metric-card';
                card.innerHTML = `
                    <div class="metric-value">${metric.value}</div>
                    <div class="metric-label">${metric.label}</div>
                `;
                metricsContainer.appendChild(card);
            });
            
        } catch (error) {
            console.error('View data error:', error);
            this.updateStatus('dataStatus', 'Error showing data', 'error');
        }
    }

    async trainModel() {
        if (this.isTraining) return;

        try {
            this.isTraining = true;
            const epochs = parseInt(document.getElementById('epochs').value) || 12;
            
            this.updateStatus('trainingStatus', `Starting training...`, 'info');
            
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            progressBar.style.display = 'block';
            progressFill.style.width = '0%';
            
            if (!this.dataLoader.X_train || !this.dataLoader.y_train) {
                throw new Error('Training data not loaded');
            }
            
            await this.model.train(
                this.dataLoader.X_train,
                this.dataLoader.y_train,
                epochs,
                {
                    onEpochEnd: (epoch, logs) => {
                        const currentEpoch = epoch + 1;
                        const progress = (currentEpoch / epochs) * 100;
                        progressFill.style.width = `${progress}%`;
                        
                        this.updateStatus('trainingStatus', 
                            `Epoch ${currentEpoch}/${epochs} | Loss: ${logs.loss?.toFixed(6) || '0.000000'}`,
                            'info'
                        );
                    },
                    onTrainEnd: () => {
                        this.isTraining = false;
                        progressBar.style.display = 'none';
                        document.getElementById('predictBtn').disabled = false;
                        
                        this.updateStatus('trainingStatus', 
                            '✅ Training completed!',
                            'success'
                        );
                    }
                }
            );
            
        } catch (error) {
            this.isTraining = false;
            document.getElementById('progressBar').style.display = 'none';
            document.getElementById('predictBtn').disabled = false;
            
            this.updateStatus('trainingStatus', 
                '⚠️ Training issue',
                'warning'
            );
        }
    }

    async makePredictions() {
        try {
            this.updateStatus('trainingStatus', 'Generating predictions...', 'info');
            
            const normalizedData = this.dataLoader.normalizedData;
            const windowSize = this.model.windowSize;
            
            if (!normalizedData || normalizedData.length < windowSize) {
                throw new Error('Not enough data');
            }
            
            const lastWindow = normalizedData.slice(-windowSize);
            const lastWindowFormatted = lastWindow.map(v => [v]);
            const inputTensor = tf.tensor3d([lastWindowFormatted], [1, windowSize, 1]);
            
            const normalizedPredictions = await this.model.predict(inputTensor);
            inputTensor.dispose();
            
            this.predictions = normalizedPredictions[0].map(p => 
                this.dataLoader.denormalize(p)
            );
            
            this.displayPredictions();
            
            this.updateStatus('trainingStatus', '✅ Predictions generated!', 'success');
            
        } catch (error) {
            this.updateStatus('trainingStatus', `⚠️ ${error.message}`, 'warning');
        }
    }

    displayPredictions() {
        const container = document.getElementById('predictionsContainer');
        container.innerHTML = '';
        
        const lastPrice = this.dataLoader.data[this.dataLoader.data.length - 1].price;
        let currentPrice = lastPrice;
        
        this.predictions.forEach((pred, idx) => {
            const day = idx + 1;
            const returnPct = pred * 100;
            const priceChange = currentPrice * pred;
            const newPrice = currentPrice + priceChange;
            
            const card = document.createElement('div');
            card.className = 'prediction-card';
            card.innerHTML = `
                <div class="prediction-day">Day +${day}</div>
                <div class="prediction-value ${returnPct >= 0 ? 'positive' : 'negative'}">
                    ${returnPct.toFixed(3)}%
                </div>
                <div class="prediction-details">
                    Price: $${newPrice.toFixed(2)}
                </div>
            `;
            
            container.appendChild(card);
            currentPrice = newPrice;
        });
    }

    updateStatus(elementId, message, type = 'info') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = `status ${type}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new StockPredictorApp();
});
