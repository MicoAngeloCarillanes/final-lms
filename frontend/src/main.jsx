import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import appRouter from './AppRouter'; // Path to the router file we just fixed
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {/* THIS IS THE ONLY ROUTER IN THE APP */}
        <RouterProvider router={appRouter} />
    </React.StrictMode>
);