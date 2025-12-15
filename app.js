// app.js (исправленная версия)
import { DataLoader } from './data-loader.js';
import { GRUModel } from './gru.js';

class StockPredictorApp {
    constructor() {
        console.log('🚀 Starting Stock Predictor App');
        this.dataLoader = new DataLoader();
        this.model = new GRUModel();
        this.charts = {};
        this.isTraining = false;
        this.predictions = null;
        this.insights = null;
        
        this.initUI();
        this.setupEventListeners();
        this.autoLoadData();
    }

    initUI() {
        console.log('🖥️ Initializing UI');
        document.getElementById('dataStatus').textContent = '⏳ Loading S&P 500 data...';
        document.getElementById('trainingStatus').textContent = '🟡 Waiting for data...';
        document.getElementById('progressBar').style.display = 'none';
    }

    setupEventListeners() {
        console.log('🔗 Setting up event listeners');
        
        document.getElementById('loadDataBtn').addEventListener('click', () => {
            console.log('📥 Load Data button clicked');
            this.loadData();
        });

        document.getElementById('viewDataBtn').addEventListener('click', () => {
            console.log('👁️ View Data button clicked');
            this.displayInsights();
        });

        document.getElementById('trainBtn').addEventListener('click', async () => {
            console.log('🎯 Train Model button clicked');
            await this.trainModel();
        });

        document.getElementById('predictBtn').addEventListener('click', () => {
            console.log('🔮 Predict button clicked');
            this.makePredictions();
        });
    }

    destroyChart(chartName) {
        if (this.charts[chartName]) {
            try {
                this.charts[chartName].destroy();
                this.charts[chartName] = null;
            } catch (error) {
                console.warn('Chart destroy error:', error);
            }
        }
    }

    async autoLoadData() {
        console.log('🌐 Auto-loading data...');
        try {
            this.updateStatus('dataStatus', '🌐 Downloading S&P 500 data...', 'info');
            
            // Загружаем данные
            await this.dataLoader.loadCSVFromGitHub();
            this.dataLoader.prepareData();
            
            // Активируем кнопки
            document.getElementById('viewDataBtn').disabled = false;
            document.getElementById('trainBtn').disabled = false;
            document.getElementById('loadDataBtn').innerHTML = '🔄 Reload Data';
            
            this.updateStatus('dataStatus', '✅ Data loaded successfully!', 'success');
            this.updateStatus('trainingStatus', '🟢 Ready for training', 'info');
            
            console.log('✅ Data loaded successfully');
            
        } catch (error) {
            console.error('❌ Auto-load failed:', error);
            this.updateStatus('dataStatus', `❌ Failed to load data: ${error.message}`, 'error');
        }
    }

    async loadData() {
        try {
            this.updateStatus('dataStatus', '🔄 Reloading data...', 'info');
            
            // Очищаем
            this.dataLoader.dispose();
            this.model.dispose();
            this.predictions = null;
            
            Object.keys(this.charts).forEach(chart => this.destroyChart(chart));
            
            // Загружаем заново
            await this.dataLoader.loadCSVFromGitHub();
            this.dataLoader.prepareData();
            
            this.updateStatus('dataStatus', '✅ Data reloaded!', 'success');
            
        } catch (error) {
            this.updateStatus('dataStatus', `❌ Error: ${error.message}`, 'error');
        }
    }

    displayInsights() {
        console.log('📊 Displaying insights');
        
        try {
            // Получаем insights из dataLoader
            const insights = this.dataLoader.getInsights();
            console.log('Insights:', insights);
            
            const metricsContainer = document.getElementById('metricsContainer');
            metricsContainer.innerHTML = '';
            metricsContainer.style.display = 'grid';
            
            // Создаем карточки с метриками
            const metrics = [
                { label: '📈 Total Return', value: insights.basic.totalReturn },
                { label: '📉 Max Drawdown', value: insights.basic.maxDrawdown },
                { label: '📊 Annual Volatility', value: insights.returns.annualizedVolatility },
                { label: '🎯 Sharpe Ratio', value: insights.returns.sharpeRatio },
                { label: '📅 Positive Days', value: insights.returns.positiveDays },
                { label: '🚦 Current Trend', value: insights.trends.currentTrend },
                { label: '📊 SMA 50', value: `$${insights.trends.sma50}` },
                { label: '📈 SMA 200', value: `$${insights.trends.sma200}` }
            ];
            
            metrics.forEach(metric => {
                const card = document.createElement('div');
                card.className = 'insight-card';
                card.innerHTML = `
                    <div class="insight-value">${metric.value}</div>
                    <div class="insight-label">${metric.label}</div>
                `;
                metricsContainer.appendChild(card);
            });
            
            // Создаем график
            this.createChart();
            
        } catch (error) {
            console.error('Error displaying insights:', error);
            this.updateStatus('dataStatus', 'Error showing insights', 'error');
        }
    }

