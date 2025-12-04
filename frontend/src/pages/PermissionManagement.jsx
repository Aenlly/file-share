import { useState, useEffect } from 'react';
import {
    Card, 
    Table, 
    Button, 
    Modal, 
    Checkbox, 
    Space, 
    Tag, 
    Alert, 
    Select,
    Typography,
    Divider,
    Spin,
    Collapse
} from 'antd';
import { SafetyOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../utils/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const PermissionManagement = () => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [userPermissions, setUserPermissions] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const queryClient = useQueryClient();

    // 获取用户列表
    const { data: users = [], isLoading: usersLoading } = useQuery(
        'users',
        async () => {
            const res = await api.get('/users');
            return res.data;
        }
    );

    // 获取权限定义
    const { data: permissionDefs, isLoading: defsLoading } = useQuery(
        'permissionDefinitions',
        async () => {
            const res = await api.get('/permissions/definitions');
            return res.data;
        }
    );

    // 更新权限
    const updatePermissionsMutation = useMutation(
        async ({ userId, permissions }) => {
            await api.put(`/permissions/user/${userId}`, { permissions });
        },
        {
            onSuccess: () => {
                setSuccess('权限更新成功');
                setDialogOpen(false);
                queryClient.invalidateQueries('users');
                setTimeout(() => setSuccess(''), 3000);
            },
            onError: (err) => {
                setError(err.response?.data?.error || '更新权限失败');
            }
        }
    );

    const handleEditPermissions = async (user) => {
        try {
            const res = await api.get(`/permissions/user/${user.id}`);
            setSelectedUser(user);
            setUserPermissions(res.data.permissions || []);
            setDialogOpen(true);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || '获取用户权限失败');
        }
    };

    const handlePermissionToggle = (permission) => {
        setUserPermissions(prev => {
            if (prev.includes(permission)) {
                return prev.filter(p => p !== permission);
            } else {
                return [...prev, permission];
            }
        });
    };

    const handleApplyRolePreset = async (role) => {
        if (!selectedUser) return;
        
        try {
            const res = await api.get(`/permissions/role-presets/${role}`);
            setUserPermissions(res.data.permissions || []);
            setSuccess(`已加载 ${role} 角色预设，点击"确定"保存`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || '加载角色预设失败');
        }
    };

    const handleSavePermissions = () => {
        if (!selectedUser) return;

        updatePermissionsMutation.mutate({
            userId: selectedUser.id,
            permissions: userPermissions
        });
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
        },
        {
            title: '用户名',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: '角色',
            dataIndex: 'role',
            key: 'role',
            render: (role) => (
                <Tag color={role === 'admin' ? 'red' : 'blue'}>
                    {role}
                </Tag>
            )
        },
        {
            title: '权限数',
            dataIndex: 'permissions',
            key: 'permissionCount',
            render: (permissions) => (
                <Tag>{(permissions || []).length} 个</Tag>
            )
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
                <Button 
                    type="primary"
                    size="small"
                    icon={<SafetyOutlined />}
                    onClick={() => handleEditPermissions(record)}
                >
                    编辑权限
                </Button>
            )
        }
    ];

    if (usersLoading || defsLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" tip="加载中..." />
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={2}>
                    <SafetyOutlined /> 权限管理
                </Title>
                <Text type="secondary">
                    管理用户权限，支持细粒度的权限控制
                </Text>
            </div>

            {error && <Alert message={error} type="error" closable onClose={() => setError('')} style={{ mb: 16 }} />}
            {success && <Alert message={success} type="success" closable onClose={() => setSuccess('')} style={{ mb: 16 }} />}

            <Card>
                <Table 
                    columns={columns} 
                    dataSource={users} 
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={`编辑权限 - ${selectedUser?.username}`}
                open={dialogOpen}
                onOk={handleSavePermissions}
                onCancel={() => {
                    setDialogOpen(false);
                    setSelectedUser(null);
                    setUserPermissions([]);
                }}
                confirmLoading={updatePermissionsMutation.isLoading}
                width={800}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
            >
                {!permissionDefs ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Spin tip="加载权限配置..." />
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>快速应用角色预设：</Text>
                            <div style={{ marginTop: 8 }}>
                                <Space wrap>
                                    {(permissionDefs.rolePresets || []).map(role => (
                                        <Button 
                                            key={role} 
                                            size="small"
                                            onClick={() => handleApplyRolePreset(role)}
                                        >
                                            {role}
                                        </Button>
                                    ))}
                                </Space>
                            </div>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                                点击角色预设将加载对应权限，需点击"确定"按钮才会保存
                            </Text>
                        </div>

                        <Divider />

                        <div style={{ marginBottom: 16 }}>
                            <Text strong>已选择 {userPermissions.length} 个权限</Text>
                        </div>

                        <Collapse defaultActiveKey={Object.keys(permissionDefs.groups || {})}>
                            {Object.entries(permissionDefs.groups || {}).map(([groupKey, group]) => (
                                <Panel header={group.label} key={groupKey}>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        {(group.permissions || []).map(perm => (
                                            <Checkbox
                                                key={perm.key}
                                                checked={userPermissions.includes(perm.key)}
                                                onChange={() => handlePermissionToggle(perm.key)}
                                            >
                                                <Space>
                                                    {perm.label}
                                                    {userPermissions.includes(perm.key) && (
                                                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                                    )}
                                                </Space>
                                            </Checkbox>
                                        ))}
                                    </Space>
                                </Panel>
                            ))}
                        </Collapse>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default PermissionManagement;
