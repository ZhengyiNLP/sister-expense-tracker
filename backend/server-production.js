const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { emailConfig, siteConfig } = require('./email-config');

// 加载环境变量
require('dotenv').config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// 数据存储配置
const DATA_DIR = path.join(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'resetTokens.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 使用文件系统存储数据（生产环境）
let records = [];
let users = [];
let resetTokens = [];
let nextId = 1;
let nextUserId = 1;
let nextTokenId = 1;

// 从文件加载数据
function loadRecords() {
  try {
    if (fs.existsSync(RECORDS_FILE)) {
      const data = fs.readFileSync(RECORDS_FILE, 'utf8');
      records = JSON.parse(data);
      nextId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
      console.log(`从文件加载了 ${records.length} 条记录`);
    } else {
      // 如果文件不存在，初始化一些示例数据
      records = [
        {
          id: nextId++,
          type: 'expense',
          amount: 50,
          category: '餐饮',
          date: new Date().toISOString().split('T')[0],
          note: '午餐',
          created_at: new Date().toISOString()
        },
        {
          id: nextId++,
          type: 'income',
          amount: 3000,
          category: '工资',
          date: new Date().toISOString().split('T')[0],
          note: '本月工资',
          created_at: new Date().toISOString()
        }
      ];
      saveRecords();
      console.log('初始化示例数据');
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    records = [];
    nextId = 1;
  }
}

// 保存数据到文件
function saveRecords() {
  try {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
    console.log(`保存了 ${records.length} 条记录到文件`);
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

// 加载用户数据
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(data);
      nextUserId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
      console.log(`从文件加载了 ${users.length} 个用户`);
    } else {
      users = [];
      saveUsers();
      console.log('初始化用户数据');
    }
  } catch (error) {
    console.error('加载用户数据失败:', error);
    users = [];
    nextUserId = 1;
  }
}

// 保存用户数据
function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log(`保存了 ${users.length} 个用户到文件`);
  } catch (error) {
    console.error('保存用户数据失败:', error);
  }
}

// 加载重置令牌
function loadResetTokens() {
  try {
    if (fs.existsSync(RESET_TOKENS_FILE)) {
      const data = fs.readFileSync(RESET_TOKENS_FILE, 'utf8');
      resetTokens = JSON.parse(data);
      nextTokenId = resetTokens.length > 0 ? Math.max(...resetTokens.map(t => t.id)) + 1 : 1;
      console.log(`从文件加载了 ${resetTokens.length} 个重置令牌`);
    } else {
      resetTokens = [];
      saveResetTokens();
      console.log('初始化重置令牌数据');
    }
  } catch (error) {
    console.error('加载重置令牌失败:', error);
    resetTokens = [];
    nextTokenId = 1;
  }
}

// 保存重置令牌
function saveResetTokens() {
  try {
    fs.writeFileSync(RESET_TOKENS_FILE, JSON.stringify(resetTokens, null, 2));
    console.log(`保存了 ${resetTokens.length} 个重置令牌到文件`);
  } catch (error) {
    console.error('保存重置令牌失败:', error);
  }
}

// 初始化数据
loadRecords();
loadUsers();
loadResetTokens();

