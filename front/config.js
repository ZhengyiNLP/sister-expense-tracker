// 服务器配置文件
// 请根据您的天翼云服务器实际地址修改以下配置
const SERVER_CONFIG = {
  // 生产环境服务器地址
  production: {
    domain: '220.165.80.27', // 你的服务器IP地址
    protocol: 'http', // 使用HTTP协议
    port: ':5000' // 你的前端访问端口（Nginx监听端口）
  },
  
  // 开发环境服务器地址（本地测试）
  development: {
    domain: 'localhost',
    protocol: 'http',
    port: ':5000' // 本地后端服务端口
  }
};

// 根据当前环境自动选择API URL
function getApiBaseUrl() {
  // 检查是否通过file://协议打开（本地文件）
  const isFileProtocol = window.location.protocol === 'file:';
  // 检查是否是本地主机
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.hostname === '';
  
  // 如果是file://协议或者本地主机，使用开发环境配置
  const isDevelopment = isFileProtocol || isLocalhost;
  
  console.log('Environment detection:', {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    isFileProtocol,
    isLocalhost,
    isDevelopment
  });
  
  // 在生产环境中，使用相对路径，让Nginx反向代理处理
  if (!isDevelopment) {
    console.log('Production environment: using relative path /api');
    return '/api';
  }
  
  // 开发环境：直接连接到后端服务
  const config = SERVER_CONFIG.development;
  const apiUrl = `${config.protocol}://${config.domain}${config.port}/api`;
  console.log('Development environment: using direct connection', apiUrl);
  return apiUrl;
}

// 导出配置
window.SERVER_CONFIG = SERVER_CONFIG;
window.API_BASE_URL = getApiBaseUrl();