    createChart() {
        console.log('📈 Creating chart');
        
        const historicalData = this.dataLoader.getHistoricalData();
        if (!historicalData) {
            console.warn('No historical data for chart');
            return;
        }
        
        this.destroyChart('main');
        
        const ctx = document.getElementById('historicalChart').getContext('2d');
        
        this.charts.main = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historicalData.dates,
                datasets: [{
                    label: 'S&P 500 Price',
                    data: historicalData.prices,
                    borderColor: '#ff6b81',
                    backgroundColor: 'rgba(255, 107, 129, 0.1)',
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'S&P 500 Historical Prices',
                        color: '#ffccd5',
                        font: { size: 14 }
                    },
                    legend: {
                        labels: {
                            color: '#ffccd5',
                            font: { size: 11 }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#ffccd5',
                            font: { size: 10 }
                        },
                        grid: { 
                            color: 'rgba(255,255,255,0.05)'
                        }
                    },
                    y: {
                        ticks: { 
                            color: '#ffccd5',
                            font: { size: 10 },
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        },
                        grid: { 
                            color: 'rgba(255,255,255,0.05)'
                        }
                    }
                }
            }
        });
    }

    async trainModel() {
        if (this.isTraining) {
            console.log('⚠️ Already training');
            return;
        }

        try {
            this.isTraining = true;
            const epochs = parseInt(document.getElementById('epochs').value) || 12;
            
            console.log(`🎯 Starting training: ${epochs} epochs`);
            this.updateStatus('trainingStatus', `🚀 Starting training (${epochs} epochs)...`, 'info');
            
            // Показываем прогресс бар
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            progressBar.style.display = 'block';
            progressFill.style.width = '0%';
            
            // Проверяем данные
            if (!this.dataLoader.X_train || !this.dataLoader.y_train) {
                throw new Error('Training data not loaded');
            }
            
            console.log('Training data shapes:', {
                X_train: this.dataLoader.X_train.shape,
                y_train: this.dataLoader.y_train.shape
            });
            
            // Запускаем обучение
            await this.model.train(
                this.dataLoader.X_train,
                this.dataLoader.y_train,
                epochs,
                {
                    onEpochEnd: (epoch, logs) => {
                        const currentEpoch = epoch + 1;
                        const progress = (currentEpoch / epochs) * 100;
                        progressFill.style.width = `${progress}%`;
                        
                        const loss = logs.loss?.toFixed(6) || '0.000000';
                        this.updateStatus('trainingStatus', 
                            `⚡ Epoch ${currentEpoch}/${epochs} | Loss: ${loss}`,
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
            console.error('❌ Training failed:', error);
            this.isTraining = false;
            document.getElementById('progressBar').style.display = 'none';
            document.getElementById('predictBtn').disabled = false;
            
            this.updateStatus('trainingStatus', 
                `⚠️ Training issue: ${error.message}`,
                'warning'
            );
        }
    }

    async makePredictions() {
        try {
            console.log('🔮 Making predictions');
            this.updateStatus('trainingStatus', '🔮 Generating predictions...', 'info');
            
            const normalizedData = this.dataLoader.normalizedData;
            const windowSize = this.model.windowSize;
            
            if (!normalizedData || normalizedData.length < windowSize) {
                throw new Error('Not enough data');
            }
            
            // Берем последние 60 дней
            const lastWindow = normalizedData.slice(-windowSize);
            const lastWindowFormatted = lastWindow.map(v => [v]);
            const inputTensor = tf.tensor3d([lastWindowFormatted], [1, windowSize, 1]);
            
            // Предсказание
            const normalizedPredictions = await this.model.predict(inputTensor);
            inputTensor.dispose();
            
            // Денормализация
            this.predictions = normalizedPredictions[0].map(p => 
                this.dataLoader.denormalize(p)
            );
            
            console.log('Predictions:', this.predictions);
            
            // Показываем предсказания
            this.displayPredictions();
            
            this.updateStatus('trainingStatus', '✅ Predictions generated!', 'success');
            
        } catch (error) {
            console.error('❌ Prediction error:', error);
            this.updateStatus('trainingStatus', `⚠️ ${error.message}`, 'warning');
        }
    }

    displayPredictions() {
        console.log('📊 Displaying predictions');
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
                <div class="prediction-details">
                    Change: ${priceChange >= 0 ? '+' : ''}$${priceChange.toFixed(2)}
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
            
            if (elementId === 'loadDataBtn') {
                const btn = document.getElementById('loadDataBtn');
                if (message.includes('Downloading') || message.includes('Loading')) {
                    btn.innerHTML = '<span class="loader"></span> Loading...';
                } else if (message.includes('✅')) {
                    btn.innerHTML = '🔄 Reload Data';
                }
            }
        }
    }
}

// Запускаем приложение
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded');
    window.app = new StockPredictorApp();
});
