const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { emailConfig, siteConfig } = require('./email-config');
const path = require('path');

// 加载环境变量
require('dotenv').config();

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../front')));

// 使用内存数据库模拟SQLite
let users = [];
let records = [];
let resetTokens = []; // 存储重置令牌
let nextUserId = 1;
let nextRecordId = 1;
let nextTokenId = 1;

// 初始化一些测试用户
const initTestData = async () => {
  // 检查是否已有用户
  if (users.length === 0) {
    // 创建测试用户
    const testUserPassword = await bcrypt.hash('123456', 10);
    users.push({
      id: nextUserId++,
      username: 'testuser',
      email: 'test@example.com',
      password: testUserPassword,
      created_at: new Date().toISOString()
    });
    
    // 添加一些测试记录
    records.push(
      {
        id: nextRecordId++,
        user_id: 1,
        type: 'income',
        amount: 5000,
        category: '工资',
        date: '2023-11-01',
        note: '11月工资',
        created_at: new Date().toISOString()
      },
      {
        id: nextRecordId++,
        user_id: 1,
        type: 'expense',
        amount: 1200,
        category: '餐饮',
        date: '2023-11-05',
        note: '聚餐',
        created_at: new Date().toISOString()
      }
    );
    
    console.log('Test data initialized');
  }
};

// 创建邮件传输器
const createMailTransporter = () => {
  return nodemailer.createTransporter(emailConfig);
};

// 生成重置令牌
const generateResetToken = (userId) => {
  const token = jwt.sign(
    { userId, type: 'password-reset' },
    JWT_SECRET,
    { expiresIn: '1h' } // 令牌1小时后过期
  );
  
  // 存储令牌到内存数据库
  resetTokens.push({
    id: nextTokenId++,
    userId,
    token,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1小时后过期
  });
  
  return token;
};

// 验证重置令牌
const verifyResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 检查令牌类型
    if (decoded.type !== 'password-reset') {
      return null;
    }
    
    // 检查令牌是否存在于数据库中
    const tokenRecord = resetTokens.find(t => t.token === token);
    
    // 检查令牌是否过期
    if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

// 清理过期的令牌
const cleanExpiredTokens = () => {
  const now = new Date();
  resetTokens = resetTokens.filter(token => new Date(token.expires_at) > now);
};

// 发送重置密码邮件
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const transporter = createMailTransporter();
    
    const resetUrl = `${siteConfig.domain}${siteConfig.resetPasswordPath}?token=${resetToken}`;
    
    const mailOptions = {
      from: emailConfig.auth.user,
      to: user.email,
      subject: '密码重置请求 - 记账系统',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d6efd;">记账系统 - 密码重置</h2>
          <p>您好，${user.username}！</p>
          <p>我们收到了您的密码重置请求。请点击下面的链接重置您的密码：</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #0d6efd; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">重置密码</a>
          <p>或者复制以下链接到浏览器地址栏：</p>
          <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">${resetUrl}</p>
          <p>此链接将在1小时后失效。如果您没有请求密码重置，请忽略此邮件。</p>
          <p>谢谢！</p>
          <p>记账系统团队</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`密码重置邮件已发送至: ${user.email}`);
    return true;
  } catch (error) {
    console.error('发送邮件失败:', error);
    return false;
  }
};

// 中间件：验证JWT令牌
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    req.user = user;
    next();
  });
};

// API路由

// 用户注册
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: '用户名、邮箱和密码都是必填项' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少为6个字符' });
  }

  try {
    // 检查用户名是否已存在
    const existingUsername = users.find(u => u.username === username);
    if (existingUsername) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查邮箱是否已存在
    const existingEmail = users.find(u => u.email === email);
    if (existingEmail) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建新用户
    const newUser = {
      id: nextUserId++,
      username,
      email,
      password: hashedPassword,
      created_at: new Date().toISOString()
    };
    
    users.push(newUser);
    
    res.status(201).json({ 
      message: '注册成功',
      userId: newUser.id
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码都是必填项' });
  }

  try {
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 找回密码
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: '邮箱是必填项' });
  }

  try {
    // 查找用户
    const user = users.find(u => u.email === email);

    // 无论用户是否存在都返回成功消息，防止邮箱枚举攻击
    if (!user) {
      return res.json({ 
        message: '如果该邮箱已注册，密码重置链接已发送到您的邮箱' 
      });
    }

    // 生成重置令牌
    const resetToken = generateResetToken(user.id);
    
    // 发送重置密码邮件
    const emailSent = await sendPasswordResetEmail(user, resetToken);
    
    if (emailSent) {
      res.json({ 
        message: '密码重置链接已发送到您的邮箱，请查收' 
      });
    } else {
      res.status(500).json({ 
        error: '发送邮件失败，请稍后再试' 
      });
    }
  } catch (error) {
    console.error('找回密码错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 重置密码
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: '重置令牌和新密码都是必填项' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '密码长度至少为6个字符' });
  }

  try {
    // 清理过期令牌
    cleanExpiredTokens();
    
    // 验证重置令牌
    const decoded = verifyResetToken(token);
    
    if (!decoded) {
      return res.status(400).json({ error: '无效或已过期的重置令牌' });
    }
    
    // 查找用户
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新用户密码
    user.password = hashedPassword;
    
    // 删除已使用的令牌
    resetTokens = resetTokens.filter(t => t.token !== token);
    
    console.log(`用户 ${user.username} 的密码已重置`);
    
    res.json({ 
      message: '密码重置成功' 
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户信息
app.get('/api/user', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);
    if (user) {
      // 移除密码字段
      const userWithoutPassword = { ...user };
      delete userWithoutPassword.password;
      res.json(userWithoutPassword);
    } else {
      return res.status(404).json({ error: '用户不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户的所有记录
app.get('/api/records', authenticateToken, (req, res) => {
  try {
    const userRecords = records.filter(r => r.user_id === req.user.id);
    // 按日期降序排序，然后按创建时间降序排序
    userRecords.sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    res.json(userRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加新记录
app.post('/api/records', authenticateToken, (req, res) => {
  const { type, amount, category, date, note } = req.body;
  const userId = req.user.id;

  if (!type || !amount || !category || !date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  try {
    const newRecord = {
      id: nextRecordId++,
      user_id: userId,
      type,
      amount: parseFloat(amount),
      category,
      date,
      note: note || '',
      created_at: new Date().toISOString()
    };
    
    records.push(newRecord);
    res.json({ id: newRecord.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除记录
app.delete('/api/records/:id', authenticateToken, (req, res) => {
  const recordId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const recordIndex = records.findIndex(r => r.id === recordId && r.user_id === userId);
    
    if (recordIndex === -1) {
      return res.status(404).json({ error: '记录不存在或无权删除' });
    }

    records.splice(recordIndex, 1);
    res.json({ message: '记录删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 清空当前用户的所有记录
app.delete('/api/records', authenticateToken, (req, res) => {
  const userId = req.user.id;

  try {
    const initialCount = records.length;
    records = records.filter(r => r.user_id !== userId);
    const deletedCount = initialCount - records.length;
    res.json({ message: `成功删除 ${deletedCount} 条记录` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`带用户认证的服务器运行在端口 ${PORT}`);
  console.log('使用内存数据库进行测试');
  await initTestData();
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在优雅关闭服务器...');
  process.exit(0);
});