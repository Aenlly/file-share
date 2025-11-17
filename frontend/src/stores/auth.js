
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('authToken') || '',
        user: JSON.parse(localStorage.getItem('currentUser')) || null
    }),
    actions: {
        setToken(token, user) {
            this.token = token
            this.user = user
            localStorage.setItem('authToken', token)
            localStorage.setItem('currentUser', JSON.stringify(user))
        },
        logout() {
            this.token = ''
            this.user = null
            localStorage.removeItem('authToken')
            localStorage.removeItem('currentUser')
        },
        isLoggedIn() {
            return !!this.token
        }
    }
})