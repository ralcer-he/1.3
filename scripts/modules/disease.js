// public/scripts/modules/disease.js
import { fetchLocalData, showLoading, createElement } from '../utils.js';

class DiseaseModule {
  constructor() {
    this.diseaseData = null;
    this.currentSymptoms = new Set();
    this.feedbackHistory = [];
    this.diagnosisHistory = JSON.parse(localStorage.getItem('diagnosisHistory') || '[]');
    window.currentModule = this; // 确保 currentModule 正确指向当前实例
  }


  async init() {
    try {
      this.diseaseData = await fetchLocalData('../../data/diseases.json');
      this.renderDiagnosisInterface();
      this.bindEvents();
    } catch (error) {
      console.error('疾病模块初始化失败:', error);
      this.showError('无法加载疾病数据库');
    }
  }

  renderDiagnosisInterface() {
    const container = document.getElementById('contentContainer');
    container.innerHTML = `
      <section class="diagnosis-module">
        <h2 class="module-title">🔍 疾病智能诊断</h2>
        
        <div class="symptom-selector">
          <div class="search-container">
            <input type="text" id="symptomSearch" placeholder="🔍 搜索症状 (如头痛、咳嗽)">
            <button id="clearSearch" class="btn-clear">×</button>
          </div>
          <div class="symptom-categories-container">
            ${this.renderSymptomCategories()}
          </div>
        </div>
        
        <div class="selected-symptoms">
          <span>已选症状:</span>
          <div class="selected-symptoms-list"></div>
        </div>
        
        <div class="action-bar">
          <button id="analyzeBtn" class="btn-analyze">🔍 分析症状</button>
          <button id="clearAllBtn" class="btn-clear-all">🗑️ 清除所有</button>
        </div>
        
        <div id="diagnosisResults" class="results-container"></div>
        
        <div class="history-section">
          <h3>📝 诊断历史</h3>
          <div class="history-list">
            ${this.renderDiagnosisHistory()}
          </div>
        </div>
        
        <div class="feedback-section">
          <button class="btn-feedback" onclick="currentModule.showFeedbackForm()">
            ✏️ 提交反馈
          </button>
        </div>
      </section>
    `;

    this.updateSelectedSymptomsDisplay();
    this.setupSearch();
  }

