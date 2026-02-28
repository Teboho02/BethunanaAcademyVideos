import { createBrowserRouter, Navigate } from 'react-router';
import { Login } from './pages/Login';
import { Home } from './pages/learner/Home';
import { SubjectPage } from './pages/learner/SubjectPage';
import { TopicPage } from './pages/learner/TopicPage';
import { VideoWatch } from './pages/learner/VideoWatch';
import { Profile } from './pages/learner/Profile';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UploadLesson } from './pages/admin/UploadLesson';
import { ManageLessons } from './pages/admin/ManageLessons';
import { ManageStudents } from './pages/admin/ManageStudents';
import { ManageTopics } from './pages/admin/ManageTopics';
import { VideoAnalytics } from './pages/admin/VideoAnalytics';
import { RootLayout } from './layouts/RootLayout';

export const createRouter = (
  currentUser: { username: string; role: 'student' | 'admin'; avatar: string; grade?: number; studentNumber?: string } | null,
  onLogin: (user: { username: string; role: 'student' | 'admin'; avatar: string; grade?: number; studentNumber?: string }) => void,
  onLogout: () => void
) => {
  return createBrowserRouter([
    {
      path: '/',
      element: currentUser ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />,
    },
    {
      path: '/login',
      element: currentUser ? (
        <Navigate to="/home" replace />
      ) : (
        <Login onLogin={onLogin} />
      ),
    },
    {
      path: '/',
      element: <RootLayout user={currentUser} onLogout={onLogout} />,
      children: [
        {
          path: 'home',
          element: currentUser ? <Home user={currentUser} /> : <Navigate to="/login" replace />,
        },
        {
          path: 'profile',
          element: currentUser ? <Profile user={currentUser} onLogout={onLogout} /> : <Navigate to="/login" replace />,
        },
        {
          path: 'subject/:subjectId',
          element: currentUser ? <SubjectPage /> : <Navigate to="/login" replace />,
        },
        {
          path: 'subject/:subjectId/topic/:topicId',
          element: currentUser ? <TopicPage /> : <Navigate to="/login" replace />,
        },
        {
          path: 'watch/:videoId',
          element: currentUser ? <VideoWatch user={currentUser} /> : <Navigate to="/login" replace />,
        },
        {
          path: 'admin',
          element:
            currentUser?.role === 'admin' ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/home" replace />
            ),
        },
        {
          path: 'admin/upload',
          element:
            currentUser?.role === 'admin' ? (
              <UploadLesson />
            ) : (
              <Navigate to="/home" replace />
            ),
        },
        {
          path: 'admin/lessons',
          element:
            currentUser?.role === 'admin' ? (
              <ManageLessons />
            ) : (
              <Navigate to="/home" replace />
            ),
        },
        {
          path: 'admin/topics',
          element:
            currentUser?.role === 'admin' ? (
              <ManageTopics />
            ) : (
              <Navigate to="/home" replace />
            ),
        },
        {
          path: 'admin/students',
          element:
            currentUser?.role === 'admin' ? (
              <ManageStudents />
            ) : (
              <Navigate to="/home" replace />
            ),
        },
        {
          path: 'admin/analytics',
          element:
            currentUser?.role === 'admin' ? (
              <VideoAnalytics />
            ) : (
              <Navigate to="/home" replace />
            ),
        },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ]);
};
