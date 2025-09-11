import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="text-center mb-4">
            <h1 className="display-4 text-primary">Cook Islands Ocean Dashboard</h1>
            <p className="lead text-muted">
              Real-time wave forecasts and monitoring for the Cook Islands
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="bi bi-waves display-1 text-info mb-3"></i>
                  <h5 className="card-title">Wave Forecast</h5>
                  <p className="card-text">
                    Access detailed wave height, period, and direction forecasts for Cook Islands waters.
                  </p>
                  <Link 
                    to="/cook-islands-forecast" 
                    className="btn btn-primary"
                  >
                    View Wave Forecast
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="bi bi-info-circle display-1 text-success mb-3"></i>
                  <h5 className="card-title">About</h5>
                  <p className="card-text">
                    This dashboard provides operational wave forecasts from the Cook Islands marine model.
                  </p>
                  <div className="text-muted small">
                    <p>Data source: GEM-HPC THREDDS Server</p>
                    <p>Model: Cook Islands Operational Ocean Model</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
