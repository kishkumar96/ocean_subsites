import React from 'react';

const ThemeToggle = ({ isDarkMode, toggleTheme }) => {
  return (
    <button
      className="btn btn-outline-light btn-sm"
      onClick={toggleTheme}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <i className={`bi ${isDarkMode ? 'bi-sun' : 'bi-moon'}`}></i>
    </button>
  );
};

export default ThemeToggle;
