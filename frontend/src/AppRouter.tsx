import { createBrowserRouter } from 'react-router-dom';
import SetupPassword from './admin/pages/SetupPassword';
import App from './App';

const appRouter = createBrowserRouter([
    {
        path: '/',
        element: <App />, // This handles your Login + Dashboards logic (URL stays at /)
    },
    {
        path: '/setup-password',
        element: <SetupPassword />, // This is your new dedicated URL
    },
]);

export default appRouter;