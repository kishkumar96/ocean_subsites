import React from 'react';
import ThemeToggle from './ThemeToggle';

const Header = ({ isDarkMode, toggleTheme }) => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container">
        <a className="navbar-brand d-flex align-items-center" href="/home">
          <img 
            src="/COSPPaC_white_crop2.png" 
            alt="COSPPaC Logo" 
            height="40" 
            className="me-2"
          />
          Cook Islands Ocean Dashboard
        </a>
        
        <div className="navbar-nav ms-auto">
          <ThemeToggle isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        </div>
      </div>
    </nav>
  );
};

export default Header;
