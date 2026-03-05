import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>BC Card Shows</h1>
        </Link>
        <nav className="nav">
          <Link to="/">Explore Shows</Link>
          <Link to="/about">About</Link>
          <a href="/admin" className="admin-link">Admin</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
