import { createRouter, createWebHistory } from 'vue-router'
import ProductSelection from '../components/ProductSelection.vue'
import PaymentPage from '../components/PaymentPage.vue'
import QrPaymentPage from '../components/QrPaymentPage.vue'
import PaymentSuccess from '../components/PaymentSuccess.vue'

const routes = [
  {
    path: '/',
    name: 'ProductSelection',
    component: ProductSelection
  },
  {
    path: '/payment',
    name: 'PaymentPage',
    component: PaymentPage
  },
  {
    path: '/qrcode',
    name: 'QrPaymentPage',
    component: QrPaymentPage
  },
  {
    path: '/success',
    name: 'PaymentSuccess',
    component: PaymentSuccess
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router