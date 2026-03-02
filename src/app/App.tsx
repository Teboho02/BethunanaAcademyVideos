import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { createRouter } from './routes';

interface User {
  username: string;
  role: 'student' | 'admin';
  avatar: string;
  grade?: number;
  studentNumber?: string;
  name?: string;
  surname?: string;
}

const normalizeUser = (user: User): User => ({
  ...user,
  avatar: '/person.jpg',
});

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('bethunana_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        const isStaleStudentSession =
          parsedUser.role === 'student' &&
          (!Number.isFinite(parsedUser.grade) || !parsedUser.studentNumber);
        if (isStaleStudentSession) {
          localStorage.removeItem('bethunana_user');
        } else {
          const normalizedUser = normalizeUser(parsedUser);
          setCurrentUser(normalizedUser);
          localStorage.setItem('bethunana_user', JSON.stringify(normalizedUser));
        }
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('bethunana_user');
      }
    }
    setAuthInitialized(true);
  }, []);

  const handleLogin = (user: User) => {
    const normalizedUser = normalizeUser(user);
    setCurrentUser(normalizedUser);
    localStorage.setItem('bethunana_user', JSON.stringify(normalizedUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('bethunana_user');
  };

  const router = createRouter(currentUser, handleLogin, handleLogout);

  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Restoring session...
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default App;
