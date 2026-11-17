import type {RouteRecordRaw} from 'vue-router'
import StoriesPage from '../../views/stories/index.vue'
import EpisodesPage from '../../views/episodes/index.vue'
import AssetsPage from '../../views/assets/index.vue'
import StoryboardsPage from '../../views/storyboards/index.vue'
import TasksPage from '../../views/tasks/index.vue'
import ReviewsPage from '../../views/reviews/index.vue'
import EditorPage from '../../views/editor/index.vue'
import ExportsPage from '../../views/exports/index.vue'
export const productionRoutes:RouteRecordRaw[]=[
{path:'/projects/:projectId/stories',name:'stories',component:StoriesPage},
{path:'/projects/:projectId/episodes',name:'episodes',component:EpisodesPage},
{path:'/projects/:projectId/assets',name:'assets',component:AssetsPage},
{path:'/projects/:projectId/storyboards',name:'storyboards',component:StoryboardsPage},
{path:'/projects/:projectId/tasks',name:'tasks',component:TasksPage},
{path:'/projects/:projectId/reviews',name:'reviews',component:ReviewsPage},
{path:'/projects/:projectId/editor',name:'editor',component:EditorPage},
{path:'/projects/:projectId/exports',name:'exports',component:ExportsPage}]
