import { useState } from 'react'
import { Card, Form, Input, Button, message, Avatar, Space, Typography } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useMutation } from 'react-query'
import { useAuthStore } from '../stores/authStore'
import api from '../utils/api'

const { Title, Text } = Typography

const Profile = () => {
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  
  const changePasswordMutation = useMutation(
    async ({ password }) => {
      const response = await api.put(`/users/${user.id}/password`, { password })
      return response.data
    },
    {
      onSuccess: () => {
        message.success('密码修改成功')
        form.resetFields()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '密码修改失败')
      }
    }
  )

  const handleChangePassword = (values) => {
    changePasswordMutation.mutate({ password: values.password })
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Avatar size={64} icon={<UserOutlined />} />
            <Title level={3}>{user?.username}</Title>
            <Text type="secondary">
              {user?.role === 'admin' ? '管理员' : '普通用户'}
            </Text>
          </div>
          
          <Card title="修改密码" size="small">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleChangePassword}
            >
              <Form.Item
                name="password"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码长度至少6位' }
                ]}
              >
                <Input.Password placeholder="请输入新密码" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'))
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="请再次输入新密码" />
              </Form.Item>
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={changePasswordMutation.isLoading}
                  block
                >
                  修改密码
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Space>
      </Card>
    </div>
  )
}

export default Profile