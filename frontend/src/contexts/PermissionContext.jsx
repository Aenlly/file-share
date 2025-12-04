import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const PermissionContext = createContext();

export const usePermissions = () => {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error('usePermissions must be used within PermissionProvider');
    }
    return context;
};

export const PermissionProvider = ({ children }) => {
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const userStr = localStorage.getItem('user');
            if (!userStr) {
                setLoading(false);
                return;
            }

            const user = JSON.parse(userStr);
            const res = await api.get(`/permissions/user/${user.id}`);
            setPermissions(res.data.permissions || []);
        } catch (error) {
            console.error('加载权限失败:', error);
            setPermissions([]);
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (permission) => {
        return permissions.includes(permission);
    };

    const hasAnyPermission = (permissionList) => {
        return permissionList.some(p => permissions.includes(p));
    };

    const hasAllPermissions = (permissionList) => {
        return permissionList.every(p => permissions.includes(p));
    };

    const refreshPermissions = () => {
        return loadPermissions();
    };

    return (
        <PermissionContext.Provider value={{
            permissions,
            loading,
            hasPermission,
            hasAnyPermission,
            hasAllPermissions,
            refreshPermissions
        }}>
            {children}
        </PermissionContext.Provider>
    );
};
