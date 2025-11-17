import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router' // 导入路由
import './index.css' // ✅ 必须这一行！

const app = createApp(App)
app.use(createPinia())
app.use(router) // 注册路由
app.mount('#app')