import React from 'react';
import { Routes, Route, HashRouter } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Diagnosis from './components/Diagnosis';
import DeviceDetails from './components/DeviceDetails';

const App = () => {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/diagnosis" element={<Diagnosis />} />
                <Route path="/devices" element={<DeviceDetails />} />
            </Routes>
        </HashRouter>
    );
};

export default App;
