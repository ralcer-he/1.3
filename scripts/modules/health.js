// public/scripts/modules/health.js
import { fetchLocalData, showLoading, createElement } from '../utils.js';

class HealthModule {
  constructor() {
    window.currentModule = this;
    this.formData = { age: '', height: '', weight: '' };
    
    try {
      this.history = JSON.parse(localStorage.getItem('healthHistory') || '[]');
      this.healthPlan = JSON.parse(localStorage.getItem('healthPlan') || '{}');
      this.stressData = JSON.parse(localStorage.getItem('stressData') || '{}');
    } catch (e) {
      this.clearCorruptedData();
    }
    
    this.currentBMI = null;
  }

  clearCorruptedData() {
    localStorage.removeItem('healthHistory');
    localStorage.removeItem('healthPlan');
    localStorage.removeItem('stressData');
    this.history = [];
    this.healthPlan = {};
    this.stressData = {};
  }

  async init() {
    try {
      this.config = await fetchLocalData('/1.3/data/health-config.json');
      this.renderForm();
      this.loadSavedData();
      this.bindEvents();
    } catch (error) {
      this.showError('健康模块初始化失败');
    }
  }

  renderForm() {
    const container = document.getElementById('contentContainer');
    if (!container) return;

    container.innerHTML = `
      <section class="health-module">
        <h2 class="section-title">⚖️ 健康管理中心</h2>
        <form id="bmiForm" class="bmi-form">
          <div class="input-group">
            <label class="form-label">👤 年龄</label>
            <input type="number" id="age" class="form-input" min="10" max="120" required>
          </div>
          <div class="input-group">
            <label class="form-label">📏 身高 (cm)</label>
            <input type="number" id="height" class="form-input" min="100" max="250" required>
          </div>
          <div class="input-group">
            <label class="form-label">⚖️ 体重 (kg)</label>
            <input type="number" id="weight" class="form-input" min="30" max="300" required>
          </div>
          <div class="action-buttons">
            <button type="submit" class="btn btn-primary">📊 立即评估</button>
            <button type="button" id="resetBtn" class="btn btn-secondary">🔄 重置数据</button>
          </div>
        </form>
        <div id="resultSection" class="result-section hidden"></div>
      </section>
    `;
  }

  bindEvents() {
    this.handleSubmit = (e) => this.onSubmit(e);
    this.handleReset = () => this.onReset();
    this.handleInput = () => this.onInput();

    // 绑定核心事件
    document.getElementById('bmiForm')?.addEventListener('submit', this.handleSubmit);
    document.getElementById('resetBtn')?.addEventListener('click', this.handleReset);
    document.querySelectorAll('.form-input').forEach(input => {
      input.addEventListener('input', this.handleInput);
    });

    // 精准的事件委托处理
    document.addEventListener('submit', e => {
      const form = e.target;
      
      // 处理计划生成表单
      if (form.matches('#planForm')) {
        e.preventDefault();
        console.log('计划表单提交');
        this.generateHealthPlan();
      }
      
      // 处理压力评估表单
      if (form.matches('#stressForm')) {
        e.preventDefault();
        console.log('压力评估提交');
        const scores = Array.from(form.querySelectorAll('input[type="radio"]:checked'))
          .map(input => parseInt(input.value));
        this.handleStressSubmit(scores);
      }
    });
  }

  unbindEvents() {
    document.getElementById('bmiForm')?.removeEventListener('submit', this.handleSubmit);
    document.getElementById('resetBtn')?.removeEventListener('click', this.handleReset);
    document.querySelectorAll('.form-input').forEach(input => {
      input.removeEventListener('input', this.handleInput);
    });
  }

  async onSubmit(e) {
    e.preventDefault();
    showLoading('#resultSection .result-content');
    
    try {
      const errors = this.validateInputs();
      if (errors.length) {
        this.showError(errors.join('\n'));
        return;
      }

      const bmi = this.calculateBMI();
      this.currentBMI = bmi;
      this.renderHealthDashboard(bmi);
      this.saveToHistory(bmi);
    } catch (error) {
      this.showError('评估失败，请检查输入');
    }
  }

  onReset() {
    this.formData = { age: '', height: '', weight: '' };
    document.getElementById('bmiForm')?.reset();
    document.getElementById('resultSection')?.classList.add('hidden');
    localStorage.removeItem('healthData');
  }

  onInput() {
    this.formData = {
      age: document.getElementById('age').value,
      height: document.getElementById('height').value,
      weight: document.getElementById('weight').value
    };
    this.saveToStorage();
  }

  validateInputs() {
    const errors = [];
    const { age, height, weight } = this.formData;

    if (isNaN(age) || age < 10 || age > 120) {
      errors.push("请输入有效年龄（10-120岁）");
    }
    if (isNaN(height) || height < 100 || height > 250) {
      errors.push("请输入有效身高（100-250cm）");
    }
    if (isNaN(weight) || weight < 30 || weight > 300) {
      errors.push("请输入有效体重（30-300kg）");
    }

    return errors;
  }

