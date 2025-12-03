import { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Table, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Space,
  Tag,
  Tabs,
  Popconfirm
} from 'antd'
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  KeyOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuthStore } from '../stores/authStore'
import api from '../utils/api'

const { Option } = Select

const UserManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 获取用户列表
  const { data: users = [], isLoading } = useQuery(
    'users',
    async () => {
      const response = await api.get('/users')
      return response.data
    }
  )

  // 创建用户
  const createUserMutation = useMutation(
    async (userData) => {
      const response = await api.post('/users', userData)
      return response.data
    },
    {
      onSuccess: () => {
        message.success('用户创建成功')
        setIsModalVisible(false)
        form.resetFields()
        queryClient.invalidateQueries('users')
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '创建用户失败')
      }
    }
  )

  // 更新用户
  const updateUserMutation = useMutation(
    async ({ id, ...userData }) => {
      const response = await api.put(`/users/${id}`, userData)
      return response.data
    },
    {
      onSuccess: () => {
        message.success('用户更新成功')
        setIsModalVisible(false)
        setEditingUser(null)
        form.resetFields()
        queryClient.invalidateQueries('users')
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '更新用户失败')
      }
    }
  )

  // 修改密码
  const changePasswordMutation = useMutation(
    async ({ id, password }) => {
      const response = await api.post(`/users/${id}/change-password`, { newPassword: password })
      return response.data
    },
    {
      onSuccess: () => {
        message.success('密码修改成功')
        setIsPasswordModalVisible(false)
        setEditingUser(null)
        passwordForm.resetFields()
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '密码修改失败')
      }
    }
  )

  // 删除用户
  const deleteUserMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/users/${id}`)
      return response.data
    },
    {
      onSuccess: (data) => {
        message.success(data.message || '用户删除成功')
        queryClient.invalidateQueries('users')
      },
      onError: (error) => {
        message.error(error.response?.data?.error || '删除用户失败')
      }
    }
  )

  const handleCreateUser = () => {
    form.validateFields().then(values => {
      if (editingUser) {
        updateUserMutation.mutate({ id: editingUser.id, ...values })
      } else {
        createUserMutation.mutate(values)
      }
    })
  }

  const handleOpenModal = (user = null) => {
    setEditingUser(user)
    if (user) {
      form.setFieldsValue({
        username: user.username,
        role: user.role
      })
    } else {
      form.resetFields()
    }
    setIsModalVisible(true)
  }

  const handleChangePassword = (user) => {
    setEditingUser(user)
    passwordForm.resetFields()
    setIsPasswordModalVisible(true)
  }

  const handleChangePasswordSubmit = () => {
    passwordForm.validateFields().then(values => {
      changePasswordMutation.mutate({ id: editingUser.id, password: values.password })
    })
  }

  const handleDeleteUser = (user) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户 "${user.username}" 吗？此操作将同时删除该用户的所有文件夹和分享链接，且不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        deleteUserMutation.mutate(user.id)
      }
    })
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: isMobile ? 50 : 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: isMobile ? 80 : 100,
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      )
    },
    ...(!isMobile ? [{
      title: '权限',
      dataIndex: 'menuPermissions',
      key: 'menuPermissions',
      render: (permissions) => (
        <>
          {permissions.map(permission => (
            <Tag key={permission} style={{ marginBottom: 4 }}>
              {permission}
            </Tag>
          ))}
        </>
      )
    }] : []),
    {
      title: '操作',
      key: 'actions',
      fixed: isMobile ? 'right' : false,
      width: isMobile ? 120 : 300,
      render: (_, record) => (
        <Space direction={isMobile ? 'vertical' : 'horizontal'} size="small">
          <Button 
            type="primary" 
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleOpenModal(record)}
            block={isMobile}
          >
            {isMobile ? '编辑' : '编辑'}
          </Button>
          <Button 
            icon={<KeyOutlined />}
            size="small"
            onClick={() => handleChangePassword(record)}
            block={isMobile}
          >
            {isMobile ? '密码' : '修改密码'}
          </Button>
          {record.id !== currentUser?.id && (
            <Popconfirm
              title="确认删除"
              description={`确定要删除用户 "${record.username}" 吗？此操作将同时删除该用户的所有文件夹和分享链接，且不可恢复。`}
              onConfirm={() => deleteUserMutation.mutate(record.id)}
              okText="确定"
              cancelText="取消"
              okType="danger"
            >
              <Button 
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={deleteUserMutation.isLoading}
                block={isMobile}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 16 : 0
      }}>
        <h2 style={{ margin: 0 }}>用户管理</h2>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => handleOpenModal()}
          block={isMobile}
        >
          新建用户
        </Button>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={users} 
          rowKey="id"
          loading={isLoading}
          pagination={{ 
            pageSize: isMobile ? 5 : 10,
            simple: isMobile
          }}
          scroll={{ x: isMobile ? 600 : undefined }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={isModalVisible}
        onOk={handleCreateUser}
        onCancel={() => {
          setIsModalVisible(false)
          setEditingUser(null)
          form.resetFields()
        }}
        confirmLoading={createUserMutation.isLoading || updateUserMutation.isLoading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: !editingUser, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="admin">管理员</Option>
              <Option value="user">普通用户</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改密码"
        open={isPasswordModalVisible}
        onOk={handleChangePasswordSubmit}
        onCancel={() => {
          setIsPasswordModalVisible(false)
          setEditingUser(null)
          passwordForm.resetFields()
        }}
        confirmLoading={changePasswordMutation.isLoading}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            label="用户名"
          >
            <Input value={editingUser?.username} disabled />
          </Form.Item>
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
        </Form>
      </Modal>
    </div>
  )
}

export default UserManagement