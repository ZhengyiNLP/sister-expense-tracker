// 邮件服务配置
// 在生产环境中，这些值应该通过环境变量设置，而不是硬编码

// 加载环境变量
require('dotenv').config();

const emailConfig = {
  // SMTP服务器配置 - 以QQ邮箱为例
  host: 'smtp.qq.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  
  // 发件邮箱信息
  auth: {
    user: process.env.EMAIL_USER || 'your-email@qq.com', // 发件邮箱
    pass: process.env.EMAIL_PASS || 'your-authorization-code' // 邮箱授权码，不是密码
  }
};

// 网站域名配置 - 用于生成重置密码链接
const siteConfig = {
  domain: process.env.SITE_DOMAIN || 'http://localhost:5000', // 默认使用本地地址，生产环境中应替换为实际域名
  resetPasswordPath: '/reset-password.html' // 重置密码页面路径
};

module.exports = {
  emailConfig,
  siteConfig
};