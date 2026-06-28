/**
 * 依赖注入容器 - PitchSignal
 * 
 * 提供：
 * - 单例管理
 * - 依赖解析
 * - 生命周期管理
 * 
 * 注意：这个模块与app.js一起使用，app.js提供实际的依赖项创建
 */

const { createLogger } = require('./logger');
const logger = createLogger('container');

class Container {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Map();
  }
  
  /**
   * 注册服务工厂
   * @param {string} name - 服务名称
   * @param {Function} factory - 工厂函数
   * @param {boolean} [singleton=true] - 是否单例
   */
  register(name, factory, singleton = true) {
    if (singleton) {
      this.factories.set(name, factory);
    } else {
      this.services.set(name, factory);
    }
  }
  
  /**
   * 注册单例实例
   * @param {string} name - 服务名称
   * @param {*} instance - 服务实例
   */
  registerInstance(name, instance) {
    this.singletons.set(name, instance);
  }
  
  /**
   * 解析服务
   * @param {string} name - 服务名称
   * @returns {*} 服务实例
   */
  resolve(name) {
    // 检查单例缓存
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }
    
    // 检查工厂
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      const instance = factory(this);
      this.singletons.set(name, instance);
      return instance;
    }
    
    // 检查非单例服务
    if (this.services.has(name)) {
      const factory = this.services.get(name);
      return factory(this);
    }
    
    throw new Error(`Service not found: ${name}`);
  }
  
  /**
   * 批量注册服务
   * @param {Object} definitions - 服务定义对象
   */
  registerAll(definitions) {
    for (const [name, definition] of Object.entries(definitions)) {
      if (typeof definition === 'function') {
        this.register(name, definition);
      } else {
        this.registerInstance(name, definition);
      }
    }
  }
  
  /**
   * 获取所有已注册的服务名称
   * @returns {string[]} 服务名称列表
   */
  getServiceNames() {
    return [
      ...this.singletons.keys(),
      ...this.factories.keys(),
      ...this.services.keys(),
    ];
  }
  
  /**
   * 检查服务是否已注册
   * @param {string} name - 服务名称
   * @returns {boolean} 是否已注册
   */
  has(name) {
    return this.singletons.has(name) || 
           this.factories.has(name) || 
           this.services.has(name);
  }
  
  /**
   * 清除所有单例缓存（用于测试）
   */
  clearCache() {
    this.singletons.clear();
  }
}

/**
 * 创建应用容器（使用app.js的配置）
 * @returns {Object} 容器实例和应用配置
 */
function createAppContainer() {
  const container = new Container();
  const { createAppConfig } = require('./app');
  
  // 使用app.js创建配置
  const appConfig = createAppConfig();
  
  // 将app.js的配置注册到容器中
  container.registerInstance('appConfig', appConfig);
  container.registerInstance('infra', appConfig.infra);
  container.registerInstance('teamData', appConfig.teamData);
  container.registerInstance('matchupModules', appConfig.matchupModules);
  container.registerInstance('services', appConfig.services);
  container.registerInstance('routes', appConfig.routes);
  container.registerInstance('PLAYER_RATINGS', appConfig.PLAYER_RATINGS);
  container.registerInstance('idBridge', appConfig.idBridge);
  
  // 注册便捷访问器
  container.register('loader', () => appConfig.infra.loader);
  container.register('teamResolver', () => appConfig.infra.teamResolver);
  container.register('rosterCache', () => appConfig.infra.rosterCache);
  container.register('botKB', () => appConfig.infra.botKB);
  container.register('getCached', () => appConfig.infra.getCached);
  container.register('setCache', () => appConfig.infra.setCache);
  container.register('fetchJSON', () => appConfig.infra.fetchJSON);
  container.register('espn', () => appConfig.infra.espn);
  container.register('wrapCORS', () => appConfig.infra.wrapCORS);
  container.register('parseBody', () => appConfig.infra.parseBody);
  container.register('rateLimit', () => appConfig.infra.rateLimit);
  
  return { container, appConfig };
}

module.exports = {
  Container,
  createAppContainer,
};