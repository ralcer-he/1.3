// public/scripts/app.js
import { showLoading, createElement, fetchLocalData } from './utils.js';

let currentModule = null;

// 更新模块路径
const moduleMap = {
  recipe: './scripts/modules/recipe.js',
  health: './scripts/modules/health.js',
  disease: './scripts/modules/disease.js'
};

// 改进模块初始化方式
async function loadModule(moduleName) {
  try {
    // 清理旧模块
    if (currentModule?.cleanup) {
      await currentModule.cleanup();
    }

    // 显示加载状态
    showLoading('#contentContainer');

    // 动态加载模块
    const { default: module } = await import(moduleMap[moduleName]);
    currentModule = module;
    
    // 初始化模块（传递必要参数）
    await currentModule.init({
      container: '#contentContainer',
      createElement,    // 直接传递需要的工具函数
      fetchLocalData
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] 模块加载失败:`, error);
    showModuleError(moduleName, error);
  }
}

function showModuleError(moduleName, error) {
  const container = document.getElementById('contentContainer');
  if (!container) return;

  const errorElem = createElement('div', 'module-error', {
    'data-error-type': 'module-load'
  });
  
  errorElem.innerHTML = `
    <h3 class="text-danger">⚠️ ${moduleName} 加载失败</h3>
    <p class="error-message">${error.message}</p>
    <div class="error-details">
      <p>可能原因：</p>
      <ul>
        <li>网络连接异常</li>
        <li>模块文件缺失</li>
        <li>数据格式错误</li>
      </ul>
    </div>
    <button class="btn btn-retry" onclick="retryLoad('${moduleName}')">重试加载</button>
  `;

  container.innerHTML = '';
  container.appendChild(errorElem);
}

// 全局方法（需要在index.html的script标签中暴露）
window.retryLoad = (moduleName) => {
  loadModule(moduleName);
};

// 初始化事件监听
function initEventListeners() {
  const moduleButtons = [
    { id: 'recipeBtn', name: 'recipe' },
    { id: 'healthBtn', name: 'health' },
    { id: 'diseaseBtn', name: 'disease' }
  ];

  moduleButtons.forEach(({ id, name }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        // 更新按钮状态
        document.querySelectorAll('.nav-button').forEach(b => {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        
        // 加载模块
        loadModule(name);
      });
    }
  });
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  console.log('应用初始化...');
  initEventListeners();
  
  // 加载默认模块
  loadModule('health');
});
