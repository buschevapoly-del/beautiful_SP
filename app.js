// app.js (исправленная версия с гарантированным запуском обучения)
import { DataLoader } from './data-loader.js';
import { GRUModel } from './gru.js';

class StockPredictorApp {
    constructor() {
        console.log('🚀 Initializing Stock Predictor App');
        
        this.dataLoader = new DataLoader();
        this.model = new GRUModel();
        this.charts = {};
        this.isTraining = false;
        this.predictions = null;
        this.insights = null;
        
        this.initUI();
        this.setupEventListeners();
        
        // Автоматически загружаем данные при запуске
        this.autoLoadData();
    }

    initUI() {
        console.log('🖥️ Initializing UI');
        document.getElementById('dataStatus').textContent = '⏳ Loading S&P 500 data...';
        document.getElementById('trainingStatus').textContent = '🟡 Waiting for data...';
        
        // Инициализируем прогресс бар
        const progressBar = document.getElementById('progressBar');
        progressBar.style.display = 'none';
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

    async autoLoadData() {
        console.log('🌐 Auto-loading data from GitHub...');
        
        try {
            this.updateStatus('dataStatus', '🌐 Downloading S&P 500 data...', 'info');
            
            // Загружаем данные
            await this.dataLoader.loadCSVFromGitHub();
            
            // Подготавливаем данные для обучения
            this.dataLoader.prepareData();
            
            // Получаем аналитику
            this.insights = this.dataLoader.getInsights();
            
            // Активируем кнопки
            document.getElementById('viewDataBtn').disabled = false;
            document.getElementById('trainBtn').disabled = false;
            document.getElementById('loadDataBtn').innerHTML = '🔄 Reload Data';
            
            // Показываем аналитику
            this.displayInsights();
            
            // Создаем графики
            this.createCombinedChart();
            
            this.updateStatus('dataStatus', '✅ Data loaded successfully!', 'success');
            this.updateStatus('trainingStatus', '🟢 Ready for training', 'info');
            
            console.log('✅ Data loaded:', {
                samples: this.dataLoader.data?.length || 0,
                returns: this.dataLoader.returns?.length || 0
            });
            
        } catch (error) {
            console.error('❌ Auto-load failed:', error);
            this.updateStatus('dataStatus', `❌ Failed to load data: ${error.message}`, 'error');
        }
    }

    async loadData() {
        try {
            this.updateStatus('dataStatus', '🔄 Reloading data...', 'info');
            
            // Очищаем предыдущие данные
            this.dataLoader.dispose();
            this.model.dispose();
            this.predictions = null;
            
            // Очищаем графики
            Object.keys(this.charts).forEach(chart => {
                if (this.charts[chart]) {
                    this.charts[chart].destroy();
                    this.charts[chart] = null;
                }
            });
            
            // Загружаем данные заново
            await this.dataLoader.loadCSVFromGitHub();
            this.dataLoader.prepareData();
            
            this.insights = this.dataLoader.getInsights();
            this.displayInsights();
            this.createCombinedChart();
            
            this.updateStatus('dataStatus', '✅ Data reloaded!', 'success');
            
        } catch (error) {
            this.updateStatus('dataStatus', `❌ Error: ${error.message}`, 'error');
        }
    }

    async trainModel() {
        console.log('🎯 STARTING MODEL TRAINING');
        
        if (this.isTraining) {
            console.log('⚠️ Already training, skipping...');
            return;
        }

        try {
            this.isTraining = true;
            
            // Получаем количество эпох
            const epochsInput = document.getElementById('epochs');
            const epochs = parseInt(epochsInput.value) || 12;
            
            console.log(`Training configuration: ${epochs} epochs`);
            
            // Обновляем статус
            this.updateStatus('trainingStatus', `🚀 Starting training (${epochs} epochs)...`, 'info');
            
            // Показываем прогресс бар
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            progressBar.style.display = 'block';
            progressFill.style.width = '0%';
            
            // Проверяем что данные загружены
            if (!this.dataLoader.X_train || !this.dataLoader.y_train) {
                throw new Error('Training data not loaded. Please load data first.');
            }
            
            console.log('Training data shapes:', {
                X_train: this.dataLoader.X_train.shape,
                y_train: this.dataLoader.y_train.shape
            });
            
            // ЗАПУСКАЕМ ОБУЧЕНИЕ
            console.log('Calling model.train()...');
            
            const startTime = Date.now();
            
            await this.model.train(
                this.dataLoader.X_train,
                this.dataLoader.y_train,
                epochs, // Количество эпох
                {       // Callbacks
                    onEpochEnd: (epoch, logs) => {
                        const currentEpoch = epoch + 1;
                        const progress = (currentEpoch / epochs) * 100;
                        
                        // Обновляем прогресс бар
                        progressFill.style.width = `${progress}%`;
                        
                        // Обновляем статус
                        const elapsed = logs.elapsed?.toFixed(1) || '0';
                        const loss = logs.loss?.toFixed(6) || '0.000000';
                        
                        this.updateStatus('trainingStatus', 
                            `⚡ Epoch ${currentEpoch}/${epochs} | Loss: ${loss} | ${elapsed}s`,
                            'info'
                        );
                        
                        console.log(`Epoch ${currentEpoch}/${epochs}: loss=${loss}`);
                    },
                    onTrainEnd: (totalTime) => {
                        const trainingTime = totalTime || ((Date.now() - startTime) / 1000).toFixed(1);
                        
                        this.isTraining = false;
                        progressBar.style.display = 'none';
                        
                        // Активируем кнопку предсказаний
                        document.getElementById('predictBtn').disabled = false;
                        
                        // Оцениваем модель
                        const metrics = this.model.evaluate(this.dataLoader.X_test, this.dataLoader.y_test);
                        
                        // Обновляем статус
                        this.updateStatus('trainingStatus', 
                            `✅ Training completed in ${trainingTime}s! RMSE: ${(metrics.rmse * 100).toFixed(3)}%`,
                            'success'
                        );
                        
                        console.log(`✅ Training completed in ${trainingTime}s, RMSE: ${metrics.rmse}`);
                        
                        // Показываем метрики
                        this.showTrainingMetrics(metrics);
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

    showTrainingMetrics(metrics) {
        const metricsContainer = document.getElementById('metricsContainer');
        
        const trainingMetrics = [
            { label: '🎯 Test RMSE', value: metrics.rmse.toFixed(6) },
            { label: '📊 Test MSE', value: metrics.mse.toFixed(6) },
            { label: '⚡ Training Status', value: 'Completed' },
            { label: '📈 Return Error', value: (metrics.rmse * 100).toFixed(4) + '%' }
        ];
        
        trainingMetrics.forEach(metric => {
            const card = document.createElement('div');
            card.className = 'insight-card fade-in';
            card.innerHTML = `
                <div class="insight-value">${metric.value}</div>
                <div class="insight-label">${metric.label}</div>
            `;
            metricsContainer.appendChild(card);
        });
    }

    // ... остальные методы остаются такими же ...

    updateStatus(elementId, message, type = 'info') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = `status ${type}`;
            
            // Обновляем кнопку загрузки
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
    console.log('📄 DOM loaded, starting application...');
    window.app = new StockPredictorApp();
});