  renderSymptomCategories() {
    if (!this.diseaseData || !this.diseaseData.symptom_categories) return '';

    return Object.entries(this.diseaseData.symptom_categories).map(([category, symptoms]) => {
      return `
        <div class="symptom-category">
          <h3>${category}</h3>
          <div class="symptom-buttons">
            ${symptoms.map(symptom => this.renderSymptomButton(symptom)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderSymptomButton(symptom) {
    const isActive = this.currentSymptoms.has(symptom);
    return `
      <button 
        class="symptom-btn ${isActive ? 'active' : ''}" 
        data-symptom="${symptom}"
      >
        ${symptom}
      </button>
    `;
  }

  setupSearch() {
    const searchInput = document.getElementById('symptomSearch');
    const clearButton = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.symptom-btn').forEach(btn => {
        const symptom = btn.getAttribute('data-symptom');
        btn.style.display = symptom.includes(query) ? 'block' : 'none';
      });
    });

    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      document.querySelectorAll('.symptom-btn').forEach(btn => {
        btn.style.display = 'block';
      });
    });
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('symptom-btn')) {
        this.toggleSymptom(e.target.getAttribute('data-symptom'));
      }
    });

    document.getElementById('analyzeBtn')?.addEventListener('click', () => {
      this.calculateDiagnosis();
    });

    document.getElementById('clearAllBtn')?.addEventListener('click', () => {
      this.clearAllSymptoms();
    });
  }

  toggleSymptom(symptom) {
    if (this.currentSymptoms.has(symptom)) {
      this.currentSymptoms.delete(symptom);
    } else {
      this.currentSymptoms.add(symptom);
    }
    
    this.updateSymptomButtons();
    this.updateSelectedSymptomsDisplay();
  }

  updateSymptomButtons() {
    document.querySelectorAll('.symptom-btn').forEach(btn => {
      const symptom = btn.getAttribute('data-symptom');
      btn.classList.toggle('active', this.currentSymptoms.has(symptom));
    });
  }

  updateSelectedSymptomsDisplay() {
    const selectedList = document.querySelector('.selected-symptoms-list');
    selectedList.innerHTML = '';
    
    if (this.currentSymptoms.size === 0) {
      selectedList.innerHTML = '<span class="placeholder">未选择任何症状</span>';
      return;
    }
    
    this.currentSymptoms.forEach(symptom => {
      const item = createElement('div', 'selected-symptom');
      item.innerHTML = `
        <span>${symptom}</span>
        <button class="remove-btn" onclick="currentModule.removeSymptom('${symptom}')">×</button>
      `;
      selectedList.appendChild(item);
    });
  }
  

  removeSymptom(symptom) {
    this.toggleSymptom(symptom);
  }

  toggleSymptom(symptom) {
    if (this.currentSymptoms.has(symptom)) {
      this.currentSymptoms.delete(symptom);
    } else {
      this.currentSymptoms.add(symptom);
    }
    
    this.updateSymptomButtons();
    this.updateSelectedSymptomsDisplay();
  }

  clearAllSymptoms() {
    this.currentSymptoms.clear();
    this.updateSymptomButtons();
    this.updateSelectedSymptomsDisplay();
    this.clearResults();
  }

  clearResults() {
    document.getElementById('diagnosisResults').innerHTML = '';
  }

  calculateDiagnosis() {
    if (this.currentSymptoms.size === 0) {
      this.showError('请选择至少一个症状进行分析');
      return;
    }

    showLoading('.diagnosis-module');
    
    try {
      const results = this.diseaseData.diseases.map(disease => {
        let score = 0;
        const matchedSymptoms = [];
        const totalWeight = Object.values(disease.symptoms).reduce((sum, s) => sum + s.weight, 0);
        
        this.currentSymptoms.forEach(symptom => {
          if (disease.symptoms[symptom]) {
            score += disease.symptoms[symptom].weight;
            matchedSymptoms.push(symptom);
          }
        });
        
        const confidence = score / totalWeight;
        return {
          ...disease,
          confidence: confidence,
          matchedSymptoms,
          commonSymptoms: Object.entries(disease.symptoms)
            .filter(([_, data]) => data.common)
            .map(([symptom]) => symptom)
        };
      }).filter(result => result.confidence >= 0.2)
         .sort((a, b) => b.confidence - a.confidence);

      this.saveDiagnosisToHistory(results);
      this.displayResults(results);
    } catch (error) {
      console.error('诊断计算错误:', error);
      this.showError('诊断计算失败，请稍后重试');
    } finally {
      document.querySelector('.loading-overlay')?.remove();
    }
  }

  saveDiagnosisToHistory(results) {
    if (results.length === 0) return;
    
    this.diagnosisHistory.push({
      timestamp: new Date().toISOString(),
      symptoms: [...this.currentSymptoms],
      results: results.map(result => ({
        id: result.id,
        name: result.name,
        confidence: result.confidence,
        matchedSymptoms: result.matchedSymptoms
      }))
    });
    
    // 仅保留最近的10条记录
    if (this.diagnosisHistory.length > 10) {
      this.diagnosisHistory = this.diagnosisHistory.slice(-10);
    }
    
    localStorage.setItem('diagnosisHistory', JSON.stringify(this.diagnosisHistory));
  }

  displayResults(results) {
    const container = document.getElementById('diagnosisResults');
    container.innerHTML = '';
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="no-result">
          根据您选择的症状，未找到匹配的疾病。请尝试添加更多症状或调整选择。
        </div>
      `;
      return;
    }

    results.forEach(result => {
      const diagnosisCard = this.createDiagnosisCard(result);
      container.appendChild(diagnosisCard);
    });
  }

  createDiagnosisCard(result) {
    const card = createElement('div', 'diagnosis-card');
    
    // 计算常见症状匹配度
    const commonMatched = result.matchedSymptoms.filter(symptom => 
      result.commonSymptoms.includes(symptom)
    );
    const commonMatchPercentage = Math.round((commonMatched.length / result.commonSymptoms.length) * 100);
    
    card.innerHTML = `
      <div class="confidence-overlay" style="width: ${result.confidence * 100}%"></div>
      <div class="card-content">
        <h3>${result.name}</h3>
        <div class="confidence-indicator">
          <span class="probability">${Math.round(result.confidence * 100)}% 匹配度</span>
          <span class="common-symptoms-match">${commonMatchPercentage}% 常见症状匹配</span>
        </div>
        
        <div class="symptom-details">
          <div class="matched-symptoms">
            <h4>匹配症状</h4>
            <div class="symptom-list">
              ${result.matchedSymptoms.map(symptom => `
                <span class="symptom-item">${symptom}</span>
              `).join('')}
            </div>
          </div>
          
          <div class="related-symptoms">
            <h4>相关症状</h4>
            <div class="symptom-list">
              ${result.related_symptoms.map(symptom => `
                <span class="symptom-item">${symptom}</span>
              `).join('')}
            </div>
          </div>
        </div>
        
        <div class="advice-section">
          <div class="advice-box diagnosis">
            <h4>医生诊断</h4>
            <p>${result.advice.diagnosis}</p>
          </div>
          <div class="advice-box recommendation">
            <h4>治疗建议</h4>
            <p>${result.advice.recommendation}</p>
          </div>
        </div>
        
        <button 
          class="btn-view-details" 
          onclick="currentModule.showDetailedInfo('${result.id}')"
        >
          查看详细信息
        </button>
      </div>
    `;
    
    return card;
  }

  showDetailedInfo(diseaseId) {
    const disease = this.diseaseData.diseases.find(d => d.id === diseaseId);
    if (!disease) return;
    
    const detailModal = createElement('div', 'disease-detail-modal');
    detailModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${disease.name}</h2>
          <button class="close-btn" onclick="currentModule.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <h3>症状详情</h3>
          <div class="symptom-details-grid">
            ${Object.entries(disease.symptoms).map(([symptom, data]) => `
              <div class="symptom-detail-item">
                <div class="symptom-name">${symptom}</div>
                <div class="symptom-weight">
                  权重: ${data.weight.toFixed(2)} 
                  <span class="common-indicator ${data.common ? 'common' : 'not-common'}">
                    ${data.common ? '常见症状' : '少见症状'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
          
          <h3>相关症状</h3>
          <p>${disease.related_symptoms.join('、')}</p>
          
          <h3>诊断建议</h3>
          <p>${disease.advice.diagnosis}</p>
          
          <h3>治疗建议</h3>
          <p>${disease.advice.recommendation}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(detailModal);
  }

  closeModal() {
    document.querySelector('.disease-detail-modal')?.remove();
  }

  renderDiagnosisHistory() {
    if (this.diagnosisHistory.length === 0) {
      return '<div class="no-history">暂无诊断历史</div>';
    }
    
    return this.diagnosisHistory.map(entry => {
      const date = new Date(entry.timestamp).toLocaleString();
      const topResult = entry.results[0];
      
      return `
        <div class="history-item">
          <div class="history-header">
            <span class="history-date">${date}</span>
            <span class="history-symptoms">症状: ${entry.symptoms.join('、')}</span>
          </div>
          <div class="history-result">
            最可能诊断: ${topResult ? topResult.name : '未知'} (${topResult ? Math.round(topResult.confidence * 100) : 0}%)
          </div>
        </div>
      `;
    }).join('');
  }

  showFeedbackForm() {
    const form = createElement('div', 'feedback-form');
    form.innerHTML = `
      <h3>提交诊断反馈</h3>
      <p>帮助我们改进诊断系统:</p>
      <textarea placeholder="请描述诊断不准确的地方及您的建议..." rows="4"></textarea>
      <div class="form-actions">
        <button class="btn-cancel" onclick="this.parentElement.parentElement.remove()">取消</button>
        <button class="btn-submit" onclick="currentModule.submitFeedback()">提交反馈</button>
      </div>
    `;
    document.querySelector('.feedback-section').appendChild(form);
  }

  submitFeedback() {
    const feedbackText = document.querySelector('.feedback-form textarea').value;
    if (!feedbackText.trim()) {
      this.showError('请输入反馈内容');
      return;
    }
    
    this.feedbackHistory.push({
      timestamp: new Date().toISOString(),
      symptoms: [...this.currentSymptoms],
      feedback: feedbackText
    });
    
    localStorage.setItem('diagnosisFeedback', JSON.stringify(this.feedbackHistory));
    document.querySelector('.feedback-form').remove();
    this.showFeedbackSuccess();
  }

  showFeedbackSuccess() {
    const successMsg = createElement('div', 'feedback-success');
    successMsg.innerHTML = `
      <p>感谢您的反馈！您的意见将帮助我们改进诊断系统。</p>
      <button onclick="this.parentElement.remove()">关闭</button>
    `;
    document.querySelector('.feedback-section').appendChild(successMsg);
  }

  showError(message) {
    const container = document.querySelector('.diagnosis-module');
    if (!container) return;

    const errorElem = createElement('div', 'error-message');
    errorElem.innerHTML = message;
    
    container.insertBefore(errorElem, container.firstChild);
    setTimeout(() => errorElem.remove(), 5000);
  }
}

export default new DiseaseModule();