import { useState, useEffect } from 'react'
import { Form, Input, Button, Card, message, Spin } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const Login = () => {
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const onFinish = async (values) => {
    setLoading(true)
    const result = await login(values.username, values.password)
    
    if (result.success) {
      message.success('登录成功')
      navigate('/dashboard')
    } else {
      message.error(result.message)
    }
    
    setLoading(false)
  }

  return (
    <div className="login-container">
      <Card 
        className="login-form"
        style={{ 
          width: isMobile ? '90%' : 400,
          margin: isMobile ? '20px auto' : 'auto'
        }}
      >
        <div className="login-title">文件分享系统</div>
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size={isMobile ? 'middle' : 'large'}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="用户名" 
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              style={{ width: '100%' }}
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Login