// 邮件发送功能
async function sendPasswordResetEmail(email, resetToken) {
  try {
    // 创建邮件传输器
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass
      }
    });

    // 生成重置密码链接
    const resetLink = `${siteConfig.domain}/reset-password.html?token=${resetToken}`;
    
    // 邮件内容
    const mailOptions = {
      from: `"姐妹记账系统" <${emailConfig.auth.user}>`,
      to: email,
      subject: "密码重置 - 姐妹记账系统",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">密码重置</h2>
          <p>您好，</p>
          <p>您请求重置您的账户密码。请点击下面的链接重置您的密码：</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">重置密码</a>
          </div>
          <p>如果您无法点击上面的链接，请复制以下链接到浏览器地址栏：</p>
          <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${resetLink}</p>
          <p>此链接将在24小时后过期。</p>
          <p>如果您没有请求重置密码，请忽略此邮件。</p>
          <p>谢谢！</p>
        </div>
      `
    };

    // 发送邮件
    const info = await transporter.sendMail(mailOptions);
    console.log('密码重置邮件已发送:', info.messageId);
    return { success: true, message: '密码重置邮件已发送' };
  } catch (error) {
    console.error('发送密码重置邮件失败:', error);
    return { success: false, message: '发送邮件失败: ' + error.message };
  }
}

// 生成JWT令牌
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// 验证JWT令牌
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// API路由

// 获取所有记录
app.get('/api/records', (req, res) => {
  try {
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加新记录
app.post('/api/records', (req, res) => {
  const { type, amount, category, date, note } = req.body;
  
  if (!type || !amount || !category || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const newRecord = {
      id: nextId++,
      type,
      amount: parseFloat(amount),
      category,
      date,
      note: note || '',
      created_at: new Date().toISOString()
    };
    
    records.push(newRecord);
    saveRecords(); // 保存到文件
    res.json({ id: newRecord.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除记录
app.delete('/api/records/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    const index = records.findIndex(record => record.id === id);
    
    if (index === -1) {
      res.status(404).json({ error: 'Record not found' });
    } else {
      records.splice(index, 1);
      saveRecords(); // 保存到文件
      res.json({ message: 'Record deleted successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 用户认证相关API
// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 查找用户
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ success: false, message: '邮箱或密码错误' });
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: '邮箱或密码错误' });
    }
    
    // 生成JWT令牌
    const token = generateToken(user.id);
    
    // 更新最后登录时间
    user.last_login = new Date().toISOString();
    saveUsers();
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // 检查邮箱是否已存在
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: '该邮箱已被注册' });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建新用户
    const newUser = {
      id: nextUserId++,
      email,
      password: hashedPassword,
      name,
      created_at: new Date().toISOString(),
      last_login: null
    };
    
    users.push(newUser);
    saveUsers();
    
    // 生成JWT令牌
    const token = generateToken(newUser.id);
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 请求密码重置
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // 查找用户
    const user = users.find(u => u.email === email);
    if (!user) {
      // 为了安全，即使用户不存在也返回成功消息
      return res.json({ success: true, message: '如果该邮箱已注册，您将收到密码重置邮件' });
    }
    
    // 生成重置令牌
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    
    // 保存重置令牌
    const newToken = {
      id: nextTokenId++,
      userId: user.id,
      token: resetToken,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
    };
    
    resetTokens.push(newToken);
    saveResetTokens();
    
    // 发送重置邮件
    const emailResult = await sendPasswordResetEmail(email, resetToken);
    
    if (emailResult.success) {
      res.json({ success: true, message: '密码重置邮件已发送' });
    } else {
      res.status(500).json({ success: false, message: emailResult.message });
    }
  } catch (error) {
    console.error('密码重置请求错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 重置密码
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // 查找有效的重置令牌
    const resetToken = resetTokens.find(t => 
      t.token === token && 
      new Date(t.expires_at) > new Date()
    );
    
    if (!resetToken) {
      return res.status(400).json({ success: false, message: '无效或已过期的重置令牌' });
    }
    
    // 查找用户
    const user = users.find(u => u.id === resetToken.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: '用户不存在' });
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新用户密码
    user.password = hashedPassword;
    saveUsers();
    
    // 删除已使用的重置令牌
    resetTokens = resetTokens.filter(t => t.id !== resetToken.id);
    saveResetTokens();
    
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('密码重置错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路径重定向到登录页面
app.get('/', (req, res) => {
  res.redirect('/front/login.html');
});

// 启动服务器
if (process.env.HTTPS === 'true') {
  // HTTPS配置
  const options = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/ssl/private/server.key'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/ssl/certs/server.crt')
  };
  
  https.createServer(options, app).listen(PORT, () => {
    console.log(`HTTPS服务器运行在端口 ${PORT}`);
  });
} else {
  // HTTP服务器
  app.listen(PORT, () => {
    console.log(`HTTP服务器运行在端口 ${PORT}`);
  });
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在优雅关闭服务器...');
  saveRecords(); // 确保数据已保存
  console.log('服务器已关闭');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n收到SIGTERM信号，正在关闭服务器...');
  saveRecords(); // 确保数据已保存
  console.log('服务器已关闭');
  process.exit(0);
});