  calculateBMI() {
    const heightM = this.formData.height / 100;
    const bmi = this.formData.weight / (heightM * heightM);
    return Math.min(Math.max(bmi, 16), 40).toFixed(1); // 限制显示范围
  }

  renderHealthDashboard(bmi) {
    const resultSection = document.getElementById('resultSection');
    if (!resultSection) return;
  
    resultSection.classList.remove('hidden');
    resultSection.innerHTML = `
      <div class="health-dashboard">
        ${this.createBMICard(bmi)}
        ${this.createHealthPlanCard()}
        ${this.createStressAssessmentCard()}
      </div>
    `;

    // 重新绑定动态元素的事件
    this.bindPlanTaskEvents();
  }

  bindPlanTaskEvents() {
    document.querySelectorAll('.daily-tasks input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', e => {
        const taskId = e.target.dataset.task;
        this.toggleTask(taskId);
      });
    });
  }

  createBMICard(bmi) {
    if (bmi === null) return '<div class="bmi-result placeholder">请先进行健康评估</div>';

    const { category, advice } = this.getHealthAdvice(bmi);
    return `
      <div class="bmi-result">
        <h3>📝 健康报告</h3>
        <div class="bmi-value ${category}">
          <span>BMI</span>
          <strong>${bmi}</strong>
          <span class="category">${category}</span>
        </div>
        
        <div class="progress-container">
          <div class="progress-bar" style="width: ${this.getProgress(bmi)}%"></div>
        </div>

        <div class="health-advice">
          <h4>📌 健康建议</h4>
          <ul>${advice.map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  createHealthPlanCard() {
    return `
      <div class="health-plan-card">
        <h3>🏃 本周健康计划</h3>
        ${this.healthPlan.dailyTasks?.length ? this.showPlanProgress() : this.renderPlanForm()}
      </div>
    `;
  }

  renderPlanForm() {
    return `
      <form id="planForm" class="plan-form">
        <div class="form-group">
          <label>每日运动目标（分钟）</label>
          <input type="number" min="15" max="180" value="30" id="exerciseGoal">
        </div>
        <button type="submit" class="btn btn-primary">生成计划</button>
      </form>
    `;
  }

  showPlanProgress() {
    const completed = this.healthPlan.dailyTasks.filter(t => t.completed).length;
    const progress = Math.round((completed / this.healthPlan.dailyTasks.length) * 100);
    
    return `
      <div class="plan-progress">
        <div class="progress-bar" style="width: ${progress}%"></div>
        <span>${progress}% 完成</span>
      </div>
      <ul class="daily-tasks">
        ${this.healthPlan.dailyTasks.map(task => `
          <li class="${task.completed ? 'completed' : ''}">
            <label>
              <input type="checkbox" ${task.completed ? 'checked' : ''} data-task="${task.id}">
              ${task.name}
            </label>
          </li>
        `).join('')}
      </ul>
    `;
  }

  createStressAssessmentCard() {
    return `
      <div class="stress-card">
        <h3>🧘 心理压力评估</h3>
        <form id="stressForm">
          ${this.config.pressure_questions.map((q, index) => `
            <div class="question-group">
              <p>${index + 1}. ${q.text}</p>
              <div class="options">
                ${q.options.map(opt => `
                  <label>
                    <input type="radio" name="Q${index}" value="${opt.score}" required>
                    ${opt.text}
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
          <button type="submit" class="btn btn-primary">立即评估</button>
        </form>
        ${this.stressData.score !== undefined ? this.showStressResult() : ''}
      </div>
    `;
  }

  async generateHealthPlan() {
    showLoading('resultSection');
    
    try {
      const planData = await fetchLocalData('/1.3/data/daily-plans.json');
      
      // 兼容中英文键名
      const rawPlans = planData.日常计划 || planData.dailyPlans;
      
      if (!Array.isArray(rawPlans)) {
        throw new Error('数据格式错误: 日常计划必须是数组');
      }

      // 数据结构转换
      const formattedData = rawPlans.reduce((acc, category) => {
        if (category?.type && Array.isArray(category.tasks)) {
          acc[category.type] = category.tasks.map(task => ({
            name: `${task.icon || '⚙️'} ${task.name}`.trim(),
            type: category.type
          }));
        }
        return acc;
      }, {});

      const allTasks = Object.values(formattedData).flat();
      if (allTasks.length === 0) {
        throw new Error('没有可用的任务数据');
      }

      this.healthPlan = {
        dailyTasks: allTasks
          .sort(() => Math.random() - 0.5)
          .slice(0, 5)
          .map((task, index) => ({
            ...task,
            id: `task_${Date.now()}_${index}`,
            completed: false
          })),
        _version: '2.0'
      };

      localStorage.setItem('healthPlan', JSON.stringify(this.healthPlan));
      this.renderHealthDashboard(this.currentBMI);

    } catch (error) {
      console.error('[健康计划错误]', {
        error: error.stack,
        path: window.location.href,
        dataStatus: await this.checkDataStatus()
      });

      // 应急回退
      this.healthPlan = {
        dailyTasks: [{
          id: 'emergency_task',
          name: '⚠️ 数据加载失败，请稍后重试',
          type: '系统',
          completed: false
        }]
      };
      this.showError(`计划生成失败: ${error.message}`);
    }
  }

  async checkDataStatus() {
    try {
      const res = await fetch('/1.3/data/daily-plans.json');
      return {
        status: res.status,
        ok: res.ok,
        size: res.headers.get('content-length')
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  toggleTask(taskId) {
    // 确保 this.healthPlan.dailyTasks 已定义
    if (!this.healthPlan || !Array.isArray(this.healthPlan.dailyTasks)) {
      console.error('健康计划未初始化或格式错误');
      return;
    }

    const taskIndex = this.healthPlan.dailyTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      console.error(`任务 ID ${taskId} 未找到`);
      return;
    }

    this.healthPlan.dailyTasks[taskIndex].completed = 
      !this.healthPlan.dailyTasks[taskIndex].completed;
    
    // 更新进度
    const completedCount = this.healthPlan.dailyTasks.filter(t => t.completed).length;
    this.healthPlan.progress = {
      completed: Math.round((completedCount / this.healthPlan.dailyTasks.length) * 100)
    };
    
    localStorage.setItem('healthPlan', JSON.stringify(this.healthPlan));
    this.renderHealthDashboard(this.currentBMI);
  }

  handleStressSubmit(scores) {
    const total = scores.reduce((a, b) => a + b, 0);
    const result = {
      score: total,
      date: new Date().toISOString(),
      suggestion: this.getStressSuggestion(total)
    };
    
    localStorage.setItem('stressData', JSON.stringify(result));
    this.stressData = result;
    
    // 强制完整重绘仪表盘
    this.renderHealthDashboard(this.currentBMI);
  }

  renderStressAssessment() {
    const stressCard = document.querySelector('.stress-card');
    if (stressCard) {
      stressCard.innerHTML = this.createStressAssessmentCard();
    }
  }

  getStressSuggestion(score) {
    if (score <= 3) return "保持良好状态，建议每日冥想";
    if (score <= 6) return "注意压力管理，推荐瑜伽练习";
    return "建议寻求专业心理咨询";
  }

  showStressResult() {
    return `
      <div class="stress-result">
        <h4>评估结果</h4>
        <p>您的压力评分为：${this.stressData.score}</p>
        <p>建议：${this.stressData.suggestion}</p>
      </div>
    `;
  }

  saveToStorage() {
    localStorage.setItem('healthData', JSON.stringify(this.formData));
  }

  loadSavedData() {
    const savedData = JSON.parse(localStorage.getItem('healthData') || '{}');
    Object.entries(savedData).forEach(([key, value]) => {
      const input = document.getElementById(key);
      if (input) input.value = value;
    });
  }

  saveToHistory(bmi) {
    this.history.push({
      date: new Date().toLocaleString(),
      bmi: parseFloat(bmi),
      data: { ...this.formData }
    });
    localStorage.setItem('healthHistory', JSON.stringify(this.history.slice(-10)));
  }

  getProgress(bmi) {
    return Math.min(Math.max((bmi - 16) / 24 * 100, 0), 100);
  }

  getHealthAdvice(bmi) {
    const ageFactor = this.formData.age < 18 ? 0.95 : 1;
    let category, advice;

    if (bmi < 18.5 * ageFactor) {
      category = 'underweight';
      advice = [
        "建议每日增加300-500大卡热量摄入",
        "优先选择高蛋白食物如鸡蛋、牛奶",
        "每周进行3次力量训练"
      ];
    } else if (bmi < 24 * ageFactor) {
      category = 'healthy';
      advice = [
        "保持均衡饮食结构",
        "每周至少150分钟中等强度运动",
        "定期监测体脂率"
      ];
    } else {
      category = 'overweight';
      advice = [
        "控制每日热量摄入",
        "增加膳食纤维摄入",
        "每周至少300分钟有氧运动"
      ];
    }

    return { category, advice };
  }

  showError(message) {
    const container = document.getElementById('bmiForm');
    if (!container) return;

    const errorElem = createElement('div', 'alert alert-danger', {
      'role': 'alert'
    });
    errorElem.innerHTML = message;
    
    container.parentNode.insertBefore(errorElem, container.nextSibling);
    setTimeout(() => errorElem.remove(), 3000);
  }
}

export default new HealthModule();