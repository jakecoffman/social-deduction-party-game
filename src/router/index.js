import Vue from 'vue'
import Router from 'vue-router'
import ResistanceGame from '@/components/ResistanceGame'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'main',
      component: ResistanceGame
    },
    {
      path: '/:id',
      name: 'game',
      component: ResistanceGame
    }
  ]